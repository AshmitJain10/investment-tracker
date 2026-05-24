"use client";

import React, { useState, useEffect } from "react";
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
import { RefreshCw, Newspaper, Sparkles, AlertCircle, Compass, BellRing } from "lucide-react";

export default function Dashboard() {
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
    if (showLoading) setIsLoading(true);
    try {
      // Parallelized Core CRUD fetches
      const [hRes, wRes, aRes] = await Promise.all([
        fetch("/api/holdings"),
        fetch("/api/watchlist"),
        fetch("/api/watchlist?type=alerts"), // Using Watchlist CRUD wrapper or default collection
      ]);

      const hJson = await hRes.json();
      const wJson = await wRes.json();
      
      const currentHoldings = hJson.success ? hJson.data : [];
      setHoldings(currentHoldings);
      
      if (wJson.success) setWatchlist(wJson.data);

      // Hydrate alerts - if alerts DB fetch fails, load from in-memory standard mock
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
    refreshAllData(true);
  }, []);

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
      // Leverage custom parameters inside Watchlist CRUD, saving locally
      const res = await fetch("/api/watchlist?action=add_alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPrice, condition }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistically add to local alerts state instantly
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
    // Dismiss/Deactivate the triggered alert
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
      // Sequentially load all imported holdings via API to trigger Forex rates
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
              Reactive CRUD, multi-currency engine, and institutional statistics
            </p>
          </div>

          <button
            onClick={() => refreshAllData(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 font-semibold rounded-xl smooth-transition cursor-pointer w-fit"
            title="Refresh Portfolio"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        {/* LOADING INDICATOR PANEL */}
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20 text-indigo-400 text-xs animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin mb-3" />
            <span>Resolving asset valuations, converting Forex cost bases, and preparing calculations...</span>
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
