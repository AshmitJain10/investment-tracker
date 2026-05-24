import { calculateXIRR } from "../lib/math/xirr";
import { calculateCAGR, calculateAbsoluteReturn } from "../lib/math/cagr";
import { calculateGoldPricePerGram, calculateGoldHoldingValue } from "../lib/math/gold";
import { calculateSgbCoupons } from "../lib/math/sgb";

describe("Financial Mathematics Engine", () => {
  
  // 1. XIRR TEST SUITE
  describe("XIRR solver", () => {
    it("should return correct positive return rate", () => {
      // Invest ₹10,000, retrieve ₹12,000 exactly one year later (+20% XIRR)
      const flows = [
        { amount: -10000, date: new Date("2024-01-01") },
        { amount: 12000, date: new Date("2025-01-01") },
      ];
      const rate = calculateXIRR(flows);
      expect(rate).toBeCloseTo(0.20, 2); // 20%
    });

    it("should return negative return rate for losses", () => {
      // Invest ₹10,000, retrieve ₹8,000 exactly one year later (-20% XIRR)
      const flows = [
        { amount: -10000, date: new Date("2024-01-01") },
        { amount: 8000, date: new Date("2025-01-01") },
      ];
      const rate = calculateXIRR(flows);
      expect(rate).toBeCloseTo(-0.20, 2); // -20%
    });

    it("should return 0 for single transaction or same-signed flows", () => {
      const singleFlow = [{ amount: -10000, date: new Date("2024-01-01") }];
      expect(calculateXIRR(singleFlow)).toBe(0);

      const invalidFlows = [
        { amount: -10000, date: new Date("2024-01-01") },
        { amount: -12000, date: new Date("2025-01-01") },
      ];
      expect(calculateXIRR(invalidFlows)).toBe(0);
    });
  });

  // 2. CAGR TEST SUITE
  describe("CAGR calculator", () => {
    it("should compute accurate annualized returns", () => {
      // ₹10,000 doubles to ₹20,000 in exactly 2 years: CAGR = (2)^(0.5) - 1 = ~41.42%
      const cagr = calculateCAGR({
        currentValue: 20000,
        investedValue: 10000,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2026-01-01"),
      });
      expect(cagr).toBeCloseTo(0.4142, 3);
    });

    it("should return absolute returns cleanly", () => {
      const abs = calculateAbsoluteReturn(15000, 10000);
      expect(abs).toBe(0.50); // +50% absolute gains
    });

    it("should return 0 for extremely short holdings to avoid compounding noise", () => {
      const shortCagr = calculateCAGR({
        currentValue: 10500,
        investedValue: 10000,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-03"), // 2 days
      });
      expect(shortCagr).toBe(0);
    });
  });

  // 3. GOLD CONVERSION TEST SUITE
  describe("Digital Gold Converter", () => {
    it("should convert troy ounces in USD to grams in INR", () => {
      // Spot gold: $2330 per ounce, USD/INR rate: 83.5
      // Price per gram = (2330 * 83.5) / 31.1034768 = ~6255.09
      const price = calculateGoldPricePerGram(2330, 83.5, 1.0);
      expect(price).toBeCloseTo(6255.09, 1);
    });

    it("should compute accurate gold holding value", () => {
      const summary = calculateGoldHoldingValue(10, 6000, 6500);
      expect(summary.investedValue).toBe(60000);
      expect(summary.currentValue).toBe(65000);
      expect(summary.absoluteGain).toBe(5000);
      expect(summary.absoluteReturnPercent).toBe(5000 / 60000);
    });
  });

  // 4. SGB COUPONS TEST SUITE
  describe("Sovereign Gold Bonds Coupon Engine", () => {
    it("should compile a correct 6-month coupon calendar", () => {
      // Buy Date: 2024-01-01, Maturity Date: 2025-01-01 (1 year duration)
      // Expect 2 coupon payouts of 1.25% each on 2024-07-01 and 2025-01-01
      const buyDate = new Date("2024-01-01");
      const maturityDate = new Date("2025-01-02");
      const result = calculateSgbCoupons({
        quantity: 5,
        nominalPrice: 5000, // ₹25,000 nominal value
        buyDate,
        maturityDate,
      });

      // 2.5% of ₹25,000 annually is ₹625. Paid semi-annually: ₹312.50 per payout.
      expect(result.couponCalendar).toHaveLength(2);
      expect(result.couponCalendar[0].amount).toBe(312.50);
      
      const firstDate = result.couponCalendar[0].date;
      expect(firstDate.getMonth()).toBe(6); // July (since Jan + 6 months)
    });
  });
});
