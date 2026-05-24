/**
 * XIRR (Extended Internal Rate of Return) solver
 * Uses the Newton-Raphson method to find the rate of return for a series of cash flows on irregular dates.
 */

interface CashFlow {
  amount: number; // Negative for outflow (buy), Positive for inflow (sell/current valuation)
  date: Date;
}

/**
 * Calculates the Net Present Value (NPV) of cash flows for a given rate.
 */
function npv(rate: number, cashFlows: CashFlow[]): number {
  const d0 = cashFlows[0].date.getTime();
  let totalNPV = 0;

  for (const cf of cashFlows) {
    const timeDiffYears = (cf.date.getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000);
    // Handle edge case where (1 + rate) <= 0
    if (1 + rate <= 0) {
      // Return a very large/small number to guide search away
      return cf.amount > 0 ? 1e10 : -1e10;
    }
    totalNPV += cf.amount / Math.pow(1 + rate, timeDiffYears);
  }

  return totalNPV;
}

/**
 * Calculates the derivative of NPV with respect to the rate.
 */
function npvDerivative(rate: number, cashFlows: CashFlow[]): number {
  const d0 = cashFlows[0].date.getTime();
  let totalDerivative = 0;

  for (const cf of cashFlows) {
    const timeDiffYears = (cf.date.getTime() - d0) / (365.25 * 24 * 60 * 60 * 1000);
    if (timeDiffYears === 0) continue;

    if (1 + rate <= 0) {
      return 1e10;
    }

    totalDerivative -= (cf.amount * timeDiffYears) / Math.pow(1 + rate, timeDiffYears + 1);
  }

  return totalDerivative;
}

/**
 * Solves for XIRR using the Newton-Raphson method.
 * Returns decimal rate (e.g. 0.15 for 15%).
 */
export function calculateXIRR(cashFlows: CashFlow[]): number {
  if (cashFlows.length < 2) return 0;

  // Sort cash flows by date
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Check if we have at least one inflow and one outflow
  let hasPositive = false;
  let hasNegative = false;
  for (const cf of sortedFlows) {
    if (cf.amount > 0) hasPositive = true;
    if (cf.amount < 0) hasNegative = true;
  }

  if (!hasPositive || !hasNegative) {
    // Cannot calculate XIRR if all cash flows are of the same sign
    return 0;
  }

  const maxIterations = 100;
  const tolerance = 1e-6;
  let rate = 0.1; // Default starting guess (10% return)

  for (let i = 0; i < maxIterations; i++) {
    const fVal = npv(rate, sortedFlows);
    const fDeriv = npvDerivative(rate, sortedFlows);

    if (Math.abs(fDeriv) < 1e-12) {
      // Derivative too small, nudge rate to try to break out of flat areas
      rate += 0.05;
      continue;
    }

    const nextRate = rate - fVal / fDeriv;

    // Check convergence
    if (Math.abs(nextRate - rate) < tolerance) {
      // Guard against outrageous mathematical solutions (e.g. -99.9% or +1000%)
      if (isNaN(nextRate) || !isFinite(nextRate)) return 0;
      return nextRate;
    }

    rate = nextRate;
  }

  // Fallback: Bisection method if Newton-Raphson failed to converge
  return calculateXIRRBisection(sortedFlows);
}

/**
 * Bisection method fallback for XIRR
 */
function calculateXIRRBisection(cashFlows: CashFlow[]): number {
  let low = -0.9999;
  let high = 5.0; // Up to 500% return
  const tolerance = 1e-5;
  const maxIterations = 50;

  let fLow = npv(low, cashFlows);
  let fHigh = npv(high, cashFlows);

  // If both have the same sign, we can't bracket a root in this range
  if (fLow * fHigh > 0) {
    // If high NPV is positive, rate might be even higher than 500%
    if (fHigh > 0) {
      high = 20.0; // Try up to 2000%
      fHigh = npv(high, cashFlows);
      if (fLow * fHigh > 0) return 0;
    } else {
      return 0;
    }
  }

  let mid = (low + high) / 2;
  for (let i = 0; i < maxIterations; i++) {
    mid = (low + high) / 2;
    const fMid = npv(mid, cashFlows);

    if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
      return mid;
    }

    if (fMid * fLow > 0) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
      fHigh = fMid;
    }
  }

  return mid;
}
