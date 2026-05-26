import React from "react";
import { LayoutDashboard, Scale, Landmark, Eye, Sparkles, BellRing, TrendingUp } from "lucide-react";

interface SidebarProps {
  activeTab: "dashboard" | "rebalance" | "analytics" | "watchlist" | "ai" | "alerts" | "ai-baskets";
  setActiveTab: (tab: "dashboard" | "rebalance" | "analytics" | "watchlist" | "ai" | "alerts" | "ai-baskets") => void;
  numberOfHoldings: number;
}

export default function Sidebar({ activeTab, setActiveTab, numberOfHoldings }: SidebarProps) {
  
  const menuItems = [
    {
      id: "dashboard" as const,
      label: "Portfolio Overview",
      icon: LayoutDashboard,
      description: "Asset list, value charts & metrics",
    },
    {
      id: "rebalance" as const,
      label: "Rebalancing Engine",
      icon: Scale,
      description: "Drift targets and buy/sell advice",
    },
    {
      id: "analytics" as const,
      label: "Advanced Analytics",
      icon: Landmark,
      description: "Tax harvesting, SIP and Monte Carlo",
    },
    {
      id: "watchlist" as const,
      label: "Watchlist & Technicals",
      icon: Eye,
      description: "SMA/RSI signals and 90-day charts",
    },
    {
      id: "ai" as const,
      label: "AI Advisor insights",
      icon: Sparkles,
      description: "Full LLM diagnostic reports",
    },
    {
      id: "ai-baskets" as const,
      label: "AI Basket Scorer",
      icon: Sparkles,
      description: "Danelfin-style basket audits",
    },
    {
      id: "alerts" as const,
      label: "Price Target Alerts",
      icon: BellRing,
      description: "Custom target threshold alerts",
    },
  ];

  return (
    <div className="w-full lg:w-64 shrink-0 bg-[#0c101a] border-r lg:border-r-gray-850/60 border-b lg:border-b-transparent border-gray-800 p-5 flex flex-col justify-between h-auto lg:h-screen lg:sticky lg:top-0">
      
      {/* HEADER LOGO */}
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/25 shadow-lg shadow-emerald-500/5 animate-pulse">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-black text-white tracking-wider text-sm uppercase">INVESTMENT TRACKER</h1>
            <span className="text-[8px] uppercase tracking-widest text-emerald-400 font-bold block mt-0.5">Institutional Engine</span>
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="space-y-1.5 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible pb-2.5 lg:pb-0 gap-1.5 lg:gap-0 shrink-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-60 lg:w-full shrink-0 smooth-transition cursor-pointer ${
                  isActive 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold" 
                    : "border border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/30"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-gray-400"}`} />
                <div className="min-w-0">
                  <div className="text-xs">{item.label}</div>
                  <span className="text-[8px] text-gray-500 font-semibold block mt-0.5 hidden lg:block uppercase tracking-wider">{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* FOOTER METRICS */}
      <div className="hidden lg:block border-t border-gray-850/60 pt-4 text-[10px] text-gray-500">
        <div className="flex justify-between">
          <span>Active Holdings:</span>
          <span className="font-bold text-gray-300">{numberOfHoldings}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Local Engine:</span>
          <span className="font-bold text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> Reactive Connected
          </span>
        </div>
      </div>

    </div>
  );
}
