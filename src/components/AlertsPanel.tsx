import React, { useState, useEffect } from "react";
import { Plus, Trash2, BellRing, Search, X, AlertCircle } from "lucide-react";
import { PriceAlert } from "@/models/types";

interface AlertsProps {
  alerts: PriceAlert[];
  prices: Record<string, { price: number; changePercent: number; name: string }>;
  onAddAlert: (symbol: string, targetPrice: number, condition: "above" | "below") => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
}

export default function AlertsPanel({ alerts, prices, onAddAlert, onDeleteAlert }: AlertsProps) {
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Auto-complete ticker search
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
        console.error("Autocomplete failed in alerts search", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelectAsset = (asset: any) => {
    setSelectedAsset(asset);
    setSearchQuery(asset.symbol);
    setShowSearchDropdown(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || !targetPrice) return;

    await onAddAlert(searchQuery.toUpperCase(), Number(targetPrice), condition);
    setShowAddModal(false);
    
    // Reset inputs
    setSearchQuery("");
    setTargetPrice("");
    setSelectedAsset(null);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER WIDGET AND TRIGGER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1">
            <BellRing className="w-4 h-4 text-emerald-400" /> Price Target Alerts Config
          </h3>
          <p className="text-[10px] text-gray-500">Configure target thresholds to receive reactive visual warnings.</p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-bold smooth-transition cursor-pointer shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-3.5 h-3.5" /> Setup Alert
        </button>
      </div>

      {/* PRICE ALERTS GRID */}
      <div className="glass-panel overflow-x-auto w-full glow-border">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No price alerts configured. Click "Setup Alert" to create your first threshold trigger!
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-950/40 border-b border-gray-800 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-4">Ticker</th>
                <th className="p-4 text-center">Condition</th>
                <th className="p-4 text-right">Target Price (INR)</th>
                <th className="p-4 text-right">Spot Price (INR)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {alerts.map((a) => {
                const priceInfo = prices[a.symbol];
                const spotPrice = priceInfo ? priceInfo.price : 0;
                
                const isTriggered =
                  spotPrice > 0 &&
                  ((a.condition === "above" && spotPrice >= a.targetPrice) ||
                    (a.condition === "below" && spotPrice <= a.targetPrice));

                return (
                  <tr key={a.id} className="hover:bg-gray-900/20 smooth-transition text-xs">
                    <td className="p-4 font-bold text-white text-sm">{a.symbol}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        a.condition === "above" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}>
                        Goes {a.condition}
                      </span>
                    </td>
                    <td className="p-4 text-right font-extrabold text-white">
                      ₹{a.targetPrice.toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right text-gray-400">
                      {spotPrice > 0 
                        ? `₹${spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`
                        : "Resolving spot..."
                      }
                    </td>
                    <td className="p-4 text-center">
                      {isTriggered ? (
                        <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full animate-pulse">
                          TRIGGERED
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-900 border border-gray-850 px-2 py-0.5 rounded-full">
                          ACTIVE SCAN
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={async () => {
                          if (confirm(`Delete target alert for ${a.symbol}?`)) {
                            await onDeleteAlert(a.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-500/10 border border-transparent rounded hover:border-rose-500/20 text-gray-500 hover:text-rose-500 smooth-transition cursor-pointer"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SETUP PRICE ALERT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-sm p-6 relative bg-gray-950/90 border border-gray-800/80 rounded-2xl shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white smooth-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-4">Create Price Target Alert</h3>
            
            <form onSubmit={handleSave} className="space-y-4">
              {/* TICKER SEARCH BAR */}
              <div className="relative">
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Search Asset</label>
                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white">
                  <Search className="w-4 h-4 text-gray-500 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. RELIANCE, MSFT..."
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

              {/* INPUT: CONDITION */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Trigger Condition</label>
                <select
                  value={condition}
                  onChange={(e: any) => setCondition(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                >
                  <option value="above">Price crosses ABOVE target threshold</option>
                  <option value="below">Price crosses BELOW target threshold</option>
                </select>
              </div>

              {/* INPUT: TARGET PRICE */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Target Price (in INR)</label>
                <input
                  type="number"
                  step="any"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 smooth-transition"
                  required
                />
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-bold text-xs smooth-transition cursor-pointer shadow-lg shadow-emerald-500/10 text-center"
              >
                Activate Scan Alert
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
