import {
  addTransaction,
  getTransactionsForAsset,
  getHoldings,
  recalculateHoldingForSymbol,
  deleteTransaction,
  updateTransaction
} from "../lib/storage";
import { Transaction } from "../models/types";

describe("Transaction & Cost Basis (WACB) Recalculation Engine", () => {
  const testUserId = "test-user-uuid";

  beforeEach(async () => {
    // Clear MongoDB collections for the test user if connected
    try {
      const { connectToDatabase } = require("../lib/db");
      const { db } = await connectToDatabase();
      if (db) {
        await db.collection("holdings").deleteMany({ userId: testUserId });
        await db.collection("transactions").deleteMany({ userId: testUserId });
      }
    } catch (err) {
      // MongoDB not connected, fallback to in-memory DB
    }

    // Clear the memory DB
    const globalWithStorage = global as any;
    if (globalWithStorage._inMemoryDb) {
      globalWithStorage._inMemoryDb[testUserId] = {
        holdings: [],
        transactions: [],
        watchlist: [],
        alerts: [],
        targetAllocation: { stock: 60, mutual_fund: 30, gold: 10 },
      };
    }
  });

  it("should aggregate multiple transactions of the same asset and calculate WACB correctly", async () => {
    // Transaction 1: Buy 10 units of RELIANCE at ₹2400
    const tx1: Transaction = {
      id: "tx1",
      userId: testUserId,
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      type: "stock",
      currency: "INR",
      quantity: 10,
      buyPrice: 2400.0,
      buyDate: "2026-01-15",
      exchangeRate: 1.0,
      sector: "Energy",
    };

    // Transaction 2: Buy 5 units of RELIANCE at ₹2500
    const tx2: Transaction = {
      id: "tx2",
      userId: testUserId,
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      type: "stock",
      currency: "INR",
      quantity: 5,
      buyPrice: 2500.0,
      buyDate: "2026-02-15",
      exchangeRate: 1.0,
      sector: "Energy",
    };

    await addTransaction(testUserId, tx1);
    await addTransaction(testUserId, tx2);

    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    const holdings = await getHoldings(testUserId);
    expect(holdings).toHaveLength(1);
    
    const holding = holdings[0];
    expect(holding.symbol).toBe("RELIANCE.NS");
    expect(holding.quantity).toBe(15);
    // WACB = (10 * 2400 + 5 * 2500) / 15 = (24000 + 12500) / 15 = 36500 / 15 = 2433.3333
    expect(holding.buyPrice).toBeCloseTo(2433.3333, 4);
    // Earliest buyDate should be kept
    expect(holding.buyDate).toBe("2026-01-15");
  });

  it("should update parent holdings correctly when a transaction is edited", async () => {
    const tx1: Transaction = {
      id: "tx1",
      userId: testUserId,
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      type: "stock",
      currency: "INR",
      quantity: 10,
      buyPrice: 2400.0,
      buyDate: "2026-01-15",
      exchangeRate: 1.0,
      sector: "Energy",
    };

    await addTransaction(testUserId, tx1);
    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    let holdings = await getHoldings(testUserId);
    expect(holdings[0].quantity).toBe(10);
    expect(holdings[0].buyPrice).toBe(2400.0);

    // Edit transaction: increase quantity to 20 and price to 2450
    await updateTransaction(testUserId, "tx1", { quantity: 20, buyPrice: 2450.0 });
    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    holdings = await getHoldings(testUserId);
    expect(holdings[0].quantity).toBe(20);
    expect(holdings[0].buyPrice).toBe(2450.0);
  });

  it("should update or delete the parent holding when a transaction is deleted", async () => {
    const tx1: Transaction = {
      id: "tx1",
      userId: testUserId,
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      type: "stock",
      currency: "INR",
      quantity: 10,
      buyPrice: 2400.0,
      buyDate: "2026-01-15",
      exchangeRate: 1.0,
      sector: "Energy",
    };

    const tx2: Transaction = {
      id: "tx2",
      userId: testUserId,
      symbol: "RELIANCE.NS",
      name: "Reliance Industries",
      type: "stock",
      currency: "INR",
      quantity: 5,
      buyPrice: 2500.0,
      buyDate: "2026-02-15",
      exchangeRate: 1.0,
      sector: "Energy",
    };

    await addTransaction(testUserId, tx1);
    await addTransaction(testUserId, tx2);
    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    let holdings = await getHoldings(testUserId);
    expect(holdings[0].quantity).toBe(15);

    // Delete one transaction, should recalculate quantity to 10
    await deleteTransaction(testUserId, "tx2");
    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    holdings = await getHoldings(testUserId);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(10);
    expect(holdings[0].buyPrice).toBe(2400.0);

    // Delete the final transaction, should remove parent holding document entirely
    await deleteTransaction(testUserId, "tx1");
    await recalculateHoldingForSymbol(testUserId, "RELIANCE.NS");

    holdings = await getHoldings(testUserId);
    expect(holdings).toHaveLength(0);
  });
});
