import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getGoldSipData, saveGoldSipData } from "@/lib/storage";
import yahooFinance from "@/lib/yahooFinance";
import { calculateGoldPricePerGram } from "@/lib/math/gold";
import { fetchCurrentUsdInrRate } from "@/lib/math/forex";

/**
 * GET: Retrieve Gold SIP tracker configuration and calculate total grams bought
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const sipData = await getGoldSipData(userId);
    const { checkedDates, dailySipAmount } = sipData;

    if (checkedDates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          checkedDates,
          dailySipAmount,
          accumulatedGrams: 0,
          totalInvested: 0,
          currentValuation: 0,
          avgBuyPricePerGram: 0,
        },
      });
    }

    // Performance Optimization: Batch fetch GC=F and INR=X historical prices for the range
    // Find the oldest checked date to start historical fetch, or default to 35 days ago
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 35);
    
    if (checkedDates.length > 0) {
      const datesSorted = [...checkedDates].sort();
      const oldestDate = new Date(datesSorted[0]);
      if (!isNaN(oldestDate.getTime())) {
        startDate = oldestDate;
      }
    }

    // Set startDate to one day before to ensure we cover the boundary
    startDate.setDate(startDate.getDate() - 1);
    
    const period1 = startDate.toISOString().split("T")[0];
    const period2 = new Date().toISOString().split("T")[0];

    let goldHistoryMap = new Map<string, number>();
    let forexHistoryMap = new Map<string, number>();

    // Fetch USD/INR exchange rate and spot gold live price to support current valuation
    const usdInrRatePromise = fetchCurrentUsdInrRate();

    // Fetch live spot gold price GC=F
    const goldQuotePromise = (async () => {
      try {
        const gcQuote = await yahooFinance.quote("GC=F") as any;
        return gcQuote?.regularMarketPrice || 2300;
      } catch (err) {
        return 2300;
      }
    })();

    // Batch fetch historical prices in parallel
    const historicalPromise = (async () => {
      try {
        const [gcHistory, forexHistory] = await Promise.all([
          yahooFinance.historical("GC=F", { period1, period2, interval: "1d" }),
          yahooFinance.historical("INR=X", { period1, period2, interval: "1d" }),
        ]) as [any[], any[]];

        if (gcHistory && gcHistory.length > 0) {
          for (const item of gcHistory) {
            if (item.date && item.close) {
              const dStr = new Date(item.date).toISOString().split("T")[0];
              goldHistoryMap.set(dStr, item.close);
            }
          }
        }

        if (forexHistory && forexHistory.length > 0) {
          for (const item of forexHistory) {
            if (item.date && item.close) {
              const dStr = new Date(item.date).toISOString().split("T")[0];
              forexHistoryMap.set(dStr, item.close);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch historical gold/forex batch data", err);
      }
    })();

    await historicalPromise;
    const [liveUsdInr, liveGoldUsd] = await Promise.all([usdInrRatePromise, goldQuotePromise]);
    const liveGoldPricePerGram = calculateGoldPricePerGram(liveGoldUsd, liveUsdInr);

    // Calculate grams bought on each checked date
    let totalGrams = 0;
    let totalInvested = 0;

    // Helper to find closest available date in the map ( weekend / holiday fallback )
    const getHistoricalDataForDate = (dateStr: string) => {
      const targetDate = new Date(dateStr);
      let goldPrice = 0;
      let forexPrice = 0;

      // Scan up to 5 days forward to find next active market day
      for (let i = 0; i <= 5; i++) {
        const checkDate = new Date(targetDate);
        checkDate.setDate(checkDate.getDate() + i);
        const checkStr = checkDate.toISOString().split("T")[0];
        
        const g = goldHistoryMap.get(checkStr);
        if (g && g > 0) {
          goldPrice = g;
          break;
        }
      }

      for (let i = 0; i <= 5; i++) {
        const checkDate = new Date(targetDate);
        checkDate.setDate(checkDate.getDate() + i);
        const checkStr = checkDate.toISOString().split("T")[0];
        
        const f = forexHistoryMap.get(checkStr);
        if (f && f > 0) {
          forexPrice = f;
          break;
        }
      }

      // If still not found, fallback to live quotes
      if (goldPrice === 0) goldPrice = liveGoldUsd;
      if (forexPrice === 0) forexPrice = liveUsdInr;

      return { goldPrice, forexPrice };
    };

    for (const dateStr of checkedDates) {
      const { goldPrice, forexPrice } = getHistoricalDataForDate(dateStr);
      const histPricePerGram = calculateGoldPricePerGram(goldPrice, forexPrice);
      
      const gramsBought = histPricePerGram > 0 ? dailySipAmount / histPricePerGram : 0;
      totalGrams += gramsBought;
      totalInvested += dailySipAmount;
    }

    const currentValuation = totalGrams * liveGoldPricePerGram;
    const avgBuyPricePerGram = totalGrams > 0 ? totalInvested / totalGrams : 0;

    return NextResponse.json({
      success: true,
      data: {
        checkedDates,
        dailySipAmount,
        accumulatedGrams: Number(totalGrams.toFixed(6)),
        totalInvested: Math.round(totalInvested),
        currentValuation: Math.round(currentValuation),
        avgBuyPricePerGram: Number(avgBuyPricePerGram.toFixed(2)),
      },
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Save Gold SIP tracker checked dates and configuration
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const body = await req.json();
    const { checkedDates, dailySipAmount } = body;

    if (!Array.isArray(checkedDates) || dailySipAmount === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await saveGoldSipData(userId, checkedDates, Number(dailySipAmount));
    return NextResponse.json({ success: true, message: "Gold SIP configuration saved successfully" });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
