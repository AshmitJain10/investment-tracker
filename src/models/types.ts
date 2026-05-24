export type AssetType = "stock" | "mutual_fund" | "gold" | "sgb";
export type CurrencyType = "INR" | "USD";

export interface Holding {
  id: string;              // Client-facing UUID (stripping MongoDB _id)
  symbol: string;          // e.g. "RELIANCE.NS", "AAPL", "120503" (scheme code for mutual funds), "GOLD"
  name: string;            // Name of the asset
  type: AssetType;
  currency: CurrencyType;  // USD or INR
  quantity: number;
  buyPrice: number;        // In purchase currency
  buyDate: string;         // YYYY-MM-DD
  exchangeRate: number;    // USD/INR exchange rate on purchase date (1.0 for INR assets)
  sector: string;          // Sector of the asset (e.g. Technology, Finance, etc.)
}

export interface WatchlistItem {
  id: string;              // UUID
  symbol: string;
  name: string;
  type: AssetType;
}

export interface PriceAlert {
  id: string;              // UUID
  symbol: string;
  targetPrice: number;     // Trigger threshold (in INR)
  condition: "above" | "below";
  active: boolean;
  createdAt: string;
}

export interface TargetAllocation {
  stock: number;           // Target percentage (e.g., 60 for 60%)
  mutual_fund: number;     // Target percentage (e.g., 30 for 30%)
  gold: number;            // Target percentage (e.g., 10 for 10%)
}

export interface RebalanceRecommendation {
  type: AssetType;
  currentPct: number;
  targetPct: number;
  currentValue: number;
  targetValue: number;
  deltaAmount: number;     // positive to buy, negative to sell (in INR)
  action: "BUY" | "SELL" | "HOLD";
}

export interface TaxHoldingDetail {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  quantity: number;
  buyPriceINR: number;
  currentPriceINR: number;
  investedValueINR: number;
  currentValueINR: number;
  unrealizedGainINR: number;
  holdingDays: number;
  holdingPeriodCategory: "SHORT_TERM" | "LONG_TERM";
  taxRatePercent: number;
  estimatedTaxINR: number;
  recommendation?: string; // e.g. "Harvest Loss"
}

export interface TaxSummary {
  shortTermGains: number;
  longTermGains: number;
  estimatedShortTermTax: number;
  estimatedLongTermTax: number;
  totalEstimatedTax: number;
  taxLossHarvestingOpportunity: number;
  harvestableAssets: TaxHoldingDetail[];
  details: TaxHoldingDetail[];
}

export interface SipHealthDetails {
  symbol: string;
  name: string;
  sipAmount: number;
  startDate: string;
  expectedContributions: number;
  actualContributions: number;
  missedContributions: number;
  steppedUpContributions: number;
  healthScore: number;
  status: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION";
}
