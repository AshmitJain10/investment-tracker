import React, { useState, useEffect } from "react";
import { Coins, HelpCircle, Save, Sparkles, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface GoldSipCardProps {
  sipSummary: {
    checkedDates: string[];
    dailySipAmount: number;
    accumulatedGrams: number;
    totalInvested: number;
    currentValuation: number;
    avgBuyPricePerGram: number;
  } | null;
  onUpdateSip: (checkedDates: string[], dailySipAmount: number) => Promise<void>;
  isLoading: boolean;
}

export default function GoldSipCard({ sipSummary, onUpdateSip, isLoading: parentLoading }: GoldSipCardProps) {
  const [dailyAmount, setDailyAmount] = useState<number>(500);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Sync state with parent updates
  useEffect(() => {
    if (sipSummary) {
      setDailyAmount(sipSummary.dailySipAmount);
    }
  }, [sipSummary]);

  // Compute month details
  const currentMonthName = new Date(currentYear, currentMonth, 1).toLocaleString("default", { month: "long" });

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  // Shift Sunday (0) to end of week (6) or keep standard. Let's make Monday (0) to Sunday (6)
  // Standard Sunday = 0. We want Monday = 1... Sunday = 0
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleToggleDate = async (dayNum: number) => {
    if (!sipSummary) return;

    // Build absolute ISO date string e.g. YYYY-MM-DD
    const dateObj = new Date(currentYear, currentMonth, dayNum);
    
    // Normalize to timezone-agnostic date string split by 'T'
    const dateStr = dateObj.toISOString().split("T")[0];

    let newCheckedDates = [...sipSummary.checkedDates];
    const existsIdx = newCheckedDates.indexOf(dateStr);

    if (existsIdx > -1) {
      newCheckedDates.splice(existsIdx, 1);
    } else {
      newCheckedDates.push(dateStr);
    }

    setIsUpdating(true);
    try {
      await onUpdateSip(newCheckedDates, dailyAmount);
    } catch (e) {
      console.error("Failed to update gold SIP date", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipSummary) return;

    setIsUpdating(true);
    try {
      await onUpdateSip(sipSummary.checkedDates, Number(dailyAmount));
    } catch (e) {
      console.error("Failed to update gold SIP amount", e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Generate calendar cells
  const cells = [];
  
  // Empty offset cells
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`empty-${i}`} className="aspect-square bg-transparent"></div>);
  }

  // Active days of the month
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dateStr = dateObj.toISOString().split("T")[0];
    const isChecked = sipSummary?.checkedDates.includes(dateStr) || false;
    const isFuture = dateObj > today;

    cells.push(
      <button
        key={`day-${d}`}
        type="button"
        disabled={isFuture || isUpdating || parentLoading}
        onClick={() => handleToggleDate(d)}
        className={`aspect-square rounded-lg border text-xs font-bold transition duration-300 flex flex-col items-center justify-between p-1.5 cursor-pointer relative group ${
          isChecked
            ? "bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/5 hover:border-amber-400"
            : isFuture
            ? "bg-gray-900/10 border-gray-900/40 text-gray-600 cursor-not-allowed"
            : "bg-gray-950/30 border-gray-850 text-gray-400 hover:border-amber-500/30 hover:bg-gray-900/30"
        }`}
      >
        <span className="self-start text-[9px]">{d}</span>
        
        {isChecked ? (
          <div className="bg-amber-500/20 rounded-full p-0.5 border border-amber-500/40">
            <Check className="w-2 h-2 text-amber-400" />
          </div>
        ) : !isFuture ? (
          <div className="w-2.5 h-2.5 rounded-full border border-gray-800 group-hover:border-amber-500/40 transition duration-300" />
        ) : null}

        {/* Small tooltip on hover */}
        {!isFuture && (
          <div className="absolute bottom-8 scale-0 group-hover:scale-100 transition duration-200 bg-gray-950 border border-gray-800 text-[8px] text-gray-300 rounded px-1.5 py-0.5 pointer-events-none shadow-xl z-10 whitespace-nowrap">
            {isChecked ? `Invested: ₹${dailyAmount}` : "Click to mark SIP"}
          </div>
        )}
      </button>
    );
  }

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-12 gap-6 glow-border">
      
      {/* Sidebar Info/Stats */}
      <div className="md:col-span-5 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/30 shadow-inner">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Digital Gold SIP</h3>
              <p className="text-[10px] text-gray-500">Track and average your physical/digital gold contributions.</p>
            </div>
          </div>

          {/* Form to change SIP amount */}
          <form onSubmit={handleSaveAmount} className="flex items-center gap-2 mt-4">
            <div className="flex-1">
              <label className="block text-[8px] uppercase font-bold text-gray-500 tracking-wider mb-1">Daily SIP Target (₹)</label>
              <div className="flex items-center bg-gray-950/40 border border-gray-850 hover:border-gray-800 focus-within:border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-white transition duration-300">
                <span className="text-gray-500 font-bold mr-1">₹</span>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={dailyAmount}
                  onChange={(e) => setDailyAmount(Number(e.target.value))}
                  placeholder="500"
                  className="bg-transparent w-full focus:outline-none placeholder-gray-700 font-black text-gray-200"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isUpdating || parentLoading || !sipSummary || dailyAmount === sipSummary.dailySipAmount}
              className="p-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-black rounded-lg text-amber-400 transition duration-300 mt-4 disabled:opacity-30 disabled:hover:bg-amber-500/10 disabled:hover:text-amber-400 cursor-pointer"
              title="Save Daily SIP Amount"
            >
              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>

        {/* Live Accumulation Stats */}
        <div className="bg-gray-950/20 border border-gray-850 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-900/60 pb-2">
            <span className="text-[10px] text-gray-400 font-medium">Accumulated Gold</span>
            <span className="text-xs font-black text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
              {sipSummary ? sipSummary.accumulatedGrams.toFixed(4) : "0.0000"} g
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
            <div>
              <span className="text-[8px] text-gray-500 block uppercase font-bold tracking-wider">SIP Invested</span>
              <span className="font-extrabold text-gray-200">₹{sipSummary ? sipSummary.totalInvested.toLocaleString("en-IN") : "0"}</span>
            </div>
            <div>
              <span className="text-[8px] text-gray-500 block uppercase font-bold tracking-wider">Spot Valuation</span>
              <span className="font-extrabold text-emerald-400">₹{sipSummary ? sipSummary.currentValuation.toLocaleString("en-IN") : "0"}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-gray-900/60 pt-2">
            <div>
              <span className="text-[8px] text-gray-500 block uppercase font-bold tracking-wider">WACB Cost / Gram</span>
              <span className="font-bold text-gray-400">₹{sipSummary && sipSummary.avgBuyPricePerGram > 0 ? sipSummary.avgBuyPricePerGram.toLocaleString("en-IN") : "0"}</span>
            </div>
            <div>
              <span className="text-[8px] text-gray-500 block uppercase font-bold tracking-wider">Days Checked</span>
              <span className="font-bold text-gray-300">{sipSummary ? sipSummary.checkedDates.length : "0"} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="md:col-span-7 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 bg-gray-900 border border-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition duration-200 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider min-w-[110px] text-center">
              {currentMonthName} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 bg-gray-900 border border-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition duration-200 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[8px] bg-gray-900 px-2 py-0.5 rounded border border-gray-850 text-gray-500 font-extrabold uppercase tracking-widest">Averaging Window</span>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
          {daysOfWeek.map((day) => (
            <div key={day} className="py-0.5">{day}</div>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells}
        </div>
      </div>

    </div>
  );
}
