import React, { useState, useEffect } from "react";
import { DollarSign, ShieldAlert, Sparkles, Landmark, Calendar, Play, AlertCircle, Info, Milestone } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";
import { TaxSummary, SipHealthDetails } from "@/models/types";

interface AnalyticsProps {
  taxSummary: TaxSummary | null;
  sipSummary: SipHealthDetails[] | null;
  onRunMonteCarlo: (target: number, years: number, sip: number) => Promise<any>;
}

export default function AnalyticsPanel({ taxSummary, sipSummary, onRunMonteCarlo }: AnalyticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<"tax" | "sip" | "monte_carlo">("tax");

  // Daily Gold SIP states
  const [dailySipAmt, setDailySipAmt] = useState(100);
  const [sipDays, setSipDays] = useState(30); // 30 days default streak
  const [goldAvgBuy, setGoldAvgBuy] = useState(14701.5); // user's buy price per gram
  const currentGoldPrice = 16100.0; // live gold price per gram with 15.7% premium

  // Daily Gold SIP Calculations
  const goldSipInvested = dailySipAmt * sipDays;
  const goldSipGrams = goldSipInvested / goldAvgBuy;
  const goldSipCurrentValue = goldSipGrams * currentGoldPrice;
  const goldSipGain = goldSipCurrentValue - goldSipInvested;
  const goldSipGainPercent = goldSipInvested > 0 ? (goldSipGain / goldSipInvested) * 100 : 0;

  // Generate 5-year visual projection for Daily Gold SIP
  const goldSipProjection: { year: string; Invested: number; Valuation: number }[] = [];
  let accumSaved = 0;
  let accumVal = 0;
  const goldMonthlyRate = 0.12 / 12; // 12% expected annual return
  const monthlySipEquiv = dailySipAmt * 30.4375;
  for (let y = 0; y <= 5; y++) {
    if (y === 0) {
      goldSipProjection.push({ year: "Start", Invested: 0, Valuation: 0 });
    } else {
      accumSaved += dailySipAmt * 365;
      const months = y * 12;
      accumVal = monthlySipEquiv * ((Math.pow(1 + goldMonthlyRate, months) - 1) / goldMonthlyRate);
      goldSipProjection.push({
        year: `Yr ${y}`,
        Invested: Math.round(accumSaved),
        Valuation: Math.round(accumVal),
      });
    }
  }

  // Monte Carlo parameters
  const [targetAmount, setTargetAmount] = useState(1500000); // 15L default
  const [horizonYears, setHorizonYears] = useState(5);        // 5 years default
  const [monthlyContribution, setMonthlyContribution] = useState(15000); // 15k default
  const [simResults, setSimResults] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Trigger Monte Carlo simulation on load or on parameters update
  useEffect(() => {
    handleTriggerSimulation();
  }, [activeSubTab]);

  const handleTriggerSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await onRunMonteCarlo(targetAmount, horizonYears, monthlyContribution);
      if (res && res.success) {
        setSimResults(res.data);
      }
    } catch (err) {
      console.error("Monte Carlo simulation failed to run", err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* SUB-TABS SELECTOR */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveSubTab("tax")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider smooth-transition border-b-2 cursor-pointer ${
            activeSubTab === "tax"
              ? "border-emerald-500 text-emerald-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <span className="flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Capital Gains Tax</span>
        </button>
        <button
          onClick={() => setActiveSubTab("sip")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider smooth-transition border-b-2 cursor-pointer ${
            activeSubTab === "sip"
              ? "border-emerald-500 text-emerald-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> SIP Health Score</span>
        </button>
        <button
          onClick={() => setActiveSubTab("monte_carlo")}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider smooth-transition border-b-2 cursor-pointer ${
            activeSubTab === "monte_carlo"
              ? "border-emerald-500 text-emerald-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <span className="flex items-center gap-1.5"><Milestone className="w-3.5 h-3.5" /> Monte Carlo Simulation</span>
        </button>
      </div>

      {/* ==================== TAB 1: CAPITAL GAINS TAX ESTIMATOR ==================== */}
      {activeSubTab === "tax" && taxSummary && (
        <div className="space-y-6">
          {/* TAX OVERVIEW BOXES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-panel p-4 flex flex-col justify-between hover:translate-y-[-2px] smooth-transition glow-border">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Estimated Short-Term Tax (STCG)</span>
              <h3 className="text-xl font-extrabold text-white mt-2">
                ₹{taxSummary.estimatedShortTermTax.toLocaleString("en-IN")}
              </h3>
              <p className="text-[10px] text-gray-500 mt-1">Taxed at 20% on equity held ≤ 1 year.</p>
            </div>
            
            <div className="glass-panel p-4 flex flex-col justify-between hover:translate-y-[-2px] smooth-transition glow-border">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Estimated Long-Term Tax (LTCG)</span>
              <h3 className="text-xl font-extrabold text-white mt-2">
                ₹{taxSummary.estimatedLongTermTax.toLocaleString("en-IN")}
              </h3>
              <p className="text-[10px] text-gray-500 mt-1">Taxed at 12.5% (adjusts for ₹1.25L exemption).</p>
            </div>

            <div className="glass-panel-glow p-4 flex flex-col justify-between hover:translate-y-[-2px] smooth-transition">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Harvesting Opportunity</span>
              <h3 className="text-xl font-extrabold text-emerald-400 mt-2 glow-text-green">
                ₹{taxSummary.taxLossHarvestingOpportunity.toLocaleString("en-IN")}
              </h3>
              <p className="text-[10px] text-emerald-400/80 mt-1">Potential direct tax savings available.</p>
            </div>
          </div>

          {/* HARVESTING ALERTS */}
          <div className="glass-panel p-5 space-y-4 glow-border">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Tax-Loss Harvesting Recommendations</h4>
                <p className="text-[10px] text-gray-500">Scan of underperforming assets carrying unrealized losses to offset gains.</p>
              </div>
            </div>

            {taxSummary.harvestableAssets.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No active tax-loss harvesting opportunities detected. All holdings currently reflect positive growth or flat baselines.
              </p>
            ) : (
              <div className="space-y-3">
                {taxSummary.harvestableAssets.map((asset) => (
                  <div key={asset.id} className="bg-gray-950/40 border border-gray-850 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{asset.symbol} - {asset.name}</div>
                      <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                        Current Loss: ₹{Math.abs(asset.unrealizedGainINR).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg inline-block sm:block text-[10px]">
                        Save ~₹{(Math.abs(asset.unrealizedGainINR) * (asset.taxRatePercent / 100)).toLocaleString("en-IN", { maximumFractionDigits: 0 })} in tax
                      </div>
                      <div className="text-[9px] text-gray-500 mt-1">Offsetting standard STCG rate ({asset.taxRatePercent}%)</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* TAX BRACKET DETAILS TABLE */}
          <div className="glass-panel overflow-x-auto w-full glow-border">
            <h4 className="font-bold text-gray-200 text-xs uppercase tracking-wider p-4 border-b border-gray-800">Tax Asset Ledger</h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-950/20 border-b border-gray-800 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Asset</th>
                  <th className="p-3 text-right">Cost Value</th>
                  <th className="p-3 text-right">Live Value</th>
                  <th className="p-3 text-right">Unrealized Gain</th>
                  <th className="p-3 text-center">Holding Period</th>
                  <th className="p-3 text-center">Tax Category</th>
                  <th className="p-3 text-right">Est. Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {taxSummary.details.map((detail) => (
                  <tr key={detail.id} className="hover:bg-gray-900/20 smooth-transition">
                    <td className="p-3">
                      <div className="font-bold text-white">{detail.symbol}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{detail.name}</div>
                    </td>
                    <td className="p-3 text-right text-gray-400">
                      ₹{detail.investedValueINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right text-gray-300">
                      ₹{detail.currentValueINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`p-3 text-right font-bold ${detail.unrealizedGainINR >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                      {detail.unrealizedGainINR >= 0 ? "+" : ""}₹{detail.unrealizedGainINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-center text-gray-400">
                      {detail.holdingDays} days
                    </td>
                    <td className="p-3 text-center font-semibold text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${
                        detail.holdingPeriodCategory === "LONG_TERM" 
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {detail.holdingPeriodCategory === "LONG_TERM" ? "LTCG" : "STCG"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-white">
                      ₹{detail.estimatedTaxINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      <span className="block text-[8px] text-gray-500 font-semibold mt-0.5">Rate: {detail.taxRatePercent}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==================== TAB 2: SIP HEALTH GRADE MONITOR ==================== */}
      {activeSubTab === "sip" && (
        <div className="space-y-6">
          
          {/* DAILY GOLD SIP ACCUMULATOR CARD */}
          <div className="glass-panel p-5 space-y-5 glow-border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-850 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/20 glow-border">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm tracking-wide uppercase">Daily Digital Gold SIP Accumulator</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Custom active daily dollar-cost-averaging strategy and performance analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full tracking-wider animate-pulse">
                  Active
                </span>
                <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full tracking-wider">
                  Streak: 100%
                </span>
              </div>
            </div>

            {/* CONTROLS & INTERACTIVE PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Daily Contribution (₹)</label>
                <input
                  type="number"
                  value={dailySipAmt}
                  onChange={(e) => setDailySipAmt(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 smooth-transition"
                />
                <span className="text-[9px] text-gray-500 mt-1 block">Baseline recurring daily deployment</span>
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Total Days Deposited</label>
                <input
                  type="number"
                  value={sipDays}
                  onChange={(e) => setSipDays(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 smooth-transition"
                />
                <span className="text-[9px] text-gray-500 mt-1 block">Active uninterrupted streak count</span>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Avg Purchase Price (₹/g)</label>
                <input
                  type="number"
                  value={goldAvgBuy}
                  onChange={(e) => setGoldAvgBuy(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 smooth-transition"
                />
                <span className="text-[9px] text-gray-500 mt-1 block">Average buy rate per gram of gold</span>
              </div>
            </div>

            {/* PERFORMANCE METRICS & PROJECTED VALUE */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-950/20 p-3 rounded-xl border border-gray-850">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Invested</div>
                <div className="text-sm font-extrabold text-white mt-1.5">₹{goldSipInvested.toLocaleString("en-IN")}</div>
              </div>
              <div className="bg-gray-950/20 p-3 rounded-xl border border-gray-850">
                <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Gold Accumulated</div>
                <div className="text-sm font-extrabold text-amber-400 mt-1.5">{goldSipGrams.toFixed(4)} g</div>
              </div>
              <div className="bg-gray-950/20 p-3 rounded-xl border border-gray-850">
                <div className="text-[10px] text-gray-300 uppercase tracking-wider font-semibold">Current Value (₹16.1k/g)</div>
                <div className="text-sm font-extrabold text-white mt-1.5">₹{goldSipCurrentValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-gray-950/20 p-3 rounded-xl border border-gray-850">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Absolute Returns</div>
                <div className="text-sm font-extrabold text-emerald-400 mt-1.5 glow-text-green">
                  +₹{goldSipGain.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                  <span className="text-[10px] block font-semibold text-emerald-400/80">({goldSipGainPercent.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            {/* STREAK VISUALBOARD & ADVICE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs items-center border-t border-gray-850/60 pt-4 mt-2">
              <div className="space-y-3 bg-gray-950/15 p-4 rounded-xl border border-gray-850/40">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  <span>30-Day Daily Deposit Streak</span>
                  <span className="text-emerald-400 font-extrabold">100% Perfect</span>
                </div>
                <div className="grid grid-cols-10 gap-2.5">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="h-3 w-3 bg-amber-500 border border-amber-400/30 rounded-md shadow-[0_0_8px_rgba(245,158,11,0.25)] flex items-center justify-center text-[8px] text-amber-950 font-black cursor-pointer transform hover:scale-125 smooth-transition"
                      title={`Day ${i+1}: ₹${dailySipAmt} Deposited`}
                    >
                      ✓
                    </div>
                  ))}
                </div>
              </div>

              {/* ADVOCATE INSIGHT */}
              <div className="space-y-2 bg-gradient-to-r from-amber-500/10 to-indigo-500/5 p-4 rounded-xl border border-amber-500/10">
                <div className="flex items-center gap-1 text-[10px] uppercase font-black text-amber-400 tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 fill-current animate-spin-slow" /> AI Advisor Advocacy
                </div>
                <p className="text-[11px] leading-relaxed text-gray-300">
                  Deploying <strong>₹{dailySipAmt} daily</strong> in 24K Digital Gold is a phenomenal dollar-cost-averaging strategy. By splitting capital daily, you completely bypass short-term spot volatility and hedge against rupee inflation, outperforming 90% of lump-sum alternative asset entries.
                </p>
              </div>
            </div>

            {/* 5-YEAR PROJECTION LINE CHART */}
            <div className="border-t border-gray-850/60 pt-4 mt-2">
              <h5 className="font-bold text-gray-200 text-xs uppercase tracking-wider mb-3">Daily SIP Wealth Funnel (5-Year Projection at 12% CAGR)</h5>
              <div className="h-[180px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={goldSipProjection} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                    <XAxis dataKey="year" stroke="#4b5563" fontSize={9} tickLine={false} />
                    <YAxis 
                      stroke="#4b5563" 
                      fontSize={9} 
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
                      formatter={(v: any) => [`₹${v.toLocaleString("en-IN")}`, ""]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="Valuation" stroke="#f59e0b" strokeWidth={2} dot={true} name="Projected Value" />
                    <Line type="monotone" dataKey="Invested" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Principal Saved" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MONTHLY DETECTED SIPS */}
          <div className="glass-panel p-5 space-y-4 glow-border">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <Calendar className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h4 className="font-bold text-gray-200 text-sm uppercase tracking-wider">SIP Health & Consistency Grading</h4>
                <p className="text-[10px] text-gray-500">Grades regularity of recurring contributions, missed dates, and stepped-up capital deployment.</p>
              </div>
            </div>

            {!sipSummary || sipSummary.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">
                No active Systematic Investment Plans (SIP) detected. We dynamically detect SIP profiles when an asset has at least 3 transactions spaced roughly 30 days apart.
              </p>
            ) : (
              <div className="space-y-4">
                {sipSummary.map((sip) => (
                  <div key={sip.symbol} className="bg-gray-950/40 border border-gray-850 p-4 rounded-xl space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-900 pb-2.5">
                      <div>
                        <div className="font-bold text-white text-sm">{sip.symbol} - {sip.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Inferred Baseline SIP Amount: <span className="text-gray-300 font-bold">₹{sip.sipAmount.toLocaleString("en-IN")} / month</span> (Started {sip.startDate})
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 sm:mt-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          sip.status === "EXCELLENT" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          sip.status === "GOOD" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}>
                          {sip.status}
                        </span>
                        <span className="text-lg font-extrabold text-white glow-text-green">{sip.healthScore}% score</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div className="bg-gray-950/20 p-2 rounded-lg border border-gray-850">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Expected Months</div>
                        <div className="text-sm font-bold text-white mt-1">{sip.expectedContributions}</div>
                      </div>
                      <div className="bg-gray-950/20 p-2 rounded-lg border border-gray-850">
                        <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Deposited Months</div>
                        <div className="text-sm font-bold text-emerald-400 mt-1">{sip.actualContributions}</div>
                      </div>
                      <div className="bg-gray-950/20 p-2 rounded-lg border border-gray-850">
                        <div className="text-[10px] text-rose-500 uppercase tracking-wider font-semibold">Missed Months</div>
                        <div className="text-sm font-bold text-rose-500 mt-1">{sip.missedContributions}</div>
                      </div>
                      <div className="bg-gray-950/20 p-2 rounded-lg border border-gray-850">
                        <div className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Stepped-Up Months</div>
                        <div className="text-sm font-bold text-indigo-400 mt-1">{sip.steppedUpContributions}</div>
                      </div>
                    </div>

                    {/* Progress visual bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>Deposited Ratios</span>
                        <span>{((sip.actualContributions / sip.expectedContributions) * 100).toFixed(0)}% consistency</span>
                      </div>
                      <div className="h-2 bg-gray-900 border border-gray-850 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${(sip.actualContributions / sip.expectedContributions) * 100}%` }}
                        />
                        <div 
                          className="h-full bg-rose-500" 
                          style={{ width: `${(sip.missedContributions / sip.expectedContributions) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 3: MONTE CARLO HORIZON SIMULATOR ==================== */}
      {activeSubTab === "monte_carlo" && (
        <div className="space-y-6">
          
          {/* CONTROL BOX */}
          <div className="glass-panel p-5 space-y-4 glow-border">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Monte Carlo Milestone Forecaster</h4>
                <p className="text-[10px] text-gray-500">GBM paths tracking probability distributions of hitting targets based on holdings historic volatility.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Goal Milestone Target (₹)</label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(Number(e.target.value))}
                  placeholder="e.g. 1500000"
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Horizon Period (Years)</label>
                <input
                  type="number"
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">Monthly Contribution / SIP (₹)</label>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  placeholder="e.g. 15000"
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                />
              </div>
            </div>

            <button
              onClick={handleTriggerSimulation}
              disabled={isSimulating}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 rounded-lg text-white font-bold text-xs smooth-transition cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> {isSimulating ? "Simulating 1,000 Paths..." : "Execute Simulation"}
            </button>
          </div>

          {/* SIMULATION VISUALIZATIONS */}
          {simResults && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TRAJECTORY LINE CHART */}
              <div className="glass-panel p-5 lg:col-span-2 flex flex-col justify-between h-[390px] glow-border">
                <div>
                  <h5 className="font-bold text-gray-200 text-xs uppercase tracking-wider">Milestone Wealth Funnel Projection</h5>
                  <p className="text-[9px] text-gray-500">Trajectory corridors: P90 (Optimistic), P50 (Median), and P10 (Pessimistic).</p>
                </div>
                
                <div className="flex-1 min-h-[240px] mt-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={simResults.chartData} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                      <XAxis dataKey="year" stroke="#4b5563" fontSize={10} tickLine={false} />
                      <YAxis 
                        stroke="#4b5563" 
                        fontSize={10} 
                        tickLine={false}
                        tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
                        formatter={(v: any) => [`₹${v.toLocaleString("en-IN")}`, ""]}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <ReferenceLine 
                        y={simResults.milestoneTarget} 
                        stroke="#f59e0b" 
                        strokeDasharray="5 5" 
                        label={{ value: `Goal Target: ₹${(simResults.milestoneTarget / 100000).toFixed(0)}L`, fill: "#f59e0b", fontSize: 9, position: "top" }}
                      />
                      <Line type="monotone" dataKey="p90" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Optimistic (P90)" />
                      <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} dot={false} name="Median (P50)" />
                      <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={2} dot={false} name="Pessimistic (P10)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* STATISTICAL SUMMARY */}
              <div className="glass-panel p-5 flex flex-col justify-between h-[390px] glow-border">
                <div>
                  <h5 className="font-bold text-gray-200 text-xs uppercase tracking-wider">Simulation Audit</h5>
                  <p className="text-[9px] text-gray-500">Calculated parameters derived from current assets.</p>
                </div>

                <div className="space-y-4 my-4 flex-1 flex flex-col justify-center text-xs">
                  <div className="flex justify-between border-b border-gray-850 pb-2">
                    <span className="text-gray-400">Current seed value (S0):</span>
                    <span className="font-bold text-white">₹{simResults.startingValue.toLocaleString("en-IN")}</span>
                  </div>
                  
                  <div className="flex justify-between border-b border-gray-850 pb-2">
                    <span className="text-gray-400">Annual Return (drift μ):</span>
                    <span className="font-bold text-white">{simResults.annualizedReturn}% / year</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-850 pb-2">
                    <span className="text-gray-400">Annual Volatility (vol σ):</span>
                    <span className="font-bold text-white">{simResults.annualizedVolatility}% / year</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-850 pb-2">
                    <span className="text-gray-400">Simulated Target Goal:</span>
                    <span className="font-bold text-amber-400">₹{simResults.milestoneTarget.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* TARGET ACHIEVEMENT GUAGE CARD */}
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl text-center space-y-1">
                  <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Probability of Success</div>
                  <h2 className="text-4xl font-black text-emerald-400 glow-text-green">{simResults.probabilityOfSuccess}%</h2>
                  <p className="text-[9px] text-gray-400">1,000 randomized Monte Carlo simulations exceed milestone.</p>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
