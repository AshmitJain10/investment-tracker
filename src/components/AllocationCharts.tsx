import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Holding } from "@/models/types";

interface ChartsProps {
  holdings: Holding[];
  prices: Record<string, { price: number; changePercent: number; name: string }>;
}

const ASSET_COLORS: Record<string, string> = {
  stock: "#6366f1",        // Indigo
  mutual_fund: "#10b981",  // Emerald
  gold: "#f59e0b",         // Amber
  sgb: "#d97706",          // Darker Amber for SGB
};

const SECTOR_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ef4444", // Rose
  "#14b8a6", // Teal
];

export default function AllocationCharts({ holdings, prices }: ChartsProps) {
  
  // 1. CALCULATE VALUATIONS FOR SPLITS
  let totalValue = 0;
  
  const assetSplitMap: Record<string, number> = {
    stock: 0,
    mutual_fund: 0,
    gold: 0, // Combining gold and sgb under a single "Gold" category
  };

  const sectorMap: Record<string, number> = {};

  for (const h of holdings) {
    const priceInfo = prices[h.symbol];
    const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
    const value = h.quantity * livePrice;

    totalValue += value;

    // Asset Category Grouping
    if (h.type === "stock") {
      assetSplitMap.stock += value;
    } else if (h.type === "mutual_fund") {
      assetSplitMap.mutual_fund += value;
    } else if (h.type === "gold" || h.type === "sgb") {
      assetSplitMap.gold += value;
    }

    // Sector Grouping
    const sector = h.sector || "General";
    sectorMap[sector] = (sectorMap[sector] || 0) + value;
  }

  // 2. FORMAT DATA FOR RECHARTS
  const assetSplitData = [
    { name: "Stocks", value: Number(assetSplitMap.stock.toFixed(2)), type: "stock" },
    { name: "Mutual Funds", value: Number(assetSplitMap.mutual_fund.toFixed(2)), type: "mutual_fund" },
    { name: "Gold & SGBs", value: Number(assetSplitMap.gold.toFixed(2)), type: "gold" },
  ].filter((item) => item.value > 0);

  const sectorData = Object.keys(sectorMap)
    .map((name) => ({
      name,
      value: Number(sectorMap[name].toFixed(2)),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  // Custom tooltips
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : "0.0";
      return (
        <div className="bg-[#111827] border border-[#1f2937] px-3 py-2 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-white">{data.name}</p>
          <p className="text-gray-400 mt-0.5">
            Value: <span className="text-white font-medium">₹{data.value.toLocaleString("en-IN")}</span>
          </p>
          <p className="text-emerald-400 mt-0.5 font-medium">Share: {pct}%</p>
        </div>
      );
    }
    return null;
  };

  if (holdings.length === 0) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center text-center h-[350px]">
        <p className="text-gray-400 text-sm">Add assets to generate portfolio split and sector analysis charts.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* DONUT: ASSET SPLIT */}
      <div className="glass-panel p-5 flex flex-col justify-between h-[380px] glow-border">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Asset Class Split</h3>
          <p className="text-[10px] text-gray-500">Distribution between Stocks, Mutual Funds, and Gold.</p>
        </div>
        <div className="flex-1 min-h-[220px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={assetSplitData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {assetSplitData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ASSET_COLORS[entry.type] || "#374151"} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                formatter={(value) => <span className="text-xs text-gray-300 font-medium">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PIE: SECTOR ALLOCATION */}
      <div className="glass-panel p-5 flex flex-col justify-between h-[380px] glow-border">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Sector Allocation</h3>
          <p className="text-[10px] text-gray-500">Concentration audit across primary industry verticals.</p>
        </div>
        <div className="flex-1 min-h-[220px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {sectorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                formatter={(value) => <span className="text-xs text-gray-300 font-medium truncate max-w-[100px] inline-block align-middle">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
