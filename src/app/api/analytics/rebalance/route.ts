import { NextRequest, NextResponse } from "next/server";
import { getHoldings, getTargetAllocation, saveTargetAllocation } from "@/lib/storage";
import { fetchCurrentPrices } from "@/lib/market";
import { RebalanceRecommendation } from "@/models/types";

/**
 * GET: Calculate drift and rebalancing recommendations
 */
export async function GET() {
  try {
    const holdings = await getHoldings();
    const targets = await getTargetAllocation();

    if (holdings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalPortfolioValue: 0,
          currentAllocations: { stock: 0, mutual_fund: 0, gold: 0 },
          targetAllocations: targets,
          recommendations: [],
        },
      });
    }

    // Fetch current prices in INR
    const prices = await fetchCurrentPrices(holdings);

    // Calculate valuations by category
    let totalPortfolioValue = 0;
    let stockValue = 0;
    let mfValue = 0;
    let goldValue = 0; // standard gold + SGB

    for (const h of holdings) {
      const priceInfo = prices[h.symbol];
      const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
      const currentValue = h.quantity * livePrice;

      totalPortfolioValue += currentValue;

      if (h.type === "stock") {
        stockValue += currentValue;
      } else if (h.type === "mutual_fund") {
        mfValue += currentValue;
      } else if (h.type === "gold" || h.type === "sgb") {
        goldValue += currentValue;
      }
    }

    // Calculate current percentages
    const currentStockPct = totalPortfolioValue > 0 ? (stockValue / totalPortfolioValue) * 100 : 0;
    const currentMfPct = totalPortfolioValue > 0 ? (mfValue / totalPortfolioValue) * 100 : 0;
    const currentGoldPct = totalPortfolioValue > 0 ? (goldValue / totalPortfolioValue) * 100 : 0;

    const currentAllocations = {
      stock: Number(currentStockPct.toFixed(2)),
      mutual_fund: Number(currentMfPct.toFixed(2)),
      gold: Number(currentGoldPct.toFixed(2)),
    };

    // Calculate recommendations
    const recommendations: RebalanceRecommendation[] = [];
    const categories: { type: "stock" | "mutual_fund" | "gold"; currentVal: number; targetPct: number }[] = [
      { type: "stock", currentVal: stockValue, targetPct: targets.stock },
      { type: "mutual_fund", currentVal: mfValue, targetPct: targets.mutual_fund },
      { type: "gold", currentVal: goldValue, targetPct: targets.gold },
    ];

    for (const cat of categories) {
      const targetValue = totalPortfolioValue * (cat.targetPct / 100);
      const deltaAmount = targetValue - cat.currentVal;
      
      let action: "BUY" | "SELL" | "HOLD" = "HOLD";
      // Nudge buffer of 1.5% drift before recommending buy/sell to reduce transaction fees
      const driftPct = totalPortfolioValue > 0 ? (Math.abs(deltaAmount) / totalPortfolioValue) * 100 : 0;
      
      if (driftPct > 1.5) {
        action = deltaAmount > 0 ? "BUY" : "SELL";
      }

      recommendations.push({
        type: cat.type,
        currentPct: totalPortfolioValue > 0 ? Number(((cat.currentVal / totalPortfolioValue) * 100).toFixed(2)) : 0,
        targetPct: cat.targetPct,
        currentValue: Number(cat.currentVal.toFixed(2)),
        targetValue: Number(targetValue.toFixed(2)),
        deltaAmount: Number(deltaAmount.toFixed(2)),
        action,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
        currentAllocations,
        targetAllocations: targets,
        recommendations,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Update target allocations
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stock, mutual_fund, gold } = body;

    if (stock === undefined || mutual_fund === undefined || gold === undefined) {
      return NextResponse.json({ success: false, error: "Missing allocation fields" }, { status: 400 });
    }

    const total = Number(stock) + Number(mutual_fund) + Number(gold);
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json({ success: false, error: "Allocations must sum up to exactly 100%" }, { status: 400 });
    }

    await saveTargetAllocation(Number(stock), Number(mutual_fund), Number(gold));
    return NextResponse.json({ success: true, message: "Target allocations updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
