import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getTransactions } from "@/lib/storage";
import { SipHealthDetails } from "@/models/types";

/**
 * GET: Analyze portfolio holdings to detect recurring purchases and calculate SIP Health Scores
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const transactions = await getTransactions(userId);

    if (transactions.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Group transactions by symbol
    const grouped: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      if (!grouped[t.symbol]) {
        grouped[t.symbol] = [];
      }
      grouped[t.symbol].push(t);
    }

    const sipAnalysis: SipHealthDetails[] = [];
    const now = new Date();

    for (const symbol in grouped) {
      const txs = [...grouped[symbol]].sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime());

      // We define a SIP if there are at least 3 transactions for a symbol
      if (txs.length < 3) continue;

      // Analyze dates and quantities
      const firstTxDate = new Date(txs[0].buyDate);
      
      // Determine the average day of the month for the SIP
      const daysOfMonths = txs.map((t) => new Date(t.buyDate).getDate());
      const averageDay = Math.round(daysOfMonths.reduce((sum, d) => sum + d, 0) / daysOfMonths.length);

      // Determine baseline SIP amount (average of first 2 tx values in INR)
      const baseAmount = (txs[0].quantity * txs[0].buyPrice * txs[0].exchangeRate + 
                          txs[1].quantity * txs[1].buyPrice * txs[1].exchangeRate) / 2;

      // Generate expected monthly schedule from first transaction month to current month
      let currentScheduleDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), averageDay);
      let expectedContributions = 0;
      let actualContributions = 0;
      let missedContributions = 0;
      let steppedUpContributions = 0;

      while (currentScheduleDate.getTime() <= now.getTime()) {
        expectedContributions++;

        // Look for actual purchases matching this schedule window (± 7 days)
        const windowStart = new Date(currentScheduleDate);
        windowStart.setDate(windowStart.getDate() - 7);
        const windowEnd = new Date(currentScheduleDate);
        windowEnd.setDate(windowEnd.getDate() + 7);

        const matchingTxs = txs.filter((t) => {
          const d = new Date(t.buyDate);
          return d.getTime() >= windowStart.getTime() && d.getTime() <= windowEnd.getTime();
        });

        if (matchingTxs.length > 0) {
          actualContributions++;
          
          // Check if stepped up (any tx amount is 15% higher than base)
          const totalAmtInWindow = matchingTxs.reduce((sum, t) => sum + t.quantity * t.buyPrice * t.exchangeRate, 0);
          if (totalAmtInWindow >= baseAmount * 1.15) {
            steppedUpContributions++;
          }
        } else {
          missedContributions++;
        }

        // Advance to next month
        currentScheduleDate.setMonth(currentScheduleDate.getMonth() + 1);
      }

      // Calculate health score: Success = +1, Missed = -2, StepUp = +1.5
      // Score = (Success - 2*Missed + 1.5*StepUp) / Expected * 100
      let healthScore = 100;
      if (expectedContributions > 0) {
        const rawScore = 
          ((actualContributions - 2 * missedContributions + 1.5 * steppedUpContributions) / expectedContributions) * 100;
        healthScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      }

      let status: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" = "NEEDS_ATTENTION";
      if (healthScore >= 85) {
        status = "EXCELLENT";
      } else if (healthScore >= 60) {
        status = "GOOD";
      }

      sipAnalysis.push({
        symbol,
        name: txs[0].name,
        sipAmount: Math.round(baseAmount),
        startDate: txs[0].buyDate,
        expectedContributions,
        actualContributions,
        missedContributions,
        steppedUpContributions,
        healthScore,
        status,
      });
    }

    return NextResponse.json({ success: true, data: sipAnalysis });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
