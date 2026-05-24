import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getHoldings } from "@/lib/storage";
import { fetchCurrentPrices } from "@/lib/market";
import yahooFinance from "@/lib/yahooFinance";
import { fetchCurrentUsdInrRate } from "@/lib/math/forex";
import { calculateGoldPricePerGram } from "@/lib/math/gold";

// Normal distribution sampler using Box-Muller transform
function randomNormal(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * GET: Run Monte Carlo Simulation based on holdings volatility
 * Query params: targetAmount, years, monthlyContribution
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const { searchParams } = new URL(req.url);
    const targetAmount = Number(searchParams.get("targetAmount") || 1000000); // 10L default
    const years = Number(searchParams.get("years") || 5);                    // 5 years default
    const monthlyContribution = Number(searchParams.get("monthlyContribution") || 10000); // 10k default

    const holdings = await getHoldings(userId);
    
    // Determine starting S0 portfolio value in INR
    let s0 = 100000; // default seed if empty
    if (holdings.length > 0) {
      const prices = await fetchCurrentPrices(holdings);
      s0 = holdings.reduce((sum, h) => {
        const info = prices[h.symbol];
        const p = info ? info.price : h.buyPrice * h.exchangeRate;
        return sum + h.quantity * p;
      }, 0);
    }

    // Default annualized return and volatility parameters
    let annualReturn = 0.12; // 12%
    let annualVol = 0.15;    // 15%

    // Calculate actual volatility from holdings historical returns
    if (holdings.length > 0) {
      try {
        const usdInrRate = await fetchCurrentUsdInrRate();
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const period1 = startDate.toISOString().split("T")[0];
        const period2 = endDate.toISOString().split("T")[0];

        // Fetch historical closing prices for all holdings
        const historicalPromises = holdings.map(async (h) => {
          const sym = h.symbol.toUpperCase();
          if (sym === "GOLD" || h.type === "gold") {
            const [gc, forex] = await Promise.all([
              yahooFinance.historical("GC=F", { period1, period2, interval: "1d" }),
              yahooFinance.historical("INR=X", { period1, period2, interval: "1d" }),
            ]) as [any[], any[]];
            
            const forexMap = new Map<string, number>();
            for (const item of forex) {
              if (item.date && item.close) {
                const dateStr = new Date(item.date).toISOString().split("T")[0];
                forexMap.set(dateStr, item.close);
              }
            }

            let lastForex = usdInrRate;
            return gc
              .filter((d) => d.date && d.close)
              .map((d) => {
                const dateStr = new Date(d.date).toISOString().split("T")[0];
                const forexRate = forexMap.get(dateStr) || lastForex;
                lastForex = forexRate;
                return {
                  date: dateStr,
                  price: calculateGoldPricePerGram(d.close, forexRate) * h.quantity,
                };
              });
          } else if (h.type === "mutual_fund" || /^\d{5,6}$/.test(sym)) {
            const mfRes = await fetch(`https://api.mfapi.in/mf/${sym}`);
            const json = await mfRes.json();
            if (json && json.data) {
              return json.data
                .slice(0, 90)
                .map((day: any) => ({
                  date: day.date.split("-").reverse().join("-"),
                  price: Number(day.nav) * h.quantity,
                }))
                .reverse();
            }
          } else {
            const hist = await yahooFinance.historical(sym, { period1, period2, interval: "1d" }) as any[];
            const exchangeRate = h.currency === "USD" ? usdInrRate : 1.0;
            return hist
              .filter((d) => d.date && d.close)
              .map((d) => ({
                date: new Date(d.date).toISOString().split("T")[0],
                price: d.close! * exchangeRate * h.quantity,
              }));
          }
          return [];
        });

        const histories = await Promise.all(historicalPromises);

        // Combine into daily portfolio aggregates
        const dateAggregates: Record<string, number> = {};
        for (const list of histories) {
          if (!list) continue;
          for (const point of list) {
            dateAggregates[point.date] = (dateAggregates[point.date] || 0) + point.price;
          }
        }

        // Sort dates and construct portfolio closing prices
        const sortedDates = Object.keys(dateAggregates).sort();
        const portfolioPrices = sortedDates.map((d) => dateAggregates[d]);

        // Calculate Daily Log Returns: R_t = ln(P_t / P_t-1)
        if (portfolioPrices.length > 5) {
          const logReturns: number[] = [];
          for (let i = 1; i < portfolioPrices.length; i++) {
            const ret = Math.log(portfolioPrices[i] / portfolioPrices[i - 1]);
            if (!isNaN(ret) && isFinite(ret)) {
              logReturns.push(ret);
            }
          }

          if (logReturns.length > 5) {
            // Mean
            const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
            // Variance
            const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (logReturns.length - 1);
            const dailyVol = Math.sqrt(variance);

            // Annualize (assuming 252 trading days)
            annualReturn = meanReturn * 252;
            annualVol = dailyVol * Math.sqrt(252);

            // Sanity limits to prevent extreme data skew
            if (annualReturn < -0.3) annualReturn = -0.1;
            if (annualReturn > 0.4) annualReturn = 0.15;
            if (annualVol < 0.05) annualVol = 0.12;
            if (annualVol > 0.6) annualVol = 0.22;
          }
        }
      } catch (err) {
        console.warn("Failed to calculate precise volatility, using default market assumptions.", err);
      }
    }

    // MONTE CARLO SIMULATION
    // Time grid: months
    const totalMonths = Math.round(years * 12);
    const numPaths = 1000;
    
    // Scale returns to monthly dimensions
    const monthlyReturn = annualReturn / 12;
    const monthlyVol = annualVol / Math.sqrt(12);

    // Track simulated ending values
    const finalValues: number[] = [];
    
    // Initialize trajectory paths
    // Store monthly values for a subset of percentiles: 10th, 50th, 90th
    const monthlyTrajectories: number[][] = Array(numPaths).fill(0).map(() => Array(totalMonths + 1).fill(0));
    for (let path = 0; path < numPaths; path++) {
      monthlyTrajectories[path][0] = s0;
    }

    // Run simulation
    for (let path = 0; path < numPaths; path++) {
      let currentS = s0;
      for (let month = 1; month <= totalMonths; month++) {
        const drift = monthlyReturn - 0.5 * Math.pow(monthlyVol, 2);
        const randomShock = monthlyVol * randomNormal();
        
        // Add monthly contribution + calculate growth
        currentS = (currentS + monthlyContribution) * Math.exp(drift + randomShock);
        monthlyTrajectories[path][month] = Math.max(0, currentS);
      }
      finalValues.push(currentS);
    }

    // Transpose and sort trajectories per step to extract percentiles at each month
    const chartData: { month: number; year: string; p10: number; p50: number; p90: number }[] = [];
    
    for (let month = 0; month <= totalMonths; month++) {
      const stepValues = monthlyTrajectories.map((path) => path[month]).sort((a, b) => a - b);
      
      const p10Idx = Math.floor(numPaths * 0.1);
      const p50Idx = Math.floor(numPaths * 0.5);
      const p90Idx = Math.floor(numPaths * 0.9);

      const yVal = (month / 12).toFixed(1);

      chartData.push({
        month,
        year: `Yr ${yVal}`,
        p10: Math.round(stepValues[p10Idx]), // 10th percentile
        p50: Math.round(stepValues[p50Idx]), // 50th percentile
        p90: Math.round(stepValues[p90Idx]), // 90th percentile
      });
    }

    // Probability of hitting target milestone
    const successfulPaths = finalValues.filter((v) => v >= targetAmount).length;
    const probabilityOfSuccess = (successfulPaths / numPaths) * 100;

    return NextResponse.json({
      success: true,
      data: {
        startingValue: Math.round(s0),
        annualizedReturn: Number((annualReturn * 100).toFixed(1)),
        annualizedVolatility: Number((annualVol * 100).toFixed(1)),
        probabilityOfSuccess: Number(probabilityOfSuccess.toFixed(1)),
        milestoneTarget: targetAmount,
        chartData,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
