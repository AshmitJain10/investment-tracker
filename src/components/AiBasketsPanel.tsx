import React, { useState, useEffect } from "react";
import { Search, Sparkles, X, Plus, Loader2, Award, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

export default function AiBasketsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [basket, setBasket] = useState<any[]>([
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "MSFT", name: "Microsoft Corporation" },
    { symbol: "RELIANCE.NS", name: "Reliance Industries Ltd." },
    { symbol: "INFY.NS", name: "Infosys Limited" },
  ]); // Default seeded basket for gorgeous instant visuals!

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);

  const loadingSteps = [
    "Initiating quantitative diagnostics...",
    "Crunching 90-day historical technical price action...",
    "Evaluating fundamental P/E valuations and growth spreads...",
    "Auditing annualized beta and risk volatility metrics...",
    "Injecting dataset into LLM analytical scoring model...",
    "Compiling explainable AI summary reports...",
  ];

  // 1. Loading steps cycling effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
      }, 1500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // 2. Search Autocomplete
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
          // Limit to stocks or stock-like items
          setSearchResults(json.data.filter((item: any) => item.type === "stock"));
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Autocomplete fetch failed inside basket page", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleAddStock = (stock: any) => {
    if (basket.some((item) => item.symbol === stock.symbol)) {
      alert("This stock is already in your basket!");
      setSearchQuery("");
      setShowDropdown(false);
      return;
    }
    
    if (basket.length >= 20) {
      alert("You have reached the strict limit of 20 stocks in a basket.");
      return;
    }

    setBasket((prev) => [...prev, { symbol: stock.symbol, name: stock.name }]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleRemoveStock = (symbol: string) => {
    setBasket((prev) => prev.filter((item) => item.symbol !== symbol));
  };

  const handleRunAnalysis = async () => {
    if (basket.length === 0) return;
    setIsLoading(true);
    setAnalysisResult(null);
    setSelectedStockSymbol(null);

    try {
      const res = await fetch("/api/ai/score-basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: basket.map((item) => item.symbol) }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalysisResult(json.data);
        if (json.data.stocks && json.data.stocks.length > 0) {
          setSelectedStockSymbol(json.data.stocks[0].symbol);
        }
      } else {
        alert(`Analysis failed: ${json.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Analysis failed due to a network connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  // Color mappings
  const getScoreColor = (score: number) => {
    if (score >= 7.0) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 glow-text-green";
    if (score >= 4.0) return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    return "text-rose-500 border-rose-500/20 bg-rose-500/5 glow-text-red";
  };

  const getRatingColor = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes("buy")) return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-md shadow-emerald-500/5 animate-pulse";
    if (r.includes("sell")) return "bg-rose-500/10 border-rose-500/25 text-rose-400";
    return "bg-amber-500/10 border-amber-500/25 text-amber-400";
  };

  // Extract selected stock details
  const getSelectedStockData = () => {
    if (!analysisResult || !selectedStockSymbol) return null;
    return analysisResult.stocks.find((s: any) => s.symbol === selectedStockSymbol) || null;
  };

  // Convert scores for Recharts radar chart
  const getRadarData = () => {
    const stock = getSelectedStockData();
    if (!stock) return [];
    const sub = stock.subScores;
    return [
      { subject: "Technicals", value: sub.technicals },
      { subject: "Fundamentals", value: sub.fundamentals },
      { subject: "Risk & Safety", value: sub.risk },
    ];
  };

  const currentStock = getSelectedStockData();

  return (
    <div className="space-y-6">
      
      {/* HEADER CARD */}
      <div className="glass-panel p-5 glow-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Premium AI Stock Basket Scorer</h2>
          </div>
          <p className="text-[10px] text-gray-500 max-w-2xl leading-relaxed">
            Configure custom stock baskets of up to 20 equities. Our quantitative model evaluates 90-day technical trends, price momentum, beta risk thresholds, and fundamental indicators to generate a predictive diagnostic report for each individual stock.
          </p>
        </div>
        <div className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest shrink-0 self-start sm:self-center">
          Active Limit: {basket.length} / 20 Stocks
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CONFIGURE BASKET */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-5 space-y-4 glow-border h-[430px] flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Configure Basket</span>
              
              {/* Autocomplete Input */}
              <div className="relative">
                <div className="flex items-center bg-gray-950/40 border border-gray-850 hover:border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white">
                  <Search className="w-4 h-4 text-gray-500 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stock ticker to add (e.g. MSFT, INFY.NS)"
                    className="bg-transparent flex-1 focus:outline-none placeholder-gray-700 w-full"
                    disabled={isLoading}
                  />
                </div>
                {/* Autocomplete list */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute inset-x-0 top-[52px] z-50 bg-[#0c1220] border border-gray-800 rounded-xl max-h-48 overflow-y-auto shadow-2xl text-xs divide-y divide-gray-800/60">
                    {searchResults.map((stock) => (
                      <div
                        key={stock.symbol}
                        onClick={() => handleAddStock(stock)}
                        className="p-3 hover:bg-gray-900 cursor-pointer flex justify-between gap-3 smooth-transition items-center"
                      >
                        <div className="font-bold text-white shrink-0">{stock.symbol}</div>
                        <div className="text-gray-400 truncate text-[10px] text-right">{stock.name}</div>
                        <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Basket list */}
              <div className="overflow-y-auto max-h-[220px] pr-1.5 space-y-2 mt-4">
                {basket.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-10">Search and add stocks to configure your custom scoring basket!</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {basket.map((item) => (
                      <div
                        key={item.symbol}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0f1d] border border-gray-850 rounded-xl text-xs text-gray-300 font-medium hover:border-gray-800 transition duration-300 shadow-sm"
                      >
                        <span className="font-black text-white shrink-0 text-[10px] uppercase tracking-wider">{item.symbol}</span>
                        <span className="text-[9px] text-gray-500 truncate max-w-[80px] hidden md:inline">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStock(item.symbol)}
                          disabled={isLoading}
                          className="text-gray-500 hover:text-rose-400 transition cursor-pointer p-0.5"
                          title={`Remove ${item.symbol}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={basket.length === 0 || isLoading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white font-extrabold text-xs tracking-wider uppercase transition duration-300 disabled:opacity-40 disabled:hover:bg-emerald-500 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Generating Stock Diagnostics...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Run AI Stock Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE SCORE OUTPUT */}
        <div className="lg:col-span-7">
          
          {/* 1. LOADING HIGH FIDELITY STATE */}
          {isLoading && (
            <div className="glass-panel p-6 glow-border h-[430px] flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10" />
                <div className="absolute inset-0 rounded-full border-4 border-t-emerald-400 animate-spin" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h4 className="font-extrabold text-white text-xs uppercase tracking-widest animate-pulse">Running AI Quantitative Audit</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed min-h-[30px] transition-all duration-300">
                  {loadingSteps[loadingStep]}
                </p>
              </div>
            </div>
          )}

          {/* 2. INITIAL EMPTY STATE */}
          {!isLoading && !analysisResult && (
            <div className="glass-panel p-6 glow-border h-[430px] flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-3 bg-gray-900 border border-gray-850 rounded-2xl">
                <Award className="w-8 h-8 text-gray-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-gray-300 text-xs uppercase tracking-wider">Scoring Desk Ready</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed max-w-sm">
                  Click the **Run AI Stock Analysis** button to initiate our analytical diagnostic suite on your configured basket.
                </p>
              </div>
            </div>
          )}

          {/* 3. SCORING DIAGNOSTIC REPORT RESULTS */}
          {!isLoading && analysisResult && currentStock && (
            <div className="glass-panel p-5 glow-border h-auto lg:h-[430px] flex flex-col justify-between space-y-4 lg:space-y-0">
              
              {/* Horizontal Tabs Selector for Stock Selection */}
              <div className="flex overflow-x-auto gap-2 border-b border-gray-850/60 pb-2 shrink-0">
                {analysisResult.stocks.map((s: any) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => setSelectedStockSymbol(s.symbol)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider shrink-0 transition duration-200 cursor-pointer border ${
                      selectedStockSymbol === s.symbol
                        ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 font-extrabold shadow"
                        : "bg-gray-950/20 border-gray-850 text-gray-500 hover:text-gray-300 hover:border-gray-800"
                    }`}
                  >
                    {s.symbol}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* Visual Circle Gauge & recommendation */}
                <div className="md:col-span-5 flex flex-col items-center text-center space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-white block uppercase tracking-wider">{currentStock.symbol}</span>
                    <span className="text-[9px] text-gray-500 block truncate max-w-[130px] font-semibold">{currentStock.name}</span>
                  </div>
                  
                  {/* Score badge circle */}
                  <div className={`w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center transition duration-500 relative p-3 ${getScoreColor(currentStock.overallScore)}`}>
                    <span className="text-[7px] uppercase text-gray-500 tracking-wider font-extrabold">Score</span>
                    <span className="text-3xl font-black">{currentStock.overallScore}</span>
                    <span className="text-[7px] uppercase text-gray-500 tracking-widest font-bold">/ 10</span>
                  </div>

                  <span className={`px-3 py-0.5 rounded-full border text-[8px] font-extrabold uppercase tracking-widest ${getRatingColor(currentStock.rating)}`}>
                    {currentStock.rating} Recommendation
                  </span>
                </div>

                {/* Radar chart breakdown */}
                <div className="md:col-span-7 flex justify-center min-h-[200px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70" data={getRadarData()}>
                      <PolarGrid stroke="#1f2937" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 9, fontWeight: "bold" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "#4b5563", fontSize: 8 }} />
                      <Radar
                        name="Stock Score"
                        dataKey="value"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.25}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937", borderRadius: "8px" }}
                        labelStyle={{ color: "#9ca3af" }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Explainable AI summary paragraph */}
              <div className="bg-gray-950/20 border border-gray-850 rounded-2xl p-3.5 space-y-2 mt-2 lg:mt-0">
                <div className="flex items-center gap-1.5 border-b border-gray-900/60 pb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[9px] uppercase font-black text-gray-400 tracking-wider">Explainable AI Audit</span>
                </div>
                
                <p className="text-[10px] text-gray-300 leading-relaxed font-medium pr-1.5 overflow-y-auto max-h-[80px]">
                  {currentStock.summary.replace(/\*\*/g, "")}
                </p>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}
