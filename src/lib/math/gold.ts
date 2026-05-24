/**
 * Digital Gold spot pricing mathematics
 */

const TROY_OUNCE_TO_GRAMS = 31.1034768;

/**
 * Converts Spot Gold Price in USD per Troy Ounce to INR per Gram
 * @param goldPriceUsdPerOunce Spot gold price of GC=F in USD
 * @param usdInrRate Current USD/INR exchange rate (from INR=X)
 */
export function calculateGoldPricePerGram(
  goldPriceUsdPerOunce: number,
  usdInrRate: number,
  premiumMultiplier: number = 1.157 // De-facto Indian domestic markup (~15.7% including custom duty, GST and platform spreads)
): number {
  if (goldPriceUsdPerOunce <= 0 || usdInrRate <= 0) return 0;
  return ((goldPriceUsdPerOunce * usdInrRate) / TROY_OUNCE_TO_GRAMS) * premiumMultiplier;
}

/**
 * Calculates current value and total gains of a gold holding
 * @param grams Total quantity of gold held in grams
 * @param avgBuyPricePerGram Average purchase price in INR per gram
 * @param currentGoldPricePerGram Current spot gold price in INR per gram
 */
export function calculateGoldHoldingValue(
  grams: number,
  avgBuyPricePerGram: number,
  currentGoldPricePerGram: number
) {
  const investedValue = grams * avgBuyPricePerGram;
  const currentValue = grams * currentGoldPricePerGram;
  const absoluteGain = currentValue - investedValue;
  const absoluteReturnPercent = investedValue > 0 ? absoluteGain / investedValue : 0;

  return {
    investedValue,
    currentValue,
    absoluteGain,
    absoluteReturnPercent,
  };
}
