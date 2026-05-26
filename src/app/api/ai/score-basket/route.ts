import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import yahooFinance from "@/lib/yahooFinance";

// Helper to get dates for 90-day historical window
function getHistoricalRange(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return {
    period1: startDate.toISOString().split("T")[0],
    period2: endDate.toISOString().split("T")[0],
  };
}

/**
 * POST: Score a custom basket of up to 20 stocks
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tickers } = body;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ success: false, error: "Tickers array is required" }, { status: 400 });
    }

    if (tickers.length > 20) {
      return NextResponse.json({ success: false, error: "Maximum basket limit is 20 stocks" }, { status: 400 });
    }

    // Prepare date range for 90 days history
    const { period1, period2 } = getHistoricalRange(90);

    // Fetch details for all tickers in parallel
    const stockDataPromises = tickers.map(async (ticker) => {
      const sym = ticker.trim().toUpperCase();
      try {
        const [quote, history] = await Promise.all([
          yahooFinance.quote(sym),
          yahooFinance.historical(sym, { period1, period2, interval: "1d" }).catch(() => []),
        ]) as [any, any[]];

        if (!quote) return null;

        // Calculate simple technical features
        const closePrices = history.map((d) => d.close).filter((c) => c !== undefined && c !== null) as number[];
        const latestPrice = quote.regularMarketPrice || (closePrices.length > 0 ? closePrices[closePrices.length - 1] : 0);
        
        let return90Days = 0;
        let volatility = 0;
        let sma50 = latestPrice;

        if (closePrices.length > 0) {
          const firstPrice = closePrices[0];
          return90Days = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;
          
          // Calculate basic daily returns volatility
          const dailyDiffs = [];
          for (let i = 1; i < closePrices.length; i++) {
            dailyDiffs.push((closePrices[i] - closePrices[i - 1]) / closePrices[i - 1]);
          }
          if (dailyDiffs.length > 0) {
            const mean = dailyDiffs.reduce((a, b) => a + b, 0) / dailyDiffs.length;
            const variance = dailyDiffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyDiffs.length;
            volatility = Math.sqrt(variance) * 100 * Math.sqrt(252); // Annualized volatility %
          }

          // Calculate simple 50-day SMA
          const last50 = closePrices.slice(-50);
          if (last50.length > 0) {
            sma50 = last50.reduce((a, b) => a + b, 0) / last50.length;
          }
        }

        return {
          symbol: sym,
          name: quote.longName || quote.shortName || sym,
          price: latestPrice,
          currency: quote.currency || "INR",
          marketCap: quote.marketCap || 0,
          peRatio: quote.trailingPE || null,
          volume: quote.regularMarketVolume || 0,
          volatilityPercent: Math.round(volatility * 10) / 10,
          return90DaysPercent: Math.round(return90Days * 10) / 10,
          aboveSma50: latestPrice >= sma50,
        };
      } catch (err) {
        console.warn(`Failed to resolve yahoo finance metrics for ${sym}`, err);
        return null;
      }
    });

    const resolvedStocks = (await Promise.all(stockDataPromises)).filter((s) => s !== null);

    if (resolvedStocks.length === 0) {
      return NextResponse.json({ success: false, error: "Failed to resolve market data for any provided tickers" }, { status: 404 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are an elite quantitative stock analyst and asset pricing engine.
Analyze each and every stock in the following list individually. Provide stock-specific Technicals, Fundamentals, Risk, rating, and a concise summary paragraph.

Stock Basket Dataset:
${JSON.stringify(resolvedStocks, null, 2)}

Instructions:
Evaluate EACH stock individually on a scale of 1.0 to 10.0 based on its trailing metrics (technicals, fundamentals, risk).
You MUST return a strict JSON response. Do NOT include markdown blocks (\`\`\`json) in your final output, return ONLY the raw JSON string matching this exact schema:
{
  "stocks": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "overallScore": 8.5,
      "subScores": {
        "technicals": 8.0,
        "fundamentals": 9.0,
        "risk": 8.0 // (where 10 is low risk, 1 is extremely high risk)
      },
      "summary": "Apple displays strong technical breakouts with robust 90-day returns, supported by stable fundamentals and institutional volume.",
      "rating": "Buy" // exactly "Buy", "Hold", or "Sell"
    }
  ]
}`;

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
              maxOutputTokens: 1500, 
              temperature: 0.1,
              responseMimeType: "application/json"
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          let rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (rawText) {
            rawText = rawText.trim().replace(/^```json|```$/g, "").trim();
            const parsed = JSON.parse(rawText);
            return NextResponse.json({ success: true, data: parsed });
          }
        }
      } catch (err) {
        console.error("Gemini API call failed for individual stock scoring, using fallback", err);
      }
    }

    // Zero-Key or API Fail Fallback: High-Quality Individual Stock Rule Engine
    const scores = calculateRuleBasedScores(resolvedStocks);
    return NextResponse.json({ success: true, data: scores });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * High-fidelity quantitative rule engine to generate sophisticated scores and custom summaries for each stock
 */
function calculateRuleBasedScores(stocks: any[]) {
  const stockAnalyses = stocks.map((s) => {
    const ret = s.return90DaysPercent;
    const vol = s.volatilityPercent || 25;
    const pe = s.peRatio || 22;
    const aboveSma = s.aboveSma50;

    // 1. Technical Score (momentum and SMA breakout)
    let techScore = 6.0 + (ret / 10) + (aboveSma ? 1.5 : -1.5);
    techScore = Math.max(1, Math.min(10, techScore));

    // 2. Fundamentals Score (valuation PE comparison)
    let fundScore = 7.5;
    if (pe > 35) fundScore -= (pe - 35) / 10;
    else if (pe < 12) fundScore -= (12 - pe) / 5;
    fundScore = Math.max(1, Math.min(10, fundScore));

    // 3. Risk & Volatility Score (Annualized volatility)
    let riskScore = 8.0 - (vol - 20) / 10;
    riskScore = Math.max(1, Math.min(10, riskScore));

    // Overall Score (weighted)
    const overallScore = Number(((techScore * 0.4) + (fundScore * 0.4) + (riskScore * 0.2)).toFixed(1));
    const roundedTech = Number(techScore.toFixed(1));
    const roundedFund = Number(fundScore.toFixed(1));
    const roundedRisk = Number(riskScore.toFixed(1));

    let rating: "Buy" | "Hold" | "Sell" = "Hold";
    if (overallScore >= 7.0) rating = "Buy";
    else if (overallScore <= 4.0) rating = "Sell";

    const summary = `${s.name} (${s.symbol}) exhibits a favorable ${rating.toLowerCase()} profile. Technical parameters show a 90-day return of ${ret.toFixed(1)}% while trading ${aboveSma ? "above" : "below"} its 50-day SMA. Fundamental parameters show a trailing P/E of ${pe.toFixed(1)}x and annualized price volatility of ${vol.toFixed(1)}%.`;

    return {
      symbol: s.symbol,
      name: s.name,
      overallScore,
      subScores: {
        technicals: roundedTech,
        fundamentals: roundedFund,
        risk: roundedRisk,
      },
      summary,
      rating,
    };
  });

  return { stocks: stockAnalyses };
}
