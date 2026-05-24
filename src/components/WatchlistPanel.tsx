import React, { useState, useEffect } from "react";
import { Plus, Trash2, Search, X, Sparkles, TrendingUp, TrendingDown, Eye, Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { WatchlistItem } from "@/models/types";

interface WatchlistProps {
  watchlist: WatchlistItem[];
  prices: Record<string, { price: number; changePercent: number; name: string }>;
  onAddWatchlist: (symbol: string, name: string, type: "stock" | "mutual_fund" | "gold" | "sgb") => Promise<void>;
  onDeleteWatchlist: (id: string) => Promise<void>;
}

export default function WatchlistPanel({
  watchlist,
  prices,
  onAddWatchlist,
  onDeleteWatchlist,
}: WatchlistProps) {
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  // Selected Watchlist Item Details (Clicking reveals a 90-day chart + indicators)
  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);
  const [technicalDetails, setTechnicalDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Auto trigger details fetch when item is clicked
  useEffect(() => {
    if (selectedItem) {
      handleFetchItemDetails(selectedItem);
    } else if (watchlist.length > 0) {
      setSelectedItem(watchlist[0]); // default select first item
    }
  }, [selectedItem, watchlist]);

  const handleFetchItemDetails = async (item: WatchlistItem) => {
    setIsLoadingDetails(true);
    setQuoteDetails(null);
    setTechnicalDetails(null);
    try {
      // 1. Fetch Quote & 90-day history
      const qRes = await fetch(`/api/market/quote?symbol=${item.symbol}&type=${item.type}`);
      const qJson = await qRes.json();
      
      // 2. Fetch Algorithmic Technical Indicators
      const tRes = await fetch(`/api/market/indicators?symbol=${item.symbol}&type=${item.type}`);
      const tJson = await tRes.json();

      if (qJson.success) setQuoteDetails(qJson.data);
      if (tJson.success) setTechnicalDetails(tJson.data);
    } catch (err) {
      console.error("Failed to load details for watchlist item", item.symbol, err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // 1. WATCHLIST TICKER AUTO-COMPLETE SEARCH
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setSearchResults(json.data);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error("Autocomplete failed in watchlist search", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleAddTrackedAsset = async (asset: any) => {
    await onAddWatchlist(asset.symbol, asset.name, asset.type);
    setShowAddModal(false);
    setSearchQuery("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1: WATCHLIST LEDGER */}
      <div className="glass-panel p-5 flex flex-col justify-between h-[450px] glow-border">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-4 h-4 text-emerald-400" /> Watchlist
            </h3>
            <p className="text-[10px] text-gray-500">Track and inspect technical price movements.</p>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-bold smooth-transition cursor-pointer shadow-lg shadow-emerald-500/10"
            title="Track New Asset"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* WATCHLIST LEDGER LIST */}
        <div className="flex-1 my-3 space-y-2.5 overflow-y-auto pr-1">
          {watchlist.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">Your watchlist is empty. Click "+" to track an asset.</p>
          ) : (
            watchlist.map((item) => {
              const priceInfo = prices[item.symbol];
              const livePrice = priceInfo ? priceInfo.price : 0;
              const changePct = priceInfo ? priceInfo.changePercent : 0;
              const isSelected = selectedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`border p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer smooth-transition ${
                    isSelected 
                      ? "bg-indigo-950/20 border-indigo-500/35" 
                      : "bg-gray-950/20 border-gray-850 hover:bg-gray-900/20"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white text-xs">{item.symbol}</div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{item.name}</div>
                  </div>
                  
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {livePrice > 0 ? (
                      <div>
                        <div className="font-bold text-gray-200 text-xs">
                          ₹{livePrice.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[9px] font-semibold mt-0.5 flex items-center justify-end gap-0.5 ${changePct >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                          {changePct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500 font-semibold">Live NAV</span>
                    )}

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Stop tracking ${item.symbol}?`)) {
                          await onDeleteWatchlist(item.id);
                          if (selectedItem?.id === item.id) setSelectedItem(null);
                        }
                      }}
                      className="p-1 hover:bg-rose-500/10 border border-transparent rounded hover:border-rose-500/20 text-gray-500 hover:text-rose-500 smooth-transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2 & 3: DETAIL CHART & ALGORITHMIC INDICATORS */}
      <div className="glass-panel lg:col-span-2 p-5 flex flex-col justify-between h-[450px] glow-border relative">
        {!selectedItem ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 text-sm">
            <Eye className="w-8 h-8 text-gray-600 mb-2" /> Select an asset on the left watchlist ledger to inspect historical trends and RSI indicators.
          </div>
        ) : isLoadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-indigo-400 text-xs animate-pulse">
            <Activity className="w-8 h-8 animate-spin mb-2" /> Resolving market quotes & algorithmic indicators...
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between h-full space-y-4">
            
            {/* ITEM DETAILS HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-900 pb-3">
              <div>
                <h4 className="font-extrabold text-white text-base flex items-center gap-1.5">
                  {selectedItem.symbol}
                  {technicalDetails?.signal && (
                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                      technicalDetails.signal === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      technicalDetails.signal === "WAIT" ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                      "bg-gray-800 text-gray-400 border border-gray-700"
                    }`}>
                      {technicalDetails.signal}
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedItem.name}</p>
              </div>

              {quoteDetails && (
                <div className="flex gap-4 text-xs">
                  <div className="bg-gray-950/20 px-3 py-1.5 rounded-lg border border-gray-850">
                    <span className="text-[9px] text-gray-500 block font-semibold">52-WEEK LOW</span>
                    <span className="font-bold text-gray-300">₹{quoteDetails.fiftyTwoWeekLow.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
                  </div>
                  <div className="bg-gray-950/20 px-3 py-1.5 rounded-lg border border-gray-850">
                    <span className="text-[9px] text-gray-500 block font-semibold">52-WEEK HIGH</span>
                    <span className="font-bold text-gray-300">₹{quoteDetails.fiftyTwoWeekHigh.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* CHART VIEW */}
            <div className="flex-1 min-h-[170px] flex items-center justify-center">
              {quoteDetails?.history && quoteDetails.history.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={quoteDetails.history} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                    <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} />
                    <YAxis 
                      stroke="#4b5563" 
                      fontSize={9} 
                      tickLine={false}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
                      formatter={(v: any) => [`₹${v.toLocaleString("en-IN")}`, "Price"]}
                    />
                    <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-gray-500">History unavailable for gold indexes</span>
              )}
            </div>

            {/* ALGORITHMIC INDICATORS FOOTER */}
            {technicalDetails && (
              <div className="bg-gray-950/40 border border-gray-850 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                
                {/* INDICATORS STATS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <span className="text-[9px] text-gray-500 block font-semibold uppercase">Wilder's RSI (14)</span>
                    <span className={`font-bold ${
                      technicalDetails.rsi14 < 30 ? "text-emerald-400 glow-text-green" :
                      technicalDetails.rsi14 > 70 ? "text-rose-500 glow-text-red" : "text-gray-200"
                    }`}>
                      {technicalDetails.rsi14}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block font-semibold uppercase">SMA 20</span>
                    <span className="font-bold text-gray-300">₹{technicalDetails.sma20.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block font-semibold uppercase">SMA 50</span>
                    <span className="font-bold text-gray-300">₹{technicalDetails.sma50.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block font-semibold uppercase">SMA 200</span>
                    <span className="font-bold text-gray-300">₹{technicalDetails.sma200.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {/* ALGORITHMIC TEXT INTERPRETATION */}
                <div className="md:w-1/3 shrink-0 flex gap-2 items-start text-[10px] text-gray-400 bg-gray-900 border border-gray-850 p-2.5 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p>{technicalDetails.description}</p>
                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {/* SEARCH AND ADD TRACKED ASSET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-sm p-6 relative bg-gray-950/90 border border-gray-800/80 rounded-2xl shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white smooth-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-4">Track Market Asset</h3>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Search Ticker or AMFI Code</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white">
                  <Search className="w-4 h-4 text-gray-500 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. RELIANCE, MSFT, HDFC fund..."
                    className="bg-transparent flex-1 focus:outline-none placeholder-gray-600"
                    required
                  />
                </div>
                {/* Suggestions auto dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute inset-x-0 top-[52px] z-50 bg-gray-900 border border-gray-800 rounded-lg max-h-40 overflow-y-auto shadow-2xl text-xs divide-y divide-gray-800">
                    {searchResults.map((asset) => (
                      <div
                        key={asset.symbol}
                        onClick={() => handleAddTrackedAsset(asset)}
                        className="p-2.5 hover:bg-gray-800 cursor-pointer flex justify-between gap-2 smooth-transition"
                      >
                        <div className="font-bold text-white shrink-0">{asset.symbol}</div>
                        <div className="text-gray-400 truncate text-[10px] text-right">{asset.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
