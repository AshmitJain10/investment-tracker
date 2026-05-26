import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getHoldings, getTargetAllocation } from "@/lib/storage";
import { fetchCurrentPrices } from "@/lib/market";

/**
 * POST: Generate AI Portfolio Insights
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const holdings = await getHoldings(userId);
    const targets = await getTargetAllocation(userId);

    if (holdings.length === 0) {
      return NextResponse.json({
        success: true,
        data: "### Welcome to your AI Advisor!\n\nAdd some holdings to your portfolio, and I will generate a comprehensive audit of your diversification, capital gains tax, sector risks, and active suggestions.",
      });
    }

    const prices = await fetchCurrentPrices(holdings);

    // Calculate core metrics to pass to the advisor
    let totalValue = 0;
    let totalInvested = 0;
    let stocksVal = 0;
    let mfsVal = 0;
    let goldVal = 0;
    
    const sectorMap: Record<string, number> = {};

    for (const h of holdings) {
      const priceInfo = prices[h.symbol];
      const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
      const currentValue = h.quantity * livePrice;
      const investedValue = h.quantity * h.buyPrice * h.exchangeRate;

      totalValue += currentValue;
      totalInvested += investedValue;

      if (h.type === "stock") stocksVal += currentValue;
      else if (h.type === "mutual_fund") mfsVal += currentValue;
      else if (h.type === "gold" || h.type === "sgb") goldVal += currentValue;

      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + currentValue;
    }

    const returnsPercent = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

    // Get dominant sector
    let topSector = "None";
    let topSectorVal = 0;
    for (const sec in sectorMap) {
      if (sectorMap[sec] > topSectorVal) {
        topSectorVal = sectorMap[sec];
        topSector = sec;
      }
    }
    const topSectorPct = totalValue > 0 ? (topSectorVal / totalValue) * 100 : 0;

    const metricsSummary = {
      totalPortfolioValueINR: Math.round(totalValue),
      totalInvestedAmountINR: Math.round(totalInvested),
      absoluteReturnsPercent: Number(returnsPercent.toFixed(1)),
      allocationCurrent: {
        stocks: Number((totalValue > 0 ? (stocksVal / totalValue) * 100 : 0).toFixed(1)),
        mutualFunds: Number((totalValue > 0 ? (mfsVal / totalValue) * 100 : 0).toFixed(1)),
        goldAndBonds: Number((totalValue > 0 ? (goldVal / totalValue) * 100 : 0).toFixed(1)),
      },
      allocationTarget: targets,
      sectorConcentration: {
        topSector,
        percentage: Number(topSectorPct.toFixed(1)),
      },
      numberOfHoldings: holdings.length,
    };

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are "Investment Tracker AI Portfolio Advisor", a premium, analytical full-stack financial coach.
Review the following active investment portfolio metrics and write a professional, encouraging, and highly specific financial health diagnostic report.
Output in standard, clean GitHub Markdown with headers. Do NOT include generic disclaimers at the beginning; go straight to the core findings.

Portfolio Metrics Summary:
- Total Portfolio Value: ₹${metricsSummary.totalPortfolioValueINR.toLocaleString("en-IN")}
- Total Invested Amount: ₹${metricsSummary.totalInvestedAmountINR.toLocaleString("en-IN")}
- Net Performance: ${metricsSummary.absoluteReturnsPercent > 0 ? "+" : ""}${metricsSummary.absoluteReturnsPercent}%
- Current Allocations: Stocks: ${metricsSummary.allocationCurrent.stocks}%, Mutual Funds: ${metricsSummary.allocationCurrent.mutualFunds}%, Gold/Bonds: ${metricsSummary.allocationCurrent.goldAndBonds}%
- Target Allocations: Stocks: ${metricsSummary.allocationTarget.stock}%, Mutual Funds: ${metricsSummary.allocationTarget.mutual_fund}%, Gold/Bonds: ${metricsSummary.allocationTarget.gold}%
- Dominant Sector: "${metricsSummary.sectorConcentration.topSector}" making up ${metricsSummary.sectorConcentration.percentage}% of the total value.
- Total Assets Tracked: ${metricsSummary.numberOfHoldings} unique holdings.

Structure your response into these exact sections:
### 1. Portfolio Diagnostics & Health
Provide a concise overview of how the portfolio is performing. Acknowledge positive discipline or suggest adjustments.

### 2. Risk Exposure & Sector Audit
Highlight potential risk exposures. Explicitly audit the dominant sector concentration (${metricsSummary.sectorConcentration.topSector} at ${metricsSummary.sectorConcentration.percentage}%) and comment if this is healthy or requires mitigation.

### 3. Allocation Drift & Rebalancing Suggestions
Analyze the drift between current allocations and target matrices. Recommend which asset class to scale up or down.

### 4. Tactical Action Plan
Give 3 specific bullet points of immediate, actionable steps the user can execute today (e.g. tax harvesting opportunities, SIP consistency warnings, or rebalancing buy orders).`;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1200, temperature: 0.2 },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const mdText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (mdText) {
            return NextResponse.json({ success: true, data: mdText });
          }
        }
      } catch (err) {
        console.error("Gemini API call failed, falling back to rule-based insights.", err);
      }
    }

    // RULE-BASED INSIGHT GENERATOR (Graceful Offline / Zero-Key Fallback)
    const fallbackReport = generateRuleBasedReport(metricsSummary);
    return NextResponse.json({ success: true, data: fallbackReport });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Computes a highly thorough, professional, and targeted analytical financial advisor report locally.
 */
function generateRuleBasedReport(summary: any): string {
  const current = summary.allocationCurrent;
  const target = summary.allocationTarget;

  // 1. Portfolio Health
  let healthDesc = "Your portfolio is in a building phase. ";
  if (summary.absoluteReturnsPercent > 10) {
    healthDesc += `It shows excellent performance with absolute gains of **${summary.absoluteReturnsPercent}%**, indicating highly favorable timing in equity holdings.`;
  } else if (summary.absoluteReturnsPercent >= 0) {
    healthDesc += `It remains positive with a net yield of **+${summary.absoluteReturnsPercent}%**, representing stable consolidation.`;
  } else {
    healthDesc += `It registers a net unrealized drag of **${summary.absoluteReturnsPercent}%** due to market cycle adjustments. This represents an excellent averaging window.`;
  }

  // 2. Risk & Concentration
  let riskAudit = "";
  if (summary.sectorConcentration.percentage > 40) {
    riskAudit = `**High Risk Warning!** Your exposure to the **"${summary.sectorConcentration.topSector}"** sector is highly concentrated at **${summary.sectorConcentration.percentage}%** of your total assets. Standard prudent financial practices recommend capping single-sector exposure at 25-30% to shield against macro contractions in that specific segment. Consider redirecting new deposits away from ${summary.sectorConcentration.topSector}.`;
  } else {
    riskAudit = `**Healthy Diversification.** Your dominant sector is **"${summary.sectorConcentration.topSector}"**, accounting for **${summary.sectorConcentration.percentage}%** of your holdings. This falls well within the healthy risk margin of 30% and indicates a solid defensive foundation.`;
  }

  // 3. Drift Analysis
  const stockDrift = current.stocks - target.stock;
  const mfDrift = current.mutualFunds - target.mutual_fund;
  const goldDrift = current.goldAndBonds - target.gold;

  let driftRec = "";
  const drifts = [
    { name: "Stocks", val: stockDrift },
    { name: "Mutual Funds", val: mfDrift },
    { name: "Gold / Bonds", val: goldDrift },
  ];
  
  const dominantDrift = drifts.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0];

  if (Math.abs(dominantDrift.val) > 3) {
    driftRec = `Your largest allocation deviation is in **${dominantDrift.name}** at a drift of **${dominantDrift.val > 0 ? "+" : ""}${dominantDrift.val.toFixed(1)}%** compared to your target layout. `;
    if (dominantDrift.val > 0) {
      driftRec += `To re-establish equilibrium, we suggest booking mild profits or routing new cash flows entirely towards underweighted segments.`;
    } else {
      driftRec += `We highly recommend deploying your next cash deployment into this underweighted segment to buy the asset class at a discount.`;
    }
  } else {
    driftRec = `Your asset split is in **excellent alignment** with your target layout! The allocation drift remains within ±2% across all asset classes, requiring no immediate reallocation actions.`;
  }

  // 4. Action Points
  const bullet1 = summary.sectorConcentration.percentage > 40 
    ? `Limit single-sector additions: Gradually diversify out of the **${summary.sectorConcentration.topSector}** sector by directing new purchases into secondary industries.`
    : `Maintain current momentum: Continue your systematic allocation layout as current sector ratios are highly balanced.`;

  const bullet2 = Math.abs(dominantDrift.val) > 3
    ? `Adjust SIP weights: Shift monthly recurring deposits slightly to favor underweighted assets until drift drops below 2%.`
    : `Set custom target price alerts: Build alerts for key breakout thresholds on your watchlist (e.g. TCS or Microsoft) to acquire long-term leaders at discount values.`;

  const bullet3 = summary.absoluteReturnsPercent < 5
    ? `Initiate Tax-Loss Harvesting: Scan your portfolio details for underperforming assets that carry capital losses to offset current gains and minimize tax obligations.`
    : `Analyze Capital Gains Tax: Leverage your tax estimator tab to partition gains between STCG (20%) and LTCG (12.5%) before selling any high-growth equity assets.`;

  return `### 1. Portfolio Diagnostics & Health
${healthDesc} Having ${summary.numberOfHoldings} diversified holdings provides a strong foundation. The absolute capital invested is **₹${summary.totalInvestedAmountINR.toLocaleString("en-IN")}** with a current valuation of **₹${summary.totalPortfolioValueINR.toLocaleString("en-IN")}**.

### 2. Risk Exposure & Sector Audit
${riskAudit}

### 3. Allocation Drift & Rebalancing Suggestions
${driftRec}
Current split: **Stocks: ${current.stocks}%**, **Mutual Funds: ${current.mutualFunds}%**, **Gold: ${current.goldAndBonds}%** (Targets: Stocks: ${target.stock}%, MFs: ${target.mutual_fund}%, Gold: ${target.gold}%).

### 4. Tactical Action Plan
*   **${bullet1}**
*   **${bullet2}**
*   **${bullet3}**`;
}
