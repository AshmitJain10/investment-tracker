/**
 * Sovereign Gold Bonds (SGB) calculations
 * SGBs pay a fixed coupon rate of 2.5% per annum on the nominal value, paid semi-annually.
 */

interface SgbCouponInput {
  quantity: number;        // Number of bonds/grams
  nominalPrice: number;    // Issue price/nominal value in INR (e.g. 5000)
  buyDate: Date;
  maturityDate?: Date;     // Typically 8 years from issue date, but we can default it
}

interface CouponPayment {
  date: Date;
  amount: number;
  status: "PAID" | "UPCOMING";
}

/**
 * Calculates interest earnings for Sovereign Gold Bonds (SGBs).
 * SGBs pay 1.25% of the nominal value every 6 months (semi-annually).
 */
export function calculateSgbCoupons({
  quantity,
  nominalPrice,
  buyDate,
  maturityDate,
}: SgbCouponInput): {
  totalInterestEarned: number;
  upcomingCoupon: CouponPayment | null;
  couponCalendar: CouponPayment[];
} {
  const nominalTotal = quantity * nominalPrice;
  const semiAnnualRate = 0.0125; // 1.25% per 6 months (2.5% annually)
  const couponAmount = nominalTotal * semiAnnualRate;

  // SGBs mature in 8 years. If maturityDate is not provided, estimate as 8 years from buyDate.
  const endLimitDate = maturityDate
    ? new Date(maturityDate)
    : new Date(buyDate.getTime() + 8 * 365.25 * 24 * 60 * 60 * 1000);

  const couponCalendar: CouponPayment[] = [];
  const now = new Date();

  let currentDate = new Date(buyDate);
  // Add 6 months iteratively
  while (true) {
    // Add 6 months
    const nextCouponTime = new Date(currentDate);
    nextCouponTime.setMonth(nextCouponTime.getMonth() + 6);

    // Stop if we exceed maturity date
    if (nextCouponTime.getTime() > endLimitDate.getTime()) {
      break;
    }

    const isPaid = nextCouponTime.getTime() <= now.getTime();

    couponCalendar.push({
      date: nextCouponTime,
      amount: couponAmount,
      status: isPaid ? "PAID" : "UPCOMING",
    });

    currentDate = nextCouponTime;
  }

  // Calculate sum of paid interest
  const totalInterestEarned = couponCalendar
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + c.amount, 0);

  // Find the first upcoming coupon
  const upcomingCoupon = couponCalendar.find((c) => c.status === "UPCOMING") || null;

  return {
    totalInterestEarned,
    upcomingCoupon,
    couponCalendar,
  };
}
