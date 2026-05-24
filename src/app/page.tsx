"use client";

import React, { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import OverviewPanel from "@/components/OverviewPanel";
import AllocationCharts from "@/components/AllocationCharts";
import HoldingsTable from "@/components/HoldingsTable";
import RebalancingPanel from "@/components/RebalancingPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import AiInsightsPanel from "@/components/AiInsightsPanel";
import AlertsPanel from "@/components/AlertsPanel";
import { Holding, WatchlistItem, PriceAlert, TaxSummary, SipHealthDetails } from "@/models/types";
import { RefreshCw, Newspaper, Sparkles, AlertCircle, Compass, BellRing, User, LogOut, ChevronDown } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "rebalance" | "analytics" | "watchlist" | "ai" | "alerts">("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  // Core portfolio states
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number; name: string }>>({});
  const [histories, setHistories] = useState<Record<string, number[]>>({});

  // Analytics states
  const [rebalanceData, setRebalanceData] = useState<any | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [sipSummary, setSipSummary] = useState<SipHealthDetails[] | null>(null);
  const [newsFeed, setNewsFeed] = useState<any[]>([]);
  const [aiInsightsText, setAiInsightsText] = useState<string | null>(null);

  // 1. UNIFIED BATCH REFRESH PIPELINE
  const refreshAllData = async (showLoading = false) => {
    if (status !== "authenticated") return;
    if (showLoading) setIsLoading(true);
    try {
      // Parallelized Core CRUD fetches
      const [hRes, wRes] = await Promise.all([
        fetch("/api/holdings"),
        fetch("/api/watchlist"),
      ]);

      const hJson = await hRes.json();
      const wJson = await wRes.json();
      
      const currentHoldings = hJson.success ? hJson.data : [];
      setHoldings(currentHoldings);
      
      if (wJson.success) setWatchlist(wJson.data);

      // Hydrate alerts
      try {
        const alRes = await fetch("/api/watchlist?action=alerts");
        const alJson = await alRes.json();
        if (alJson.success) setAlerts(alJson.data);
      } catch (err) {
        // Fallback static alerts
        setAlerts([
          { id: "a1", symbol: "RELIANCE.NS", targetPrice: 3000, condition: "above", active: true, createdAt: new Date().toISOString() }
        ]);
      }

      // Hydrate prices and sparkline history for all holdings in parallel
      if (currentHoldings.length > 0) {
        const resolvedPrices: Record<string, { price: number; changePercent: number; name: string }> = {};
        const resolvedHistories: Record<string, number[]> = {};

        const pricePromises = currentHoldings.map(async (h: Holding) => {
          try {
            const res = await fetch(`/api/market/quote?symbol=${h.symbol}&type=${h.type}`);
            const json = await res.json();
            if (json.success && json.data) {
              resolvedPrices[h.symbol] = {
                price: json.data.price,
                changePercent: json.data.changePercent,
                name: json.data.name,
              };
              resolvedHistories[h.symbol] = json.data.history.map((d: any) => d.close);
            }
          } catch (err) {
            console.warn(`Failed to resolve live pricing for holding ${h.symbol}`);
          }
        });

        await Promise.all(pricePromises);
        setPrices(resolvedPrices);
        setHistories(resolvedHistories);
      }

      // Parallelized Analytics Fetches
      const [rebalRes, taxRes, sipRes, newsRes] = await Promise.all([
        fetch("/api/analytics/rebalance"),
        fetch("/api/analytics/tax"),
        fetch("/api/analytics/sip"),
        fetch("/api/market/news"),
      ]);

      const rebalJson = await rebalRes.json();
      const taxJson = await taxRes.json();
      const sipJson = await sipRes.json();
      const newsJson = await newsRes.json();

      if (rebalJson.success) setRebalanceData(rebalJson.data);
      if (taxJson.success) setTaxSummary(taxJson.data);
      if (sipJson.success) setSipSummary(sipJson.data);
      if (newsJson.success) setNewsFeed(newsJson.data);

    } catch (error) {
      console.error("Critical error inside portfolio hydration pipeline:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      refreshAllData(true);
    }
  }, [status]);

  // 2. CRITICAL CORE CRUD HANDLERS
  
  // HOLDINGS
  const handleAddHolding = async (holdingPayload: any) => {
    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holdingPayload),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      } else {
        alert(`Failed to add asset: ${json.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditHolding = async (id: string, updates: any) => {
    try {
      const res = await fetch("/api/holdings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHolding = async (id: string) => {
    try {
      const res = await fetch(`/api/holdings?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // WATCHLIST
  const handleAddWatchlist = async (symbol: string, name: string, type: "stock" | "mutual_fund" | "gold" | "sgb") => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, name, type }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    try {
      const res = await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // PRICE ALERTS
  const handleAddAlert = async (symbol: string, targetPrice: number, condition: "above" | "below") => {
    try {
      const res = await fetch("/api/watchlist?action=add_alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPrice, condition }),
      });
      const json = await res.json();
      if (json.success) {
        const newAlert: PriceAlert = json.data || {
          id: Math.random().toString(),
          symbol,
          targetPrice,
          condition,
          active: true,
          createdAt: new Date().toISOString(),
        };
        setAlerts((prev) => [newAlert, ...prev]);
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/watchlist?action=delete_alert&id=${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissAlert = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: false } : a))
    );
    try {
      await fetch("/api/watchlist?action=update_alert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: false }),
      });
    } catch (e) {
      console.warn("Deactivation sync failed.");
    }
  };

  // REBALANCING MATRIX
  const handleUpdateTargets = async (stock: number, mutual_fund: number, gold: number) => {
    try {
      const res = await fetch("/api/analytics/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock, mutual_fund, gold }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAllData(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // MONTE CARLO
  const handleRunMonteCarlo = async (target: number, years: number, sip: number) => {
    try {
      const res = await fetch(`/api/analytics/monte-carlo?targetAmount=${target}&years=${years}&monthlyContribution=${sip}`);
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // AI ADVISOR INSIGHTS
  const handleRefreshInsights = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/ai/insights", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setAiInsightsText(json.data);
        return json.data;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // CSV MASS IMPORT
  const handleCsvImport = async (importedHoldings: Holding[]) => {
    try {
      setIsLoading(true);
      const importPromises = importedHoldings.map((h) =>
        fetch("/api/holdings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: h.symbol,
            name: h.name,
            type: h.type,
            currency: h.currency,
            quantity: h.quantity,
            buyPrice: h.buyPrice,
            buyDate: h.buyDate,
            sector: h.sector,
          }),
        })
      );
      
      await Promise.all(importPromises);
      await refreshAllData(false);
    } catch (err) {
      console.error("CSV import process aborted", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== AUTH LEVEL LOADING STATE ====================
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center text-indigo-400 font-sans">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-900/40"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 animate-spin"></div>
        </div>
        <span className="text-xs mt-6 tracking-widest uppercase text-gray-500 animate-pulse font-bold">
          Validating Secure Session...
        </span>
      </div>
    );
  }

  // ==================== STUNNING ONBOARDING LANDING PAGE ====================
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#050811] bg-gradient-to-br from-[#050811] via-[#091122] to-[#040810] text-[#f3f4f6] font-sans flex flex-col items-center justify-between p-6 overflow-x-hidden selection:bg-indigo-500 selection:text-white relative">
        {/* Ambient Decorative Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>

        {/* HEADER */}
        <header className="w-full max-w-7xl flex items-center justify-between border-b border-gray-900/60 pb-5 pt-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-white text-base">
              A
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight uppercase">Antigravity</span>
          </div>
          <button
            onClick={() => signIn("google")}
            className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl smooth-transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            Sign In
          </button>
        </header>

        {/* HERO SECTION */}
        <main className="w-full max-w-4xl text-center py-16 space-y-8 relative z-10 my-auto">
          <div className="space-y-4">
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-extrabold px-3 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest inline-block">
              Multi-Tenant Portfolio Suite
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
              Sophisticated Portfolio <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Intelligence</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
              Track equities, mutual funds, digital gold, and Sovereign Gold Bonds (SGBs) in real-time. Power your wealth management with CAGR/XIRR, Monte Carlo risk path projections, automated tax harvesting, and LLM advisory insights.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-3 px-6 py-4 bg-gray-950/40 border border-gray-800 hover:border-indigo-500/40 hover:bg-gray-900/60 rounded-2xl smooth-transition shadow-xl text-sm font-extrabold text-white cursor-pointer group hover:shadow-indigo-500/5"
            >
              <svg className="w-5 h-5 shrink-0 group-hover:scale-110 smooth-transition" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38C16.88,15.82,14.7,17.1,12,17.1c-3.59,0-6.5-2.91-6.5-6.5S8.41,4.1,12,4.1c1.62,0,3.09,0.6,4.24,1.58l2-2C16.32,2.02,14.28,1.1,12,1.1C6.48,1.1,2,5.58,2,11.1s4.48,10,10,10c5.78,0,9.7-4.06,9.7-9.8C21.7,10.68,21.5,10.6,21.35,11.1z" fill="#EA4335" />
                  <path d="M12,4.1c1.62,0,3.09,0.6,4.24,1.58l2-2C16.32,2.02,14.28,1.1,12,1.1C6.48,1.1,2,5.58,2,11.1s4.48,10,10,10c5.78,0,9.7-4.06,9.7-9.8C21.7,10.68,21.5,10.6,21.35,11.1z" fill="#4285F4" />
                  <path d="M12,4.1c1.62,0,3.09,0.6,4.24,1.58l2-2C16.32,2.02,14.28,1.1,12,1.1C6.48,1.1,2,5.58,2,11.1s4.48,10,10,10c5.78,0,9.7-4.06,9.7-9.8C21.7,10.68,21.5,10.6,21.35,11.1z" fill="#FBBC05" />
                  <path d="M12,4.1c1.62,0,3.09,0.6,4.24,1.58l2-2C16.32,2.02,14.28,1.1,12,1.1C6.48,1.1,2,5.58,2,11.1s4.48,10,10,10c5.78,0,9.7-4.06,9.7-9.8C21.7,10.68,21.5,10.6,21.35,11.1z" fill="#34A853" />
                </g>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* BENTO GRID FEATURES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto pt-10 text-left">
            <div className="glass-panel p-5 glow-border space-y-2 rounded-2xl hover:border-indigo-500/20 smooth-transition">
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">01 • Core Analytics</span>
              <h3 className="font-extrabold text-white text-sm">Institutional Valuations</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Calculates precise asset valuations, currency exchange adjustments, CAGR metrics, and sector weighting ratios across domestic and international assets.
              </p>
            </div>
            
            <div className="glass-panel p-5 glow-border space-y-2 rounded-2xl hover:border-indigo-500/20 smooth-transition">
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">02 • Volatility Projections</span>
              <h3 className="font-extrabold text-white text-sm">Monte Carlo Simulations</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Simulates 1,000 distinct geometric Brownian motion paths using historical asset volatility to project the exact probability of hitting capital targets.
              </p>
            </div>

            <div className="glass-panel p-5 glow-border space-y-2 rounded-2xl hover:border-indigo-500/20 smooth-transition">
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">03 • Taxation & Auditing</span>
              <h3 className="font-extrabold text-white text-sm">Capital Gains Tax & Harvesting</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Tracks long-term and short-term capital gains tax rates dynamically. Highlights specific opportunities to harvest capital losses and save money.
              </p>
            </div>

            <div className="glass-panel p-5 glow-border space-y-2 rounded-2xl hover:border-indigo-500/20 smooth-transition">
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">04 • Artificial Intelligence</span>
              <h3 className="font-extrabold text-white text-sm">LLM Portfolio Advisor</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Launches deep audits on sector concentration, rebalancing recommendations, and target drifts, generating highly-personalized action reports instantly.
              </p>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="w-full max-w-7xl border-t border-gray-950/60 pt-6 pb-2 text-center text-[10px] text-gray-600 relative z-10">
          <span>&copy; {new Date().getFullYear()} Antigravity Portfolio Analytics. Encrypted multi-tenant architecture.</span>
        </footer>
      </div>
    );
  }

  // ==================== PROTECTED AUTHENTICATED DASHBOARD ====================
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#090d16] text-[#f3f4f6]">
      
      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        numberOfHoldings={holdings.length}
      />

      {/* CORE CONTENT LAYOUT */}
      <main className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* HEADER BAR */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-850/60 pb-5">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Financial Analysis Desk
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                App Router
              </span>
            </h2>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
              Reactive CRUD, multi-currency isolated engine, and institutional statistics
            </p>
          </div>

          {/* Action Tools & User Profile Dropdown */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => refreshAllData(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 font-semibold rounded-xl smooth-transition cursor-pointer w-fit"
              title="Refresh Portfolio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 hover:bg-gray-850 hover:border-gray-700 text-gray-300 font-bold rounded-xl smooth-transition cursor-pointer w-fit"
              >
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className="w-5 h-5 rounded-full border border-indigo-500/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="text-xs max-w-[100px] truncate hidden md:inline">{session?.user?.name || "User"}</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {dropdownOpen && (
                <>
                  {/* Backdrop shield to close click-away */}
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                  
                  <div className="absolute right-0 mt-2 w-52 bg-[#0c1220]/95 border border-gray-800 rounded-xl shadow-2xl p-4 space-y-2.5 z-50 backdrop-blur-md animate-fadeIn">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Logged in as</span>
                      <div className="text-xs font-black text-white truncate">
                        {session?.user?.name || "User"}
                      </div>
                      <div className="text-[10px] text-indigo-400 truncate">
                        {session?.user?.email}
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-850/60 my-2"></div>
                    
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center gap-2 w-full text-left px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg smooth-transition font-bold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* LOADING INDICATOR PANEL */}
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20 text-indigo-400 text-xs animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin mb-3" />
            <span>Resolving isolated asset valuations, converting Forex cost bases, and preparing calculations...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* ==================== TAB 1: OVERVIEW DASHBOARD ==================== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 1. Metric widgets */}
                <OverviewPanel
                  holdings={holdings}
                  prices={prices}
                  alerts={alerts}
                  onDismissAlert={handleDismissAlert}
                />

                {/* 2. Recharts donut split / sector allocation */}
                <AllocationCharts
                  holdings={holdings}
                  prices={prices}
                />

                {/* 3. CRUD Holdings Table */}
                <HoldingsTable
                  holdings={holdings}
                  prices={prices}
                  histories={histories}
                  onAddHolding={handleAddHolding}
                  onEditHolding={handleEditHolding}
                  onDeleteHolding={handleDeleteHolding}
                  onCsvImport={handleCsvImport}
                />

                {/* 4. REAL-TIME TAILORED PORTFOLIO NEWS FEED */}
                <section className="glass-panel p-5 space-y-4 glow-border">
                  <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                    <Newspaper className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Tailored News feed</h4>
                      <p className="text-[10px] text-gray-500">Real-time market updates curated for tickers in your portfolio.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {newsFeed.length === 0 ? (
                      <p className="text-xs text-gray-500 col-span-2 text-center py-4">No active news feeds detected for your current assets.</p>
                    ) : (
                      newsFeed.map((art) => (
                        <div key={art.uuid} className="bg-gray-950/20 border border-gray-850 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-gray-800 smooth-transition">
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-extrabold block">
                              {art.publisher} • {new Date(art.providerPublishTime).toLocaleDateString()}
                            </span>
                            <h5 className="font-bold text-gray-200 text-xs leading-relaxed hover:text-white smooth-transition">
                              {art.title}
                            </h5>
                            <p className="text-[10px] text-gray-400 leading-relaxed truncate-3-lines mt-1">
                              {art.summary}
                            </p>
                          </div>
                          
                          {art.relatedTickers && art.relatedTickers.length > 0 && (
                            <div className="pt-2 flex items-center justify-between border-t border-gray-900/60 mt-3">
                              <span className="text-[8px] bg-gray-900 px-2 py-0.5 rounded border border-gray-850 text-gray-400 font-bold uppercase">
                                {art.relatedTickers[0]}
                              </span>
                              <a
                                href={art.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold underline"
                              >
                                Read Article &rarr;
                              </a>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

              </div>
            )}

            {/* ==================== TAB 2: REBALANCING MATRIX ==================== */}
            {activeTab === "rebalance" && (
              <div className="animate-fadeIn">
                <RebalancingPanel
                  rebalanceData={rebalanceData}
                  onUpdateTargets={handleUpdateTargets}
                />
              </div>
            )}

            {/* ==================== TAB 3: ADVANCED ANALYTICS ==================== */}
            {activeTab === "analytics" && (
              <div className="animate-fadeIn">
                <AnalyticsPanel
                  taxSummary={taxSummary}
                  sipSummary={sipSummary}
                  onRunMonteCarlo={handleRunMonteCarlo}
                />
              </div>
            )}

            {/* ==================== TAB 4: WATCHLIST & TECHNICALS ==================== */}
            {activeTab === "watchlist" && (
              <div className="animate-fadeIn">
                <WatchlistPanel
                  watchlist={watchlist}
                  prices={prices}
                  onAddWatchlist={handleAddWatchlist}
                  onDeleteWatchlist={handleDeleteWatchlist}
                />
              </div>
            )}

            {/* ==================== TAB 5: AI ADVISOR INSIGHTS ==================== */}
            {activeTab === "ai" && (
              <div className="animate-fadeIn">
                <AiInsightsPanel
                  insights={aiInsightsText}
                  onRefreshInsights={handleRefreshInsights}
                />
              </div>
            )}

            {/* ==================== TAB 6: PRICE TARGET ALERTS ==================== */}
            {activeTab === "alerts" && (
              <div className="animate-fadeIn">
                <AlertsPanel
                  alerts={alerts}
                  prices={prices}
                  onAddAlert={handleAddAlert}
                  onDeleteAlert={handleDeleteAlert}
                />
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
