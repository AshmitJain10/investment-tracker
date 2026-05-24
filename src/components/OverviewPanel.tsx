import React, { useState } from "react";
import { TrendingUp, TrendingDown, IndianRupee, Percent, Bell, ShieldCheck } from "lucide-react";
import { Holding, PriceAlert } from "@/models/types";
import { calculateXIRR } from "@/lib/math/xirr";

interface OverviewProps {
  holdings: Holding[];
  prices: Record<string, { price: number; changePercent: number; name: string }>;
  alerts: PriceAlert[];
  onDismissAlert?: (id: string) => void;
}

export default function OverviewPanel({ holdings, prices, alerts, onDismissAlert }: OverviewProps) {
  const [showAlertModal, setShowAlertModal] = useState(false);

  // 1. CALCULATE CORE PORTFOLIO METRICS
  let totalPortfolioValue = 0;
  let totalInvested = 0;
  let dailyNetPnl = 0;

  for (const h of holdings) {
    const priceInfo = prices[h.symbol];
    const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
    const changePct = priceInfo ? priceInfo.changePercent : 0;

    const currentValue = h.quantity * livePrice;
    const investedValue = h.quantity * h.buyPrice * h.exchangeRate;

    totalPortfolioValue += currentValue;
    totalInvested += investedValue;

    // Daily weighted P&L: Value * (Change% / 100)
    // For stock markets, changePercent is e.g. 1.5 for 1.5%
    dailyNetPnl += currentValue * (changePct / 100);
  }

  const totalReturn = totalPortfolioValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const dailyReturnPct = totalPortfolioValue > 0 ? (dailyNetPnl / totalPortfolioValue) * 100 : 0;

  // 1. Calculate Portfolio Lifespan and average holding period in years
  let weightedHoldingDays = 0;
  let activeWeightSum = 0;
  const now = new Date().getTime();
  let earliestBuyDate = now;

  for (const h of holdings) {
    const priceInfo = prices[h.symbol];
    const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
    const currentValue = h.quantity * livePrice;

    const buyDate = new Date(h.buyDate).getTime();
    if (buyDate < earliestBuyDate) earliestBuyDate = buyDate;

    const days = Math.max(1, Math.ceil((now - buyDate) / (1000 * 60 * 60 * 24)));

    weightedHoldingDays += days * currentValue;
    activeWeightSum += currentValue;
  }

  const avgHoldingYears = activeWeightSum > 0 ? (weightedHoldingDays / activeWeightSum) / 365.25 : 0;
  const portfolioLifespanYears = (now - earliestBuyDate) / (1000 * 60 * 60 * 24 * 365.25);

  // Compile real portfolio cash flows for XIRR solver
  const xirrCashFlows = holdings.map((h) => ({
    amount: - (h.quantity * h.buyPrice * h.exchangeRate),
    date: new Date(h.buyDate),
  }));
  xirrCashFlows.push({
    amount: totalPortfolioValue,
    date: new Date(),
  });

  const calculatedXirr = calculateXIRR(xirrCashFlows);
  const absoluteReturnDecimal = totalInvested > 0 ? (totalPortfolioValue - totalInvested) / totalInvested : 0;

  let portfolioCagr = 0;
  let portfolioXirr = 0;

  // CAGR & XIRR fallback to absolute returns if holding lifespan is under 1 year (industry standard)
  if (portfolioLifespanYears >= 1.0 && avgHoldingYears >= 1.0) {
    portfolioCagr = Math.pow(totalPortfolioValue / totalInvested, 1 / avgHoldingYears) - 1;
    portfolioXirr = calculatedXirr;
  } else {
    portfolioCagr = absoluteReturnDecimal;
    portfolioXirr = absoluteReturnDecimal;
  }

  // 2. TARGET PRICE ALERTS TRIGGER VALIDATION
  const activeAlerts = alerts.filter((a) => a.active);
  const triggeredAlerts: { alert: PriceAlert; currentPrice: number }[] = [];

  for (const alert of activeAlerts) {
    const priceInfo = prices[alert.symbol];
    if (priceInfo) {
      const currentPrice = priceInfo.price;
      const isTriggered =
        (alert.condition === "above" && currentPrice >= alert.targetPrice) ||
        (alert.condition === "below" && currentPrice <= alert.targetPrice);

      if (isTriggered) {
        triggeredAlerts.push({ alert, currentPrice });
      }
    }
  }

  return (
    <div className="w-full space-y-6">
      
      {/* TRIGGERED ALERTS NOTIFICATION BAR */}
      {triggeredAlerts.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 smooth-transition animate-pulse">
          <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-300 text-sm">Target Price Alerts Triggered!</h4>
            <div className="mt-1 space-y-1">
              {triggeredAlerts.map(({ alert, currentPrice }) => (
                <p key={alert.id} className="text-xs text-amber-200/90">
                  <span className="font-medium text-white">{alert.symbol}</span> has crossed your target threshold of{" "}
                  <span className="font-semibold">₹{alert.targetPrice}</span> (Current:{" "}
                  <span className="font-semibold text-white">₹{currentPrice.toFixed(2)}</span>).
                  {onDismissAlert && (
                    <button
                      onClick={() => onDismissAlert(alert.id)}
                      className="ml-2 text-[10px] text-amber-400 hover:text-white underline cursor-pointer"
                    >
                      Acknowledge & Clear
                    </button>
                  )}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CORE METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* TOTAL VALUE WIDGET */}
        <div className="glass-panel-glow p-5 flex flex-col justify-between smooth-transition hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Portfolio Value</span>
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight glow-text-green">
              ₹{totalPortfolioValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
            <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Fully reactive live valuation
            </p>
          </div>
        </div>

        {/* TOTAL INVESTED WIDGET */}
        <div className="glass-panel p-5 flex flex-col justify-between smooth-transition hover:translate-y-[-2px] glow-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Capital Invested</span>
            <div className="bg-gray-800 p-1.5 rounded-lg border border-gray-700">
              <IndianRupee className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              ₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
            <p className="text-xs text-gray-400/80 mt-1">
              Across {holdings.length} active assets
            </p>
          </div>
        </div>

        {/* TOTAL RETURNS WIDGET */}
        <div className="glass-panel p-5 flex flex-col justify-between smooth-transition hover:translate-y-[-2px] glow-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Absolute Returns (P&L)</span>
            <div className={`p-1.5 rounded-lg border ${totalReturn >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              {totalReturn >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <h2 className={`text-3xl font-extrabold tracking-tight ${totalReturn >= 0 ? "text-emerald-400 glow-text-green" : "text-rose-500 glow-text-red"}`}>
              {totalReturn >= 0 ? "+" : ""}₹{totalReturn.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
            <p className={`text-xs mt-1 font-semibold flex items-center gap-0.5 ${totalReturn >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
              {totalReturn >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}% net growth
            </p>
          </div>
        </div>

        {/* DAILY CHANGE WIDGET */}
        <div className="glass-panel p-5 flex flex-col justify-between smooth-transition hover:translate-y-[-2px] glow-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Daily P&L Movement</span>
            <div className={`p-1.5 rounded-lg border ${dailyNetPnl >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              {dailyNetPnl >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <h2 className={`text-3xl font-extrabold tracking-tight ${dailyNetPnl >= 0 ? "text-emerald-400 glow-text-green" : "text-rose-500 glow-text-red"}`}>
              {dailyNetPnl >= 0 ? "+" : ""}₹{dailyNetPnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
            <p className={`text-xs mt-1 font-semibold flex items-center gap-0.5 ${dailyNetPnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
              {dailyNetPnl >= 0 ? "+" : ""}{dailyReturnPct.toFixed(2)}% today
            </p>
          </div>
        </div>

      </div>

      {/* METRIC INDEXES BANNER (XIRR & CAGR INDICATORS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-panel p-4 flex items-center justify-between border-l-4 border-l-indigo-500/60">
          <div>
            <h5 className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Weighted Portfolio CAGR</h5>
            <p className="text-[10px] text-gray-500">Compound Annual Growth Rate (falls back to Absolute Return if lifespan is under 1 year).</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-indigo-400">
              {portfolioCagr !== 0 ? `${(portfolioCagr * 100).toFixed(2)}%` : "0.00%"}
            </span>
          </div>
        </div>
        
        <div className="glass-panel p-4 flex items-center justify-between border-l-4 border-l-emerald-500/60">
          <div>
            <h5 className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Weighted Portfolio XIRR</h5>
            <p className="text-[10px] text-gray-500">Extended Internal Rate of Return (falls back to Absolute Return if lifespan is under 1 year).</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-emerald-400">
              {portfolioXirr !== 0 ? `${(portfolioXirr * 100).toFixed(2)}%` : "0.00%"}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
