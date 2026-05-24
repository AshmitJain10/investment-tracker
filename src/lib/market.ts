import yahooFinance from "@/lib/yahooFinance";
import { fetchCurrentUsdInrRate } from "./math/forex";
import { calculateGoldPricePerGram } from "./math/gold";
import { Holding } from "@/models/types";

/**
 * Batches and resolves current prices in INR for an array of holdings.
 * Automatically handles USD/INR forex conversion and digital gold calculations.
 */
export async function fetchCurrentPrices(holdings: Holding[]): Promise<Record<string, { price: number; changePercent: number; name: string }>> {
  const priceMap: Record<string, { price: number; changePercent: number; name: string }> = {};
  
  if (holdings.length === 0) return priceMap;

  // Separate assets by source
  const yahooTickers: string[] = [];
  const mfSymbols: string[] = [];
  let hasGold = false;

  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const isAmfi = h.type === "mutual_fund" || /^\d{5,6}/.test(sym);

    if (sym === "GOLD" || h.type === "gold") {
      hasGold = true;
    } else if (isAmfi) {
      const cleanSym = sym.match(/^\d{5,6}/)?.[0] || sym;
      if (!mfSymbols.includes(cleanSym)) mfSymbols.push(cleanSym);
    } else {
      if (!yahooTickers.includes(sym)) yahooTickers.push(sym);
    }
  }

  // Fetch USD/INR exchange rate in parallel
  const usdInrRatePromise = fetchCurrentUsdInrRate();

  // Fetch stocks in parallel
  const yahooPromise = (async () => {
    const results: Record<string, { price: number; changePercent: number; name: string; currency: string }> = {};
    if (yahooTickers.length === 0) return results;

    try {
      
      // yahoo-finance2 supports query quotes one by one or in batch.
      // We will fetch quotes in parallel
      const quotesPromises = yahooTickers.map(async (ticker) => {
        try {
          const q = await yahooFinance.quote(ticker) as any;
          if (q) {
            return {
              ticker,
              price: q.regularMarketPrice || 0,
              changePercent: q.regularMarketChangePercent || 0,
              name: q.longName || q.shortName || ticker,
              currency: q.currency || "INR",
            };
          }
        } catch (e) {
          console.warn(`Failed to fetch Yahoo quote for ${ticker}:`, e);
        }
        return null;
      });

      const quotes = await Promise.all(quotesPromises);
      for (const q of quotes) {
        if (q) {
          results[q.ticker] = {
            price: q.price,
            changePercent: q.changePercent,
            name: q.name,
            currency: q.currency,
          };
        }
      }
    } catch (error) {
      console.error("Failed to batch fetch Yahoo prices", error);
    }
    return results;
  })();

  // Fetch Mutual Funds in parallel
  const mfPromise = (async () => {
    const results: Record<string, { price: number; changePercent: number; name: string }> = {};
    if (mfSymbols.length === 0) return results;

    const promises = mfSymbols.map(async (symbol) => {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${symbol}`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const json = await res.json();
          if (json && json.meta && json.data && json.data.length > 0) {
            const livePrice = Number(json.data[0].nav);
            let changePercent = 0;
            if (json.data.length > 1) {
              const yesterdayPrice = Number(json.data[1].nav);
              changePercent = ((livePrice - yesterdayPrice) / yesterdayPrice) * 100;
            }
            return {
              symbol,
              price: livePrice,
              changePercent,
              name: json.meta.scheme_name,
            };
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch Mutual Fund ${symbol} from AMFI API`, e);
      }
      return null;
    });

    const mfs = await Promise.all(promises);
    for (const m of mfs) {
      if (m) {
        results[m.symbol] = {
          price: m.price,
          changePercent: m.changePercent,
          name: m.name,
        };
      }
    }
    return results;
  })();

  // Fetch Gold in parallel
  const goldPromise = (async () => {
    if (!hasGold) return null;
    try {
      const gcQuote = await yahooFinance.quote("GC=F") as any;
      return {
        priceUsd: gcQuote?.regularMarketPrice || 2300,
        changePercent: gcQuote?.regularMarketChangePercent || 0,
        name: gcQuote?.shortName || "Digital Gold (24K)",
      };
    } catch (e) {
      return { priceUsd: 2300, changePercent: 0, name: "Digital Gold (24K)" };
    }
  })();

  // Resolve all promises
  const [usdInrRate, yahooQuotes, mfQuotes, goldQuote] = await Promise.all([
    usdInrRatePromise,
    yahooPromise,
    mfPromise,
    goldPromise,
  ]);

  // Combine into final INR price map
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();

    if (sym === "GOLD" || h.type === "gold") {
      if (goldQuote) {
        const livePriceINR = calculateGoldPricePerGram(goldQuote.priceUsd, usdInrRate);
        priceMap[h.symbol] = {
          price: livePriceINR,
          changePercent: goldQuote.changePercent,
          name: goldQuote.name,
        };
      } else {
        priceMap[h.symbol] = { price: 6500, changePercent: 0, name: "Digital Gold (24K)" };
      }
      continue;
    }

    const isAmfi = h.type === "mutual_fund" || /^\d{5,6}/.test(sym);
    const cleanSym = isAmfi ? sym.match(/^\d{5,6}/)?.[0] || sym : sym;

    if (isAmfi) {
      if (mfQuotes[cleanSym]) {
        priceMap[h.symbol] = mfQuotes[cleanSym];
      } else {
        // Safe fallback NAV if API fails
        priceMap[h.symbol] = { price: h.buyPrice, changePercent: 0, name: h.name };
      }
      continue;
    }

    // Default Yahoo stocks & SGBs
    const quote = yahooQuotes[sym];
    if (quote) {
      const exchangeRate = quote.currency === "USD" ? usdInrRate : 1.0;
      priceMap[h.symbol] = {
        price: quote.price * exchangeRate,
        changePercent: quote.changePercent,
        name: quote.name,
      };
    } else {
      // Safe fallback if Yahoo fails
      const exchangeRate = h.currency === "USD" ? usdInrRate : 1.0;
      priceMap[h.symbol] = { price: h.buyPrice * exchangeRate, changePercent: 0, name: h.name };
    }
  }

  return priceMap;
}
