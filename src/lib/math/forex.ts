import yahooFinance from "@/lib/yahooFinance";

/**
 * Fetches the historical USD/INR exchange rate for a specific date.
 * If the exact date is a weekend/holiday, scans forward up to 5 days to find the next business day rate.
 * @param dateStr ISO date string (YYYY-MM-DD)
 */
export async function fetchHistoricalExchangeRate(dateStr: string): Promise<number> {
  const DEFAULT_FALLBACK = 83.5;
  try {
    const buyDate = new Date(dateStr);
    if (isNaN(buyDate.getTime())) {
      return DEFAULT_FALLBACK;
    }

    // Set search window: from buyDate to buyDate + 5 days
    const startDate = new Date(buyDate);
    const endDate = new Date(buyDate);
    endDate.setDate(endDate.getDate() + 5);

    const period1 = startDate.toISOString().split("T")[0];
    const period2 = endDate.toISOString().split("T")[0];

    const results = await yahooFinance.historical("INR=X", {
      period1,
      period2,
      interval: "1d",
    }) as any[];

    if (results && results.length > 0) {
      // Find the first valid close price
      for (const day of results) {
        if (day.close && !isNaN(day.close)) {
          return day.close;
        }
      }
    }

    // Secondary fallback: get current quote
    const currentQuote = await yahooFinance.quote("INR=X") as any;
    if (currentQuote && currentQuote.regularMarketPrice) {
      return currentQuote.regularMarketPrice;
    }

    return DEFAULT_FALLBACK;
  } catch (error) {
    console.error("Forex conversion failed for date", dateStr, error);
    return DEFAULT_FALLBACK;
  }
}

/**
 * Fetches the current live USD/INR exchange rate.
 */
export async function fetchCurrentUsdInrRate(): Promise<number> {
  const DEFAULT_FALLBACK = 83.5;
  try {
    const quote = await yahooFinance.quote("INR=X") as any;
    if (quote && quote.regularMarketPrice) {
      return quote.regularMarketPrice;
    }
    return DEFAULT_FALLBACK;
  } catch (error) {
    console.error("Failed to fetch live USD/INR exchange rate:", error);
    return DEFAULT_FALLBACK;
  }
}
