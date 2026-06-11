import React, { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { IndianRupee, Activity, CalendarDays } from "lucide-react";

interface HistoryData {
  month: string;
  amount: number;
}

export default function CapitalDeployedWidget() {
  const [data, setData] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalInvestedLast12M, setTotalInvestedLast12M] = useState(0);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/transactions/history");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          const total = json.data.reduce((sum: number, item: HistoryData) => sum + item.amount, 0);
          setTotalInvestedLast12M(total);
        }
      } catch (err) {
        console.error("Failed to fetch capital deployed history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  // Custom glassmorphic tooltip formatter
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#111827] border border-[#1f2937]/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl text-xs space-y-1">
          <p className="font-semibold text-gray-400 uppercase tracking-wider text-[9px]">{item.month}</p>
          <p className="text-emerald-400 font-bold text-sm">
            ₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-gray-500 text-[8px]">Total Capital Deployed</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="glass-panel p-6 flex flex-col justify-between h-[360px] glow-border animate-pulse items-center justify-center text-indigo-400 text-xs">
        <Activity className="w-8 h-8 animate-spin mb-3" />
        <span>Aggregating historical investment flows...</span>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 flex flex-col justify-between h-[360px] glow-border relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-start justify-between border-b border-gray-850/60 pb-3">
        <div>
          <h3 className="font-extrabold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
            Capital Deployed (Cash Flow)
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Month-wise investment timeline over the last 12 months.</p>
        </div>
        <div className="text-right">
          <span className="text-[8px] uppercase tracking-wider text-gray-500 block">12-Month Total</span>
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
            ₹{totalInvestedLast12M.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex-grow min-h-[200px] mt-4 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} /> {/* Emerald */}
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.15} /> {/* Indigo */}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.25} vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 9, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              tick={{ fill: "#6b7280", fontSize: 8, fontWeight: 500 }}
              dx={-8}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)", radius: 6 }} />
            <Bar
              dataKey="amount"
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill="url(#barGradient)"
                  style={{ filter: "drop-shadow(0px 2px 4px rgba(16,185,129,0.15))" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
