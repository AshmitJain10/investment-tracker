/**
 * CAGR (Compound Annual Growth Rate) calculator
 */

interface CagrInput {
  currentValue: number;
  investedValue: number;
  startDate: Date;
  endDate?: Date; // Defaults to now
}

/**
 * Calculates the CAGR.
 * Returns the rate as a decimal (e.g., 0.12 for 12%).
 */
export function calculateCAGR({
  currentValue,
  investedValue,
  startDate,
  endDate = new Date(),
}: CagrInput): number {
  if (investedValue <= 0 || currentValue < 0) {
    return 0;
  }

  const timeDiffMs = endDate.getTime() - startDate.getTime();
  const timeDiffYears = timeDiffMs / (365.25 * 24 * 60 * 60 * 1000);

  // If holding period is extremely short (e.g. less than a week),
  // CAGR calculations compound heavily and become wildly inaccurate.
  // In such cases, we fall back to absolute returns or return 0.
  if (timeDiffYears < 0.019) { // ~7 days
    return 0;
  }

  try {
    const cagr = Math.pow(currentValue / investedValue, 1 / timeDiffYears) - 1;
    if (isNaN(cagr) || !isFinite(cagr)) {
      return 0;
    }
    return cagr;
  } catch (error) {
    return 0;
  }
}

/**
 * Calculates standard absolute return percentage.
 * Returns as a decimal (e.g. 0.25 for 25%).
 */
export function calculateAbsoluteReturn(currentValue: number, investedValue: number): number {
  if (investedValue <= 0) return 0;
  return (currentValue - investedValue) / investedValue;
}
