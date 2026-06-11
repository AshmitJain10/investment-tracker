import { connectToDatabase } from "./db";
import { Holding, WatchlistItem, PriceAlert, Transaction } from "../models/types";
import { randomUUID } from "crypto";

// Multi-tenant in-memory database helper
interface UserDb {
  holdings: Holding[];
  transactions: Transaction[];
  watchlist: WatchlistItem[];
  alerts: PriceAlert[];
  targetAllocation: { stock: number; mutual_fund: number; gold: number };
  goldSip?: { checkedDates: string[]; dailySipAmount: number };
}

interface InMemoryDb {
  [userId: string]: UserDb;
}

const globalWithStorage = global as typeof globalThis & {
  _inMemoryDb?: InMemoryDb;
};

if (!globalWithStorage._inMemoryDb) {
  globalWithStorage._inMemoryDb = {};
}

const memDb = globalWithStorage._inMemoryDb;

// Helper to get or initialize a user's in-memory storage
function getUserMemDb(userId: string): UserDb {
  const normalizedId = userId || "default";
  if (!memDb[normalizedId]) {
    // Seed standard elegant holdings ONLY for the default mock user to support tests out-of-the-box
    if (normalizedId === "mock-user-id" || normalizedId === "default") {
      memDb[normalizedId] = {
        holdings: [
          {
            id: "h1",
            symbol: "RELIANCE.NS",
            name: "Reliance Industries Ltd.",
            type: "stock",
            currency: "INR",
            quantity: 15,
            buyPrice: 2450.0,
            buyDate: "2026-01-15",
            exchangeRate: 1.0,
            sector: "Energy",
          },
          {
            id: "h2",
            symbol: "INFY.NS",
            name: "Infosys Limited",
            type: "stock",
            currency: "INR",
            quantity: 25,
            buyPrice: 1550.0,
            buyDate: "2026-04-10",
            exchangeRate: 1.0,
            sector: "Technology",
          },
          {
            id: "h3",
            symbol: "AAPL",
            name: "Apple Inc.",
            type: "stock",
            currency: "USD",
            quantity: 5,
            buyPrice: 175.5,
            buyDate: "2025-11-20",
            exchangeRate: 83.2,
            sector: "Technology",
          },
          {
            id: "h4",
            symbol: "120503",
            name: "SBI Bluechip Fund - Direct Growth",
            type: "mutual_fund",
            currency: "INR",
            quantity: 520.45,
            buyPrice: 76.85,
            buyDate: "2025-07-15",
            exchangeRate: 1.0,
            sector: "Mutual Funds",
          },
          {
            id: "h5",
            symbol: "GOLD",
            name: "Digital Gold (24K)",
            type: "gold",
            currency: "INR",
            quantity: 8.5,
            buyPrice: 6200.0,
            buyDate: "2026-02-05",
            exchangeRate: 1.0,
            sector: "Alternative Assets",
          },
          {
            id: "h6",
            symbol: "SGBDE32VIII.NS",
            name: "Sovereign Gold Bond 2.5% Dec 2032 Series",
            type: "sgb",
            currency: "INR",
            quantity: 10,
            buyPrice: 6150.0,
            buyDate: "2025-12-18",
            exchangeRate: 1.0,
            sector: "Bonds",
          },
        ],
        transactions: [
          // Reliance: 3 purchases to support SIP & cash flow
          {
            id: "t1_1",
            userId: normalizedId,
            symbol: "RELIANCE.NS",
            name: "Reliance Industries Ltd.",
            type: "stock",
            currency: "INR",
            quantity: 5,
            buyPrice: 2400.0,
            buyDate: "2026-01-15",
            exchangeRate: 1.0,
            sector: "Energy",
          },
          {
            id: "t1_2",
            userId: normalizedId,
            symbol: "RELIANCE.NS",
            name: "Reliance Industries Ltd.",
            type: "stock",
            currency: "INR",
            quantity: 5,
            buyPrice: 2500.0,
            buyDate: "2026-02-15",
            exchangeRate: 1.0,
            sector: "Energy",
          },
          {
            id: "t1_3",
            userId: normalizedId,
            symbol: "RELIANCE.NS",
            name: "Reliance Industries Ltd.",
            type: "stock",
            currency: "INR",
            quantity: 5,
            buyPrice: 2450.0,
            buyDate: "2026-03-15",
            exchangeRate: 1.0,
            sector: "Energy",
          },
          // Infosys: 2 purchases
          {
            id: "t2_1",
            userId: normalizedId,
            symbol: "INFY.NS",
            name: "Infosys Limited",
            type: "stock",
            currency: "INR",
            quantity: 15,
            buyPrice: 1550.0,
            buyDate: "2026-04-10",
            exchangeRate: 1.0,
            sector: "Technology",
          },
          {
            id: "t2_2",
            userId: normalizedId,
            symbol: "INFY.NS",
            name: "Infosys Limited",
            type: "stock",
            currency: "INR",
            quantity: 10,
            buyPrice: 1550.0,
            buyDate: "2026-05-10",
            exchangeRate: 1.0,
            sector: "Technology",
          },
          // Apple: 1 purchase in USD
          {
            id: "t3_1",
            userId: normalizedId,
            symbol: "AAPL",
            name: "Apple Inc.",
            type: "stock",
            currency: "USD",
            quantity: 5,
            buyPrice: 175.5,
            buyDate: "2025-11-20",
            exchangeRate: 83.2,
            sector: "Technology",
          },
          // SBI Bluechip: 3 purchases representing a monthly SIP
          {
            id: "t4_1",
            userId: normalizedId,
            symbol: "120503",
            name: "SBI Bluechip Fund - Direct Growth",
            type: "mutual_fund",
            currency: "INR",
            quantity: 120.45,
            buyPrice: 76.85,
            buyDate: "2025-07-15",
            exchangeRate: 1.0,
            sector: "Mutual Funds",
          },
          {
            id: "t4_2",
            userId: normalizedId,
            symbol: "120503",
            name: "SBI Bluechip Fund - Direct Growth",
            type: "mutual_fund",
            currency: "INR",
            quantity: 200.0,
            buyPrice: 76.85,
            buyDate: "2025-08-15",
            exchangeRate: 1.0,
            sector: "Mutual Funds",
          },
          {
            id: "t4_3",
            userId: normalizedId,
            symbol: "120503",
            name: "SBI Bluechip Fund - Direct Growth",
            type: "mutual_fund",
            currency: "INR",
            quantity: 200.0,
            buyPrice: 76.85,
            buyDate: "2025-09-15",
            exchangeRate: 1.0,
            sector: "Mutual Funds",
          },
          // Gold
          {
            id: "t5_1",
            userId: normalizedId,
            symbol: "GOLD",
            name: "Digital Gold (24K)",
            type: "gold",
            currency: "INR",
            quantity: 8.5,
            buyPrice: 6200.0,
            buyDate: "2026-02-05",
            exchangeRate: 1.0,
            sector: "Alternative Assets",
          },
          // SGB
          {
            id: "t6_1",
            userId: normalizedId,
            symbol: "SGBDE32VIII.NS",
            name: "Sovereign Gold Bond 2.5% Dec 2032 Series",
            type: "sgb",
            currency: "INR",
            quantity: 10,
            buyPrice: 6150.0,
            buyDate: "2025-12-18",
            exchangeRate: 1.0,
            sector: "Bonds",
          },
        ],
        watchlist: [
          { id: "w1", symbol: "TCS.NS", name: "Tata Consultancy Services Ltd", type: "stock" },
          { id: "w2", symbol: "MSFT", name: "Microsoft Corporation", type: "stock" },
          { id: "w3", symbol: "102868", name: "Parag Parikh Flexi Cap Fund", type: "mutual_fund" },
        ],
        alerts: [
          { id: "a1", symbol: "RELIANCE.NS", targetPrice: 3000, condition: "above", active: true, createdAt: "2026-05-24T12:00:00.000Z" }
        ],
        targetAllocation: { stock: 60, mutual_fund: 30, gold: 10 },
        goldSip: { checkedDates: [], dailySipAmount: 500 },
      };
    } else {
      // Real new users start empty with a default allocation
      memDb[normalizedId] = {
        holdings: [],
        transactions: [],
        watchlist: [],
        alerts: [],
        targetAllocation: { stock: 60, mutual_fund: 30, gold: 10 },
        goldSip: { checkedDates: [], dailySipAmount: 500 },
      };
    }
  }
  return memDb[normalizedId];
}

async function getDbSafe() {
  try {
    const { db } = await connectToDatabase();
    return db;
  } catch (error) {
    return null;
  }
}

// ==================== HOLDINGS CRUD ====================

export async function getHoldings(userId: string): Promise<Holding[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("holdings").find({ userId }).toArray();
    return data.map(({ _id, userId: _, ...rest }) => rest as Holding);
  }
  return getUserMemDb(userId).holdings;
}

export async function addHolding(userId: string, holding: Holding): Promise<Holding> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("holdings").insertOne({ ...holding, userId });
  } else {
    getUserMemDb(userId).holdings.push(holding);
  }
  return holding;
}

export async function updateHolding(userId: string, id: string, updates: Partial<Holding>): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("holdings").updateOne({ id, userId }, { $set: updates });
    return res.modifiedCount > 0;
  }
  const userMem = getUserMemDb(userId);
  const idx = userMem.holdings.findIndex((h) => h.id === id);
  if (idx !== -1) {
    userMem.holdings[idx] = { ...userMem.holdings[idx], ...updates };
    return true;
  }
  return false;
}

export async function deleteHolding(userId: string, id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("holdings").deleteOne({ id, userId });
    return res.deletedCount > 0;
  }
  const userMem = getUserMemDb(userId);
  const idx = userMem.holdings.findIndex((h) => h.id === id);
  if (idx !== -1) {
    userMem.holdings.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== WATCHLIST CRUD ====================

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("watchlist").find({ userId }).toArray();
    return data.map(({ _id, userId: _, ...rest }) => rest as WatchlistItem);
  }
  return getUserMemDb(userId).watchlist;
}

export async function addWatchlistItem(userId: string, item: WatchlistItem): Promise<WatchlistItem> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("watchlist").insertOne({ ...item, userId });
  } else {
    getUserMemDb(userId).watchlist.push(item);
  }
  return item;
}

export async function deleteWatchlistItem(userId: string, id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("watchlist").deleteOne({ id, userId });
    return res.deletedCount > 0;
  }
  const userMem = getUserMemDb(userId);
  const idx = userMem.watchlist.findIndex((w) => w.id === id);
  if (idx !== -1) {
    userMem.watchlist.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== PRICE ALERTS CRUD ====================

export async function getPriceAlerts(userId: string): Promise<PriceAlert[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("alerts").find({ userId }).toArray();
    return data.map(({ _id, userId: _, ...rest }) => rest as PriceAlert);
  }
  return getUserMemDb(userId).alerts;
}

export async function addPriceAlert(userId: string, alert: PriceAlert): Promise<PriceAlert> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("alerts").insertOne({ ...alert, userId });
  } else {
    getUserMemDb(userId).alerts.push(alert);
  }
  return alert;
}

export async function updatePriceAlert(userId: string, id: string, updates: Partial<PriceAlert>): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("alerts").updateOne({ id, userId }, { $set: updates });
    return res.modifiedCount > 0;
  }
  const userMem = getUserMemDb(userId);
  const idx = userMem.alerts.findIndex((a) => a.id === id);
  if (idx !== -1) {
    userMem.alerts[idx] = { ...userMem.alerts[idx], ...updates };
    return true;
  }
  return false;
}

export async function deletePriceAlert(userId: string, id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("alerts").deleteOne({ id, userId });
    return res.deletedCount > 0;
  }
  const userMem = getUserMemDb(userId);
  const idx = userMem.alerts.findIndex((a) => a.id === id);
  if (idx !== -1) {
    userMem.alerts.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== TARGET ALLOCATION CRUD ====================

export async function getTargetAllocation(userId: string): Promise<{ stock: number; mutual_fund: number; gold: number }> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("settings").findOne({ type: "target_allocation", userId });
    if (data) {
      return {
        stock: data.stock,
        mutual_fund: data.mutual_fund,
        gold: data.gold,
      };
    }
  }
  return getUserMemDb(userId).targetAllocation;
}

export async function saveTargetAllocation(userId: string, stock: number, mutual_fund: number, gold: number): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("settings").updateOne(
      { type: "target_allocation", userId },
      { $set: { stock, mutual_fund, gold } },
      { upsert: true }
    );
    return true;
  }
  getUserMemDb(userId).targetAllocation = { stock, mutual_fund, gold };
  return true;
}

// ==================== GOLD SIP PERSISTENCE CRUD ====================

export async function getGoldSipData(userId: string): Promise<{ checkedDates: string[]; dailySipAmount: number }> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("settings").findOne({ type: "gold_sip", userId });
    if (data) {
      return {
        checkedDates: data.checkedDates || [],
        dailySipAmount: data.dailySipAmount || 500,
      };
    }
  }
  const mem = getUserMemDb(userId);
  if (!mem.goldSip) {
    mem.goldSip = { checkedDates: [], dailySipAmount: 500 };
  }
  return mem.goldSip;
}

export async function saveGoldSipData(userId: string, checkedDates: string[], dailySipAmount: number): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("settings").updateOne(
      { type: "gold_sip", userId },
      { $set: { checkedDates, dailySipAmount } },
      { upsert: true }
    );
    return true;
  }
  const mem = getUserMemDb(userId);
  mem.goldSip = { checkedDates, dailySipAmount };
  return true;
}

// ==================== TRANSACTIONS CRUD & RECALCULATION ====================



export async function getTransactions(userId: string): Promise<Transaction[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("transactions").find({ userId }).toArray();
    return data.map(({ _id, userId: _, ...rest }) => rest as Transaction);
  }
  return getUserMemDb(userId).transactions || [];
}

export async function getTransactionsForAsset(userId: string, symbol: string): Promise<Transaction[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("transactions").find({ userId, symbol: symbol.toUpperCase() }).toArray();
    return data.map(({ _id, userId: _, ...rest }) => rest as Transaction);
  }
  const mem = getUserMemDb(userId);
  return (mem.transactions || []).filter((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export async function addTransaction(userId: string, tx: Transaction): Promise<Transaction> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("transactions").insertOne({ ...tx, userId });
  } else {
    const mem = getUserMemDb(userId);
    if (!mem.transactions) mem.transactions = [];
    mem.transactions.push({ ...tx, userId });
  }
  return tx;
}

export async function updateTransaction(userId: string, id: string, updates: Partial<Transaction>): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("transactions").updateOne({ id, userId }, { $set: updates });
    return res.modifiedCount > 0;
  }
  const mem = getUserMemDb(userId);
  const idx = (mem.transactions || []).findIndex((t) => t.id === id);
  if (idx !== -1) {
    mem.transactions[idx] = { ...mem.transactions[idx], ...updates };
    return true;
  }
  return false;
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("transactions").deleteOne({ id, userId });
    return res.deletedCount > 0;
  }
  const mem = getUserMemDb(userId);
  const idx = (mem.transactions || []).findIndex((t) => t.id === id);
  if (idx !== -1) {
    mem.transactions.splice(idx, 1);
    return true;
  }
  return false;
}

export async function getTransactionById(userId: string, id: string): Promise<Transaction | null> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("transactions").findOne({ id, userId });
    if (data) {
      const { _id, userId: _, ...rest } = data;
      return rest as Transaction;
    }
    return null;
  }
  const mem = getUserMemDb(userId);
  const tx = (mem.transactions || []).find((t) => t.id === id);
  return tx || null;
}

export async function recalculateHoldingForSymbol(userId: string, symbol: string): Promise<void> {
  const db = await getDbSafe();
  const upperSymbol = symbol.toUpperCase();
  
  if (db) {
    const txs = await db.collection("transactions").find({ userId, symbol: upperSymbol }).toArray();
    
    if (txs.length === 0) {
      // Delete holding if no transactions remain
      await db.collection("holdings").deleteOne({ userId, symbol: upperSymbol });
      return;
    }
    
    let totalQty = 0;
    let totalCost = 0;
    let totalExchangeRateWeighted = 0;
    let earliestDate = txs[0].buyDate;
    
    for (const tx of txs) {
      totalQty += tx.quantity;
      totalCost += tx.quantity * tx.buyPrice;
      totalExchangeRateWeighted += tx.quantity * (tx.exchangeRate || 1.0);
      if (new Date(tx.buyDate).getTime() < new Date(earliestDate).getTime()) {
        earliestDate = tx.buyDate;
      }
    }
    
    const wacb = totalCost / totalQty;
    const avgExchangeRate = totalExchangeRateWeighted / totalQty;
    const refTx = txs[0];
    
    const existing = await db.collection("holdings").findOne({ userId, symbol: upperSymbol });
    
    if (existing) {
      await db.collection("holdings").updateOne(
        { userId, symbol: upperSymbol },
        {
          $set: {
            quantity: totalQty,
            buyPrice: Number(wacb.toFixed(4)),
            exchangeRate: Number(avgExchangeRate.toFixed(4)),
            buyDate: earliestDate,
          }
        }
      );
    } else {
      const newHolding = {
        id: randomUUID(),
        userId,
        symbol: upperSymbol,
        name: refTx.name,
        type: refTx.type,
        currency: refTx.currency,
        quantity: totalQty,
        buyPrice: Number(wacb.toFixed(4)),
        buyDate: earliestDate,
        exchangeRate: Number(avgExchangeRate.toFixed(4)),
        sector: refTx.sector || "General",
      };
      await db.collection("holdings").insertOne(newHolding);
    }
  } else {
    // In-memory fallback
    const userMem = getUserMemDb(userId);
    const txs = (userMem.transactions || []).filter((t) => t.symbol.toUpperCase() === upperSymbol);
    
    if (txs.length === 0) {
      userMem.holdings = userMem.holdings.filter((h) => h.symbol.toUpperCase() !== upperSymbol);
      return;
    }
    
    let totalQty = 0;
    let totalCost = 0;
    let totalExchangeRateWeighted = 0;
    let earliestDate = txs[0].buyDate;
    
    for (const tx of txs) {
      totalQty += tx.quantity;
      totalCost += tx.quantity * tx.buyPrice;
      totalExchangeRateWeighted += tx.quantity * (tx.exchangeRate || 1.0);
      if (new Date(tx.buyDate).getTime() < new Date(earliestDate).getTime()) {
        earliestDate = tx.buyDate;
      }
    }
    
    const wacb = totalCost / totalQty;
    const avgExchangeRate = totalExchangeRateWeighted / totalQty;
    const refTx = txs[0];
    
    const idx = userMem.holdings.findIndex((h) => h.symbol.toUpperCase() === upperSymbol);
    if (idx !== -1) {
      userMem.holdings[idx] = {
        ...userMem.holdings[idx],
        quantity: totalQty,
        buyPrice: Number(wacb.toFixed(4)),
        exchangeRate: Number(avgExchangeRate.toFixed(4)),
        buyDate: earliestDate,
      };
    } else {
      userMem.holdings.push({
        id: "h-" + Math.random().toString(36).substr(2, 9),
        symbol: upperSymbol,
        name: refTx.name,
        type: refTx.type,
        currency: refTx.currency,
        quantity: totalQty,
        buyPrice: Number(wacb.toFixed(4)),
        buyDate: earliestDate,
        exchangeRate: Number(avgExchangeRate.toFixed(4)),
        sector: refTx.sector || "General",
      });
    }
  }
}

export async function deleteHoldingWithTransactions(userId: string, id: string): Promise<boolean> {
  const db = await getDbSafe();
  const holdings = await getHoldings(userId);
  const holding = holdings.find((h) => h.id === id);
  if (!holding) return false;
  
  const upperSymbol = holding.symbol.toUpperCase();
  
  if (db) {
    const res = await db.collection("holdings").deleteOne({ id, userId });
    await db.collection("transactions").deleteMany({ userId, symbol: upperSymbol });
    return res.deletedCount > 0;
  } else {
    const userMem = getUserMemDb(userId);
    const initialLen = userMem.holdings.length;
    userMem.holdings = userMem.holdings.filter((h) => h.id !== id);
    userMem.transactions = (userMem.transactions || []).filter((t) => t.symbol.toUpperCase() !== upperSymbol);
    return userMem.holdings.length < initialLen;
  }
}
