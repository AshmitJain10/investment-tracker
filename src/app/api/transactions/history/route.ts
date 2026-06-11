import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getTransactions, getGoldSipData, getHoldings } from "@/lib/storage";

/**
 * GET: Aggregate capital deployed month-by-month over the last 12 months (in INR).
 * Integrates raw database transactions, virtual daily gold SIP contributions,
 * and fallback legacy holdings with no individual transaction records.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const transactions = await getTransactions(userId);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    
    // Generate chronological list of the last 12 months
    const last12Months: { key: string; month: string; year: number; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      last12Months.push({
        key,
        month: monthNames[d.getMonth()],
        year: d.getFullYear(),
        amount: 0,
      });
    }

    // 1. Populate capital deployed from standard transactions
    for (const tx of transactions) {
      const txDate = new Date(tx.buyDate);
      const key = `${monthNames[txDate.getMonth()]} ${txDate.getFullYear()}`;
      
      const targetMonth = last12Months.find((m) => m.key === key);
      if (targetMonth) {
        const capitalDeployedINR = tx.quantity * tx.buyPrice * (tx.exchangeRate || 1.0);
        targetMonth.amount += capitalDeployedINR;
      }
    }

    // 2. Populate capital deployed from virtual Gold SIP checked dates
    const goldSipData = await getGoldSipData(userId);
    const { checkedDates, dailySipAmount } = goldSipData;

    for (const dateStr of checkedDates) {
      const date = new Date(dateStr);
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      
      const targetMonth = last12Months.find((m) => m.key === key);
      if (targetMonth) {
        targetMonth.amount += dailySipAmount;
      }
    }

    // 3. Populate capital deployed from legacy holdings with no transaction records
    const holdings = await getHoldings(userId);
    for (const holding of holdings) {
      // Skip the virtual gold-sip holding (handled in step 2) and actual GOLD if handled in SIP
      if (holding.id === "gold-sip-virtual-id" || holding.symbol.toUpperCase() === "GOLD") {
        continue;
      }

      const hasTransactions = transactions.some((t) => t.symbol.toUpperCase() === holding.symbol.toUpperCase());
      if (!hasTransactions) {
        const date = new Date(holding.buyDate);
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        const targetMonth = last12Months.find((m) => m.key === key);
        if (targetMonth) {
          const capitalDeployedINR = holding.quantity * holding.buyPrice * (holding.exchangeRate || 1.0);
          targetMonth.amount += capitalDeployedINR;
        }
      }
    }

    // Clean response data
    const chartData = last12Months.map((m) => ({
      month: m.key,
      amount: Number(m.amount.toFixed(2)),
    }));

    return NextResponse.json({ success: true, data: chartData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
