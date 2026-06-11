import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getTransactionsForAsset } from "@/lib/storage";

/**
 * GET: Fetch all raw purchase records for a specific asset ticker, filtered by user.
 * Supports virtual gold SIP transactions and fallback legacy holding records.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const { ticker } = await params;
    if (!ticker) {
      return NextResponse.json({ success: false, error: "Missing ticker symbol" }, { status: 400 });
    }

    const decodedTicker = decodeURIComponent(ticker).toUpperCase();

    // 1. DYNAMIC VIRTUAL GOLD SIP TRANSACTIONS
    if (decodedTicker === "GOLD") {
      const { getGoldSipData } = require("@/lib/storage");
      const sipData = await getGoldSipData(userId);
      const { checkedDates, dailySipAmount } = sipData;

      if (checkedDates.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      const yahooFinance = require("@/lib/yahooFinance").default;
      const { calculateGoldPricePerGram } = require("@/lib/math/gold");
      const { fetchCurrentUsdInrRate } = require("@/lib/math/forex");

      let startDate = new Date();
      startDate.setDate(startDate.getDate() - 35);
      if (checkedDates.length > 0) {
        const datesSorted = [...checkedDates].sort();
        const oldestDate = new Date(datesSorted[0]);
        if (!isNaN(oldestDate.getTime())) {
          startDate = oldestDate;
        }
      }
      startDate.setDate(startDate.getDate() - 1);
      const period1 = startDate.toISOString().split("T")[0];
      const period2 = new Date().toISOString().split("T")[0];

      let goldHistoryMap = new Map<string, number>();
      let forexHistoryMap = new Map<string, number>();

      const liveUsdInr = await fetchCurrentUsdInrRate();
      let liveGoldUsd = 2300;
      try {
        const gcQuote = await yahooFinance.quote("GC=F");
        liveGoldUsd = gcQuote?.regularMarketPrice || 2300;
      } catch (err) {}

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
        console.warn("Failed to fetch historical gold/forex batch data", err);
      }

      const getHistoricalDataForDate = (dateStr: string) => {
        const targetDate = new Date(dateStr);
        let goldPrice = 0;
        let forexPrice = 0;

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

        if (goldPrice === 0) goldPrice = liveGoldUsd;
        if (forexPrice === 0) forexPrice = liveUsdInr;

        return { goldPrice, forexPrice };
      };

      const goldTxs = [];
      for (const dateStr of checkedDates) {
        const { goldPrice, forexPrice } = getHistoricalDataForDate(dateStr);
        const histPricePerGram = calculateGoldPricePerGram(goldPrice, forexPrice);
        const gramsBought = histPricePerGram > 0 ? dailySipAmount / histPricePerGram : 0;

        goldTxs.push({
          id: `gold-sip-${dateStr}`,
          userId,
          symbol: "GOLD",
          name: "Digital Gold SIP",
          type: "gold",
          currency: "INR",
          quantity: Number(gramsBought.toFixed(6)),
          buyPrice: Number(histPricePerGram.toFixed(2)),
          buyDate: dateStr,
          exchangeRate: 1.0,
          sector: "Alternative Assets",
        });
      }

      const sortedGoldTxs = goldTxs.sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
      return NextResponse.json({ success: true, data: sortedGoldTxs });
    }

    // 2. STANDARD DB TRANSACTIONS WITH LEGACY HOLDINGS FALLBACK
    const upperSymbol = decodedTicker.toUpperCase();
    const transactions = await getTransactionsForAsset(userId, upperSymbol);

    if (transactions.length === 0) {
      const { getHoldings } = require("@/lib/storage");
      const holdings = await getHoldings(userId);
      const legacyHolding = holdings.find((h: any) => h.symbol.toUpperCase() === upperSymbol);

      if (legacyHolding) {
        const legacyTx = {
          id: `legacy-${legacyHolding.id}`,
          userId,
          symbol: legacyHolding.symbol,
          name: legacyHolding.name,
          type: legacyHolding.type,
          currency: legacyHolding.currency,
          quantity: legacyHolding.quantity,
          buyPrice: legacyHolding.buyPrice,
          buyDate: legacyHolding.buyDate,
          exchangeRate: legacyHolding.exchangeRate || 1.0,
          sector: legacyHolding.sector,
          isLegacy: true,
        };
        return NextResponse.json({ success: true, data: [legacyTx] });
      }
    }

    const sorted = transactions.sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
    return NextResponse.json({ success: true, data: sorted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
