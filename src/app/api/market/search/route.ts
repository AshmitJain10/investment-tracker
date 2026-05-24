import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahooFinance";

// Server-side cache for Mutual Fund schemes to enable instant high-speed searches
interface MfMasterList {
  schemeCode: number;
  schemeName: string;
}

interface GlobalWithMfCache {
  _mfMasterCache?: MfMasterList[];
  _mfLastFetchTime?: number;
}

const globalWithMf = global as typeof globalThis & GlobalWithMfCache;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // Cache mutual funds list for 24 hours

async function getMutualFundsMasterList(): Promise<MfMasterList[]> {
  const now = Date.now();
  if (globalWithMf._mfMasterCache && globalWithMf._mfLastFetchTime && now - globalWithMf._mfLastFetchTime < CACHE_DURATION_MS) {
    return globalWithMf._mfMasterCache;
  }

  try {
    const res = await fetch("https://api.mfapi.in/mf", { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        globalWithMf._mfMasterCache = data;
        globalWithMf._mfLastFetchTime = now;
        return data;
      }
    }
  } catch (error) {
    console.error("Failed to load mutual funds master list, searching without cache.", error);
  }

  return globalWithMf._mfMasterCache || [];
}

/**
 * GET: Search for assets (Stocks, MFs)
 * Query: ?q=query
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const searchQuery = query.trim().toLowerCase();

    // 1. Search Stocks using Yahoo Finance
    let stockResults: any[] = [];
    try {
      const searchRes = await yahooFinance.search(searchQuery, { newsCount: 0 }) as any;
      if (searchRes && searchRes.quotes) {
        stockResults = searchRes.quotes
          .filter((q: any) => q.isYahooFinance && (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.symbol.includes("SGB")))
          .map((q: any) => ({
            symbol: q.symbol,
            name: q.longname || q.shortname || q.symbol,
            type: q.symbol.includes("SGB") ? "sgb" : "stock",
            exchange: q.exchDisp || q.exchange || "",
          }))
          .slice(0, 8); // Limit stock results
      }
    } catch (err) {
      console.warn("Yahoo search failed, searching mutual funds only", err);
    }

    // 2. Search Mutual Funds
    let mfResults: any[] = [];
    try {
      const mfList = await getMutualFundsMasterList();
      if (mfList && mfList.length > 0) {
        mfResults = mfList
          .filter((mf) => mf.schemeName.toLowerCase().includes(searchQuery))
          .map((mf) => ({
            symbol: String(mf.schemeCode),
            name: mf.schemeName,
            type: "mutual_fund",
            exchange: "AMFI",
          }))
          .slice(0, 8); // Limit mutual fund results
      }
    } catch (err) {
      console.warn("Mutual fund filter failed", err);
    }

    // 3. Add static Gold matching
    let goldResults: any[] = [];
    if ("digital gold 24k metal gram spot price".includes(searchQuery) || "gold".includes(searchQuery)) {
      goldResults.push({
        symbol: "GOLD",
        name: "Digital Gold (24K)",
        type: "gold",
        exchange: "Alternative Assets",
      });
    }

    const mergedResults = [...goldResults, ...stockResults, ...mfResults];
    return NextResponse.json({ success: true, data: mergedResults });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
