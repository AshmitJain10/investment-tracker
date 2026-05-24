import { connectToDatabase } from "./db";
import { Holding, WatchlistItem, PriceAlert } from "../models/types";

// In-memory fallback database for zero-config out-of-the-box local usage
interface InMemoryDb {
  holdings: Holding[];
  watchlist: WatchlistItem[];
  alerts: PriceAlert[];
  targetAllocation: { stock: number; mutual_fund: number; gold: number };
}

const globalWithStorage = global as typeof globalThis & {
  _inMemoryDb?: InMemoryDb;
};

// Seed some initial elegant holdings so the dashboard looks beautiful instantly
if (!globalWithStorage._inMemoryDb) {
  globalWithStorage._inMemoryDb = {
    holdings: [
      {
        id: "h1",
        symbol: "RELIANCE.NS",
        name: "Reliance Industries Ltd.",
        type: "stock",
        currency: "INR",
        quantity: 15,
        buyPrice: 2450.0,
        buyDate: "2024-01-15",
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
        buyDate: "2024-03-10",
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
        buyDate: "2023-11-20",
        exchangeRate: 83.2, // 83.2 INR per USD historically
        sector: "Technology",
      },
      {
        id: "h4",
        symbol: "120503", // SBI Bluechip Fund Scheme Code
        name: "SBI Bluechip Fund - Direct Growth",
        type: "mutual_fund",
        currency: "INR",
        quantity: 520.45,
        buyPrice: 76.85,
        buyDate: "2023-06-15",
        exchangeRate: 1.0,
        sector: "Mutual Funds",
      },
      {
        id: "h5",
        symbol: "GOLD", // Digital Gold gram tracker
        name: "Digital Gold (24K)",
        type: "gold",
        currency: "INR",
        quantity: 8.5,
        buyPrice: 6200.0,
        buyDate: "2024-02-05",
        exchangeRate: 1.0,
        sector: "Alternative Assets",
      },
      {
        id: "h6",
        symbol: "SGBDE32VIII.NS", // SGB Nov 2032 Bond
        name: "Sovereign Gold Bond 2.5% Dec 2032 Series",
        type: "sgb",
        currency: "INR",
        quantity: 10,
        buyPrice: 6150.0, // Issue/Purchase price
        buyDate: "2023-12-18",
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
  };
}

const memDb = globalWithStorage._inMemoryDb;

/**
 * Checks if MongoDB connection is fully functional.
 */
async function getDbSafe() {
  try {
    const { db } = await connectToDatabase();
    return db;
  } catch (error) {
    return null;
  }
}

// ==================== HOLDINGS CRUD ====================

export async function getHoldings(): Promise<Holding[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("holdings").find({}).toArray();
    return data.map(({ _id, ...rest }) => rest as Holding);
  }
  return memDb.holdings;
}

export async function addHolding(holding: Holding): Promise<Holding> {
  const db = await getDbSafe();
  if (db) {
    // Avoid _id leaks by not supplying it, or using custom structure
    await db.collection("holdings").insertOne({ ...holding });
  } else {
    memDb.holdings.push(holding);
  }
  return holding;
}

export async function updateHolding(id: string, updates: Partial<Holding>): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("holdings").updateOne({ id }, { $set: updates });
    return res.modifiedCount > 0;
  }
  const idx = memDb.holdings.findIndex((h) => h.id === id);
  if (idx !== -1) {
    memDb.holdings[idx] = { ...memDb.holdings[idx], ...updates };
    return true;
  }
  return false;
}

export async function deleteHolding(id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("holdings").deleteOne({ id });
    return res.deletedCount > 0;
  }
  const idx = memDb.holdings.findIndex((h) => h.id === id);
  if (idx !== -1) {
    memDb.holdings.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== WATCHLIST CRUD ====================

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("watchlist").find({}).toArray();
    return data.map(({ _id, ...rest }) => rest as WatchlistItem);
  }
  return memDb.watchlist;
}

export async function addWatchlistItem(item: WatchlistItem): Promise<WatchlistItem> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("watchlist").insertOne({ ...item });
  } else {
    memDb.watchlist.push(item);
  }
  return item;
}

export async function deleteWatchlistItem(id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("watchlist").deleteOne({ id });
    return res.deletedCount > 0;
  }
  const idx = memDb.watchlist.findIndex((w) => w.id === id);
  if (idx !== -1) {
    memDb.watchlist.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== PRICE ALERTS CRUD ====================

export async function getPriceAlerts(): Promise<PriceAlert[]> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("alerts").find({}).toArray();
    return data.map(({ _id, ...rest }) => rest as PriceAlert);
  }
  return memDb.alerts;
}

export async function addPriceAlert(alert: PriceAlert): Promise<PriceAlert> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("alerts").insertOne({ ...alert });
  } else {
    memDb.alerts.push(alert);
  }
  return alert;
}

export async function updatePriceAlert(id: string, updates: Partial<PriceAlert>): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("alerts").updateOne({ id }, { $set: updates });
    return res.modifiedCount > 0;
  }
  const idx = memDb.alerts.findIndex((a) => a.id === id);
  if (idx !== -1) {
    memDb.alerts[idx] = { ...memDb.alerts[idx], ...updates };
    return true;
  }
  return false;
}

export async function deletePriceAlert(id: string): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    const res = await db.collection("alerts").deleteOne({ id });
    return res.deletedCount > 0;
  }
  const idx = memDb.alerts.findIndex((a) => a.id === id);
  if (idx !== -1) {
    memDb.alerts.splice(idx, 1);
    return true;
  }
  return false;
}

// ==================== TARGET ALLOCATION CRUD ====================

export async function getTargetAllocation(): Promise<{ stock: number; mutual_fund: number; gold: number }> {
  const db = await getDbSafe();
  if (db) {
    const data = await db.collection("settings").findOne({ type: "target_allocation" });
    if (data) {
      return {
        stock: data.stock,
        mutual_fund: data.mutual_fund,
        gold: data.gold,
      };
    }
  }
  return memDb.targetAllocation;
}

export async function saveTargetAllocation(stock: number, mutual_fund: number, gold: number): Promise<boolean> {
  const db = await getDbSafe();
  if (db) {
    await db.collection("settings").updateOne(
      { type: "target_allocation" },
      { $set: { stock, mutual_fund, gold } },
      { upsert: true }
    );
    return true;
  }
  memDb.targetAllocation = { stock, mutual_fund, gold };
  return true;
}
