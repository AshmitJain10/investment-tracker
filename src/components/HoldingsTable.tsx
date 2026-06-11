import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, Search, X, Calendar, Download, Upload, History, Save, RefreshCw } from "lucide-react";
import { Holding } from "@/models/types";

interface TableProps {
  holdings: Holding[];
  prices: Record<string, { price: number; changePercent: number; name: string }>;
  histories: Record<string, number[]>; // 90-day price trends for sparklines
  onAddHolding: (holding: any) => Promise<void>;
  onEditHolding: (id: string, updates: any) => Promise<void>;
  onDeleteHolding: (id: string) => Promise<void>;
  onCsvImport?: (holdings: Holding[]) => Promise<void>;
}

// Lightweight Inline SVG Sparkline Renderer
function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return <span className="text-gray-500 text-[10px]">No trend</span>;
  
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const svgPoints = points
    .map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - 1 - ((p - min) / range) * (height - 2); // padding buffer
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = points[points.length - 1] >= points[0];

  return (
    <div className="flex items-center justify-center">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={isUp ? "#10b981" : "#ef4444"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
      </svg>
    </div>
  );
}

export default function HoldingsTable({
  holdings,
  prices,
  histories,
  onAddHolding,
  onEditHolding,
  onDeleteHolding,
  onCsvImport,
}: TableProps) {
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  // Transaction History Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [txModalAsset, setTxModalAsset] = useState<Holding | null>(null);
  const [assetTransactions, setAssetTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  
  // Inline edit states
  const [editDate, setEditDate] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Form states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState("");
  const [sector, setSector] = useState("General");
  const [assetType, setAssetType] = useState<"stock" | "mutual_fund" | "gold" | "sgb">("stock");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [customName, setCustomName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. DYNAMIC TICKER SEARCH AUTO-COMPLETE
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
        console.error("Failed to autocomplete tickers", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Select item from search autocomplete
  const handleSelectAsset = (asset: any) => {
    setSelectedAsset(asset);
    setSearchQuery(asset.symbol);
    setAssetType(asset.type);
    setShowSearchDropdown(false);
    
    // Autofill name and currency
    setCustomName(asset.name);
    if (asset.symbol.endsWith(".NS") || asset.exchange === "AMFI" || asset.type === "gold" || asset.type === "sgb") {
      setCurrency("INR");
    } else {
      setCurrency("USD"); // Bypass Indian format for standard US stock matches
    }
  };

  const handleOpenAddModal = () => {
    // Reset inputs
    setSearchQuery("");
    setSelectedAsset(null);
    setQuantity("");
    setBuyPrice("");
    setBuyDate(new Date().toISOString().split("T")[0]);
    setSector("General");
    setAssetType("stock");
    setCurrency("INR");
    setCustomName("");
    setShowAddModal(true);
  };

  const handleOpenEditModal = (h: Holding) => {
    setSelectedHolding(h);
    setQuantity(String(h.quantity));
    setBuyPrice(String(h.buyPrice));
    setBuyDate(h.buyDate);
    setSector(h.sector);
    setAssetType(h.type);
    setCurrency(h.currency);
    setShowEditModal(true);
  };

  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || !quantity || !buyPrice || !buyDate) return;

    const payload = {
      symbol: searchQuery.toUpperCase(),
      name: customName || selectedAsset?.name || searchQuery,
      type: assetType,
      currency,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      buyDate,
      sector,
    };

    await onAddHolding(payload);
    setShowAddModal(false);
  };

  const handleUpdateHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) return;

    const updates = {
      id: selectedHolding.id,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      buyDate,
      sector,
      currency,
    };

    await onEditHolding(selectedHolding.id, updates);
    setShowEditModal(false);
  };

  // Transaction History Modal Handlers
  const fetchTransactions = async (symbol: string) => {
    try {
      setTxLoading(true);
      const res = await fetch(`/api/transactions/${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setAssetTransactions(json.data);
        if (json.data.length === 0) {
          setShowTxModal(false);
        }
      }
    } catch (err) {
      console.error("Failed to load asset transactions:", err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleOpenTxModal = (h: Holding) => {
    setTxModalAsset(h);
    setShowTxModal(true);
    setEditingTxId(null);
    fetchTransactions(h.symbol);
  };

  const handleStartInlineEdit = (tx: any) => {
    setEditingTxId(tx.id);
    setEditDate(tx.buyDate);
    setEditQuantity(String(tx.quantity));
    setEditPrice(String(tx.buyPrice));
  };

  const handleSaveInlineEdit = async (tx: any) => {
    if (!editDate || !editQuantity || !editPrice) return;
    try {
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.id,
          buyDate: editDate,
          quantity: Number(editQuantity),
          buyPrice: Number(editPrice),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingTxId(null);
        await fetchTransactions(tx.symbol);
        await onEditHolding(txModalAsset!.id, {}); // Trigger parent refresh
      } else {
        alert(`Failed to save transaction: ${json.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!confirm("Are you sure you want to delete this purchase transaction?")) return;
    try {
      const res = await fetch(`/api/transactions?id=${tx.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchTransactions(tx.symbol);
        await onEditHolding(txModalAsset!.id, {}); // Trigger parent refresh
      } else {
        alert(`Failed to delete transaction: ${json.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CSV EXPORT
  const handleExportCSV = () => {
    if (holdings.length === 0) return;
    
    const headers = ["Symbol", "Name", "Type", "Currency", "Quantity", "BuyPrice", "BuyDate", "ExchangeRate", "Sector"];
    const rows = holdings.map((h) => [
      h.symbol,
      `"${h.name.replace(/"/g, '""')}"`,
      h.type,
      h.currency,
      h.quantity,
      h.buyPrice,
      h.buyDate,
      h.exchangeRate,
      h.sector,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `InvestmentTracker_Backup_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV IMPORT
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length < 2) return;

        // Simple CSV Parser
        const importedList: Holding[] = [];
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        
        for (let i = 1; i < lines.length; i++) {
          // Splitting by comma but avoiding comma in double quotes (e.g. for company names)
          const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
          if (cols.length < headers.length) continue;

          const h: any = {};
          headers.forEach((header, idx) => {
            const rawVal = cols[idx].trim().replace(/^"|"$/g, "");
            if (header === "Quantity" || header === "BuyPrice" || header === "ExchangeRate") {
              h[header.toLowerCase()] = Number(rawVal);
            } else {
              h[header.toLowerCase()] = rawVal;
            }
          });
          
          importedList.push(h as Holding);
        }

        if (onCsvImport && importedList.length > 0) {
          await onCsvImport(importedList);
          alert(`Successfully imported ${importedList.length} holdings!`);
        }
      } catch (err) {
        alert("Failed to parse CSV backup file. Please verify schema headers.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full space-y-4">
      
      {/* TABLE METRICS HEADER AND TRIGGERS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider">Active Assets Portfolio</h3>
          <p className="text-[10px] text-gray-500">Comprehensive breakdown of active stocks, mutual funds, and SGBs.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* CSV Import Hidden Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-300 font-semibold smooth-transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-300 font-semibold smooth-transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-bold smooth-transition cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-3.5 h-3.5" /> Add Asset
          </button>
        </div>
      </div>

      {/* HOLDINGS TABLE VIEW */}
      <div className="glass-panel overflow-x-auto w-full glow-border">
        {holdings.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Your portfolio is currently empty. Click "Add Asset" to record your first transaction!
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-950/40 border-b border-gray-800 text-gray-400 font-semibold tracking-wider uppercase">
                <th className="p-4">Ticker / Name</th>
                <th className="p-4 hidden md:table-cell">Category</th>
                <th className="p-4 text-right">Shares</th>
                <th className="p-4 text-right hidden sm:table-cell">Avg Buy</th>
                <th className="p-4 text-right">Spot Price</th>
                <th className="p-4 text-right">Day Change</th>
                <th className="p-4 text-right">Valuation</th>
                <th className="p-4 text-right">Returns (P&L)</th>
                <th className="p-4 text-center hidden lg:table-cell">90-Day Trend</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {holdings.map((h) => {
                const priceInfo = prices[h.symbol];
                const livePrice = priceInfo ? priceInfo.price : h.buyPrice * h.exchangeRate;
                const changePct = priceInfo ? priceInfo.changePercent : 0;

                 const buyPriceINR = h.buyPrice * h.exchangeRate;
                const currentValue = h.quantity * livePrice;
                const investedValue = h.quantity * buyPriceINR;
                
                const pnl = currentValue - investedValue;
                const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
                const dayChangeINR = currentValue * (changePct / 100);

                const historyTrend = histories[h.symbol] || [];

                return (
                  <tr key={h.id} className="hover:bg-gray-900/30 smooth-transition">
                    <td className="p-4">
                      <button
                        onClick={() => handleOpenTxModal(h)}
                        className="text-left focus:outline-none cursor-pointer group"
                      >
                        <div className="font-bold text-white text-sm group-hover:text-emerald-400 smooth-transition flex items-center gap-1">
                          {h.symbol}
                        </div>
                        <div className="text-gray-400 max-w-[150px] md:max-w-[200px] truncate text-[10px] mt-0.5 group-hover:text-gray-300 smooth-transition">
                          {h.name}
                        </div>
                      </button>
                    </td>
                    <td className="p-4 hidden md:table-cell uppercase font-semibold text-[10px] tracking-wider text-gray-500">
                      {h.type === "mutual_fund" ? "Mutual Fund" : h.type}
                    </td>
                    <td className="p-4 text-right font-medium text-gray-200">
                      {h.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-4 text-right hidden sm:table-cell text-gray-400">
                      ₹{buyPriceINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {h.currency === "USD" && (
                        <span className="block text-[8px] text-gray-500">
                          ${h.buyPrice.toFixed(2)} @ {h.exchangeRate.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right text-gray-200">
                      ₹{livePrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`p-4 text-right font-medium ${dayChangeINR >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                      {dayChangeINR >= 0 ? "+" : ""}₹{dayChangeINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="block text-[9px] font-semibold mt-0.5">
                        {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-white">
                      ₹{currentValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`p-4 text-right font-bold ${pnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                      {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      <span className="block text-[9px] font-semibold mt-0.5">
                        {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-center">
                      <Sparkline points={historyTrend} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenTxModal(h)}
                          className="p-1.5 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 text-indigo-400 hover:text-white smooth-transition cursor-pointer"
                          title="Transaction History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Remove transaction for ${h.symbol}?`)) {
                              await onDeleteHolding(h.id);
                            }
                          }}
                          className="p-1.5 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 text-rose-500 hover:text-white smooth-transition cursor-pointer"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL 1: ADD ASSET TRANSACTION */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-md p-6 relative bg-gray-950/90 border border-gray-800/80 rounded-2xl shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white smooth-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Record Asset Purchase</h3>
            
            <form onSubmit={handleSaveHolding} className="space-y-4">
              
              {/* TICKER SEARCH BAR */}
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Search Ticker or AMFI Code</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white">
                  <Search className="w-4 h-4 text-gray-500 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. RELIANCE, AAPL, SBI Fund..."
                    className="bg-transparent flex-1 focus:outline-none placeholder-gray-600"
                    required
                  />
                </div>
                {/* Auto complete suggestions */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute inset-x-0 top-[52px] z-50 bg-gray-900 border border-gray-800 rounded-lg max-h-48 overflow-y-auto shadow-2xl text-xs divide-y divide-gray-800">
                    {searchResults.map((asset) => (
                      <div
                        key={asset.symbol}
                        onClick={() => handleSelectAsset(asset)}
                        className="p-2.5 hover:bg-gray-800 cursor-pointer flex justify-between gap-2 smooth-transition"
                      >
                        <div className="font-bold text-white shrink-0">{asset.symbol}</div>
                        <div className="text-gray-400 truncate text-[10px] text-right">{asset.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INPUT: ASSET DETAILS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Asset Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Asset/Fund Name"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Category</label>
                  <select
                    value={assetType}
                    onChange={(e: any) => setAssetType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  >
                    <option value="stock">Equity Stock</option>
                    <option value="mutual_fund">Mutual Fund</option>
                    <option value="gold">Digital Gold</option>
                    <option value="sgb">Sovereign Gold Bond</option>
                  </select>
                </div>
              </div>

              {/* INPUT: PRICING DETAILS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Purchase Currency</label>
                  <select
                    value={currency}
                    onChange={(e: any) => setCurrency(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Sector Vertical</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="e.g. Technology, Metal"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  />
                </div>
              </div>

              {/* INPUT: QUANTITY & BUY PRICE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Shares/Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Buy Price (in Currency)</label>
                  <input
                    type="number"
                    step="any"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                    required
                  />
                </div>
              </div>

              {/* INPUT: BUY DATE */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Purchase Date</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white">
                  <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                  <input
                    type="date"
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="bg-transparent flex-1 focus:outline-none w-full cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-2.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-bold smooth-transition cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                Log Transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ASSET TRANSACTION */}
      {showEditModal && selectedHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-md p-6 relative bg-gray-950/90 border border-gray-800/80 rounded-2xl shadow-2xl">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white smooth-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Edit Holding: {selectedHolding.symbol}</h3>
            
            <form onSubmit={handleUpdateHolding} className="space-y-4">
              
              {/* TICKER DISPLAY */}
              <div>
                <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Asset</span>
                <div className="bg-gray-900 border border-gray-850 px-3 py-2 rounded-lg text-xs font-bold text-gray-300">
                  {selectedHolding.symbol} - {selectedHolding.name}
                </div>
              </div>

              {/* INPUT: PRICING DETAILS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Purchase Currency</label>
                  <select
                    value={currency}
                    onChange={(e: any) => setCurrency(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Sector Vertical</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="e.g. Technology, Metal"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  />
                </div>
              </div>

              {/* INPUT: QUANTITY & BUY PRICE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Shares/Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Buy Price (in Currency)</label>
                  <input
                    type="number"
                    step="any"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                    required
                  />
                </div>
              </div>

              {/* INPUT: BUY DATE */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Purchase Date</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white">
                  <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                  <input
                    type="date"
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="bg-transparent flex-1 focus:outline-none w-full cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-2.5 text-xs bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white font-bold smooth-transition cursor-pointer shadow-lg shadow-indigo-500/10"
              >
                Update Transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSACTION HISTORY (DETAILED ASSET VIEW) */}
      {showTxModal && txModalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 relative bg-gray-955 border border-gray-800/80 rounded-2xl shadow-2xl animate-fadeIn">
            {/* Close Button */}
            <button
              onClick={() => setShowTxModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white smooth-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header info */}
            <div className="border-b border-gray-800 pb-3.5 mb-4">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-extrabold px-2.5 py-0.5 rounded border border-indigo-500/25 uppercase tracking-wider">
                Transaction Ledger
              </span>
              <h3 className="text-lg font-black text-white mt-2">
                {txModalAsset.symbol}
              </h3>
              <p className="text-xs text-gray-400 font-medium">{txModalAsset.name}</p>
            </div>

            {/* Content Table */}
            <div className="overflow-x-auto max-h-96 pr-1">
              {txLoading && assetTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                  <span>Fetching transaction entries...</span>
                </div>
              ) : assetTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  No transaction entries found for this asset.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-950/40 border-b border-gray-800 text-gray-400 font-semibold tracking-wider uppercase text-[10px]">
                      <th className="p-3">Purchase Date</th>
                      <th className="p-3 text-right">Shares/Units</th>
                      <th className="p-3 text-right">Price per Unit</th>
                      <th className="p-3 text-right">Total Invested</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {assetTransactions.map((tx) => {
                      const isEditing = editingTxId === tx.id;
                      const buyPriceINR = tx.buyPrice * tx.exchangeRate;
                      const investedValueINR = tx.quantity * buyPriceINR;

                      return (
                        <tr key={tx.id} className="hover:bg-gray-900/20 smooth-transition">
                          {/* Date Column */}
                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 w-32 cursor-pointer"
                              />
                            ) : (
                              <span className="font-medium text-gray-300">
                                {new Date(tx.buyDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </td>

                          {/* Quantity Column */}
                          <td className="p-3 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 w-20 text-right"
                              />
                            ) : (
                              <span className="font-bold text-gray-200">
                                {tx.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                              </span>
                            )}
                          </td>

                          {/* Unit Price Column */}
                          <td className="p-3 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 w-24 text-right"
                              />
                            ) : (
                              <span className="text-gray-400 font-medium">
                                {tx.currency === "USD" ? "$" : "₹"}
                                {tx.buyPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {tx.currency === "USD" && (
                                  <span className="block text-[8px] text-gray-500">
                                    ₹{buyPriceINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>

                          {/* Total Cost Column */}
                          <td className="p-3 text-right font-bold text-white">
                            {isEditing ? (
                              <span className="text-gray-500 text-[10px] italic">Calculated live</span>
                            ) : (
                              <span>
                                ₹{investedValueINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveInlineEdit(tx)}
                                    className="p-1 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500 hover:text-white text-emerald-400 smooth-transition cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingTxId(null)}
                                    className="p-1 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 text-gray-400 hover:text-white smooth-transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartInlineEdit(tx)}
                                    className="p-1 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 text-indigo-400 hover:text-white smooth-transition cursor-pointer"
                                    title="Edit purchase entry"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTransaction(tx)}
                                    className="p-1 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 text-rose-500 hover:text-white smooth-transition cursor-pointer"
                                    title="Delete purchase entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
