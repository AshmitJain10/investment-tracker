import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertCircle, ShieldAlert, Cpu } from "lucide-react";

interface AiProps {
  insights: string | null;
  onRefreshInsights: () => Promise<string | null>;
}

// Lightweight Custom Regex-Based Markdown-to-HTML Renderer
function MarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;

  // Split text by lines
  const lines = text.split("\n");
  const renderedElements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. HEADERS (### Heading)
    if (trimmed.startsWith("###")) {
      const title = trimmed.replace(/^###\s*/, "");
      renderedElements.push(
        <h4 key={`h-${idx}`} className="text-sm font-extrabold text-indigo-400 uppercase tracking-wider mt-6 mb-3 first:mt-0 flex items-center gap-1.5 border-b border-gray-900 pb-2">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" /> {title}
        </h4>
      );
      return;
    }

    // 2. BULLET POINTS (* Item or - Item)
    if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
      const content = trimmed.replace(/^[\*\-]\s*/, "");
      // Parse bold elements inside bullet
      const formattedContent = parseBoldText(content);
      renderedElements.push(
        <li key={`li-${idx}`} className="text-xs text-gray-300 ml-4 list-disc space-y-1 my-1.5 leading-relaxed">
          {formattedContent}
        </li>
      );
      return;
    }

    // 3. BLANK LINES
    if (trimmed === "") {
      return;
    }

    // 4. GENERAL PARAGRAPHS
    const formattedContent = parseBoldText(trimmed);
    renderedElements.push(
      <p key={`p-${idx}`} className="text-xs text-gray-300 leading-relaxed my-3">
        {formattedContent}
      </p>
    );
  });

  return <div className="space-y-1">{renderedElements}</div>;
}

// Regex Helper to replace **bold** with <strong> elements inside React node lines
function parseBoldText(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, index) => {
        // Odd indices are the captured bold texts
        if (index % 2 === 1) {
          return <strong key={index} className="text-white font-bold">{part}</strong>;
        }
        return part;
      })}
    </>
  );
}

export default function AiInsightsPanel({ insights, onRefreshInsights }: AiProps) {
  const [activeInsights, setActiveInsights] = useState<string | null>(insights);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Cool animated progress reports
  const progressSteps = [
    "Auditing current asset class drift...",
    "Scanning vertical sector concentration...",
    "Formulating tax-loss harvesting recommendations...",
    "Querying LLM portfolio advisor heuristics...",
    "Formatting institutional diagnostic report...",
  ];

  useEffect(() => {
    setActiveInsights(insights);
  }, [insights]);

  // Loading animation intervals
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < progressSteps.length - 1 ? prev + 1 : prev));
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await onRefreshInsights();
      if (res) {
        setActiveInsights(res);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER WIDGET AND ACTION TRIGGER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-200 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" /> AI Insights Advisor
          </h3>
          <p className="text-[10px] text-gray-500">LLM-powered portfolio risk diagnostics, tax advice, and market suggestions.</p>
        </div>
        
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 rounded-lg text-white font-bold smooth-transition cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 text-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} /> 
          {isGenerating ? "Analyzing Portfolio..." : "Recalculate AI Insights"}
        </button>
      </div>

      {/* INSIGHTS DISPLAY OR LOADING */}
      <div className="glass-panel p-6 glow-border min-h-[350px] flex flex-col">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/25 shadow-lg shadow-emerald-500/5 animate-pulse relative">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm">Advisor Analysis in Progress</h4>
              <p className="text-xs text-emerald-400 font-semibold animate-pulse mt-1">
                {progressSteps[loadingStep]}
              </p>
            </div>

            {/* Custom mini progress bar */}
            <div className="w-48 h-1 bg-gray-900 border border-gray-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 smooth-transition"
                style={{ width: `${((loadingStep + 1) / progressSteps.length) * 100}%` }}
              />
            </div>
          </div>
        ) : activeInsights ? (
          <div className="flex-1 text-xs">
            <MarkdownRenderer text={activeInsights} />
            
            {/* Disclaimer block */}
            <div className="mt-8 border-t border-gray-900 pt-4 flex gap-2 items-start text-[9px] text-gray-500 leading-relaxed">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
              <p>
                **General Disclaimer**: Financial insights are generated programmatically using mock heuristics and LLM configurations based on your inputs. This is for educational tracking purposes and does not constitute formal licensed tax, auditing, or investment advice.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-600" />
            <h4 className="font-bold text-gray-400 text-sm">No insights generated yet</h4>
            <p className="text-xs text-gray-500 max-w-xs">
              Click the "Recalculate AI Insights" button to audit your active portfolio holdings and produce strategic suggestions.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
