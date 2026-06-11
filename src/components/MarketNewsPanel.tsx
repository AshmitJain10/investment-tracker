import React from "react";
import { Newspaper } from "lucide-react";

interface NewsArticle {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: string;
  summary?: string;
  relatedTickers?: string[];
}

interface MarketNewsPanelProps {
  newsFeed: NewsArticle[];
}

export default function MarketNewsPanel({ newsFeed }: MarketNewsPanelProps) {
  return (
    <section className="glass-panel p-6 space-y-4 glow-border animate-fadeIn">
      <div className="flex items-center gap-2.5 border-b border-gray-800 pb-4">
        <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/25 shadow-lg shadow-indigo-500/5">
          <Newspaper className="w-5 h-5 text-indigo-400 shrink-0" />
        </div>
        <div>
          <h4 className="font-extrabold text-gray-100 text-sm uppercase tracking-wider">Tailored News feed</h4>
          <p className="text-[10px] text-gray-500">Real-time market updates curated for tickers in your portfolio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {newsFeed.length === 0 ? (
          <p className="text-xs text-gray-500 col-span-2 text-center py-8">
            No active news feeds detected for your current assets.
          </p>
        ) : (
          newsFeed.map((art) => (
            <div
              key={art.uuid}
              className="bg-gray-950/20 border border-gray-850 p-5 rounded-2xl space-y-3 flex flex-col justify-between hover:border-gray-700 hover:bg-gray-950/30 smooth-transition"
            >
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-extrabold block">
                  {art.publisher} • {new Date(art.providerPublishTime).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <h5 className="font-bold text-gray-200 text-xs leading-relaxed hover:text-white smooth-transition">
                  {art.title}
                </h5>
                {art.summary && (
                  <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-3 mt-1">
                    {art.summary}
                  </p>
                )}
              </div>
              
              {art.relatedTickers && art.relatedTickers.length > 0 && (
                <div className="pt-2 flex items-center justify-between border-t border-gray-850 mt-3">
                  <span className="text-[8px] bg-gray-900 px-2 py-0.5 rounded border border-gray-800 text-gray-400 font-bold uppercase tracking-wider">
                    {art.relatedTickers[0]}
                  </span>
                  <a
                    href={art.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] text-emerald-400 hover:text-emerald-300 font-extrabold underline smooth-transition"
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
  );
}
