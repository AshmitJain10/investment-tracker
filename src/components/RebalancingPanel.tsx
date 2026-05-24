import React, { useState } from "react";
import { Scale, RefreshCw, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { RebalanceRecommendation } from "@/models/types";

interface RebalanceProps {
  rebalanceData: {
    totalPortfolioValue: number;
    currentAllocations: { stock: number; mutual_fund: number; gold: number };
    targetAllocations: { stock: number; mutual_fund: number; gold: number };
    recommendations: RebalanceRecommendation[];
  } | null;
  onUpdateTargets: (stock: number, mutual_fund: number, gold: number) => Promise<void>;
}

export default function RebalancingPanel({ rebalanceData, onUpdateTargets }: RebalanceProps) {
  
  // State for targets input
  const [stockTarget, setStockTarget] = useState(rebalanceData?.targetAllocations.stock || 60);
  const [mfTarget, setMfTarget] = useState(rebalanceData?.targetAllocations.mutual_fund || 30);
  const [goldTarget, setGoldTarget] = useState(rebalanceData?.targetAllocations.gold || 10);
  const [isSaving, setIsSaving] = useState(false);

  const sumTargets = Number(stockTarget) + Number(mfTarget) + Number(goldTarget);
  const isBalanced = Math.abs(sumTargets - 100) < 0.01;

  const handleSliderChange = (type: "stock" | "mutual_fund" | "gold", val: number) => {
    if (type === "stock") {
      setStockTarget(val);
    } else if (type === "mutual_fund") {
      setMfTarget(val);
    } else {
      setGoldTarget(val);
    }
  };

  const handleSave = async () => {
    if (!isBalanced) return;
    setIsSaving(true);
    try {
      await onUpdateTargets(stockTarget, mfTarget, goldTarget);
    } finally {
      setIsSaving(false);
    }
  };

  if (!rebalanceData) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center h-[300px]">
        <p className="text-gray-400 text-sm">Loading asset rebalancing schedules...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1: TARGET MATRICES INPUTS */}
      <div className="glass-panel p-5 flex flex-col justify-between h-[390px] glow-border">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-400" /> Target Allocation Matrix
          </h3>
          <p className="text-[10px] text-gray-500">Define your ideal portfolio distribution splits.</p>
        </div>

        <div className="space-y-4 my-4 flex-1 flex flex-col justify-center">
          {/* SLIDER 1: STOCKS */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-gray-300">Equity Stocks</span>
              <span className="font-bold text-indigo-400">{stockTarget}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={stockTarget}
              onChange={(e) => handleSliderChange("stock", Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg appearance-none"
            />
          </div>

          {/* SLIDER 2: MUTUAL FUNDS */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-gray-300">Mutual Funds</span>
              <span className="font-bold text-emerald-400">{mfTarget}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={mfTarget}
              onChange={(e) => handleSliderChange("mutual_fund", Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg appearance-none"
            />
          </div>

          {/* SLIDER 3: GOLD & ALTERNATE */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-gray-300">Gold & Bonds</span>
              <span className="font-bold text-amber-400">{goldTarget}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={goldTarget}
              onChange={(e) => handleSliderChange("gold", Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* CONTROLS */}
        <div className="space-y-3">
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${isBalanced ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" : "bg-rose-950/20 border-rose-500/20 text-rose-400"}`}>
            {isBalanced ? (
              <>
                <CheckCircle className="w-4 h-4 shrink-0" /> Target adds up perfectly to 100%
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" /> Current total: {sumTargets}% (Must sum to 100%)
              </>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={!isBalanced || isSaving}
            className="w-full py-2 bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 hover:bg-emerald-600 rounded-lg text-white font-bold text-xs smooth-transition cursor-pointer disabled:cursor-not-allowed text-center shadow-lg shadow-emerald-500/10"
          >
            {isSaving ? "Saving Allocation Matrix..." : "Recalculate Rebalancing"}
          </button>
        </div>
      </div>

      {/* COLUMN 2 & 3: CURRENT DRIFT & RECOMMENDATIONS */}
      <div className="glass-panel p-5 lg:col-span-2 flex flex-col justify-between h-[390px] glow-border">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-indigo-400" /> Drift Analysis & Suggestions
          </h3>
          <p className="text-[10px] text-gray-500">Drift profiles and actionable trade adjustments.</p>
        </div>

        {/* RECOMMENDATIONS CARDS */}
        <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {rebalanceData.recommendations.map((rec) => {
            const driftVal = rec.currentPct - rec.targetPct;
            const categoryName = 
              rec.type === "stock" ? "Equity Stocks" :
              rec.type === "mutual_fund" ? "Mutual Funds" : "Gold & Bonds";

            return (
              <div key={rec.type} className="bg-gray-950/30 border border-gray-850 p-3 rounded-xl flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-200 text-xs">{categoryName}</span>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                      rec.action === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      rec.action === "SELL" ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                      "bg-gray-800 text-gray-400"
                    }`}>
                      {rec.action}
                    </span>
                  </div>
                  
                  {/* Allocation comparison slider */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 shrink-0 w-8">Actual: {rec.currentPct}%</span>
                    <div className="h-2 flex-1 bg-gray-800 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full ${
                          rec.type === "stock" ? "bg-indigo-500" :
                          rec.type === "mutual_fund" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${rec.currentPct}%` }}
                      />
                      {/* Target Indicator Tick */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl"
                        style={{ left: `${rec.targetPct}%` }}
                        title={`Target: ${rec.targetPct}%`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 w-12 text-right">Target: {rec.targetPct}%</span>
                  </div>
                </div>

                {/* DELTA AND SUGGESTION ACTION */}
                <div className="text-right shrink-0">
                  <div className={`font-bold text-xs ${rec.deltaAmount >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {rec.deltaAmount >= 0 ? "+" : "-"}₹{Math.abs(rec.deltaAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-[9px] font-semibold mt-0.5 ${Math.abs(driftVal) > 1.5 ? (driftVal > 0 ? "text-rose-400" : "text-emerald-400") : "text-gray-500"}`}>
                    Drift: {driftVal > 0 ? "+" : ""}{driftVal.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER INFORMATION */}
        <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-lg p-2.5 flex gap-2 items-start text-[10px] text-indigo-300">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            **Rebalancing Rule**: Recommendations use a **1.5% drift filter** to ignore minor market swings. Buy or sell recommended amounts slowly or through asset re-allocation to establish optimal matrix allocations.
          </p>
        </div>

      </div>

    </div>
  );
}
