import { connectToDatabase } from "./db";
import { Holding, WatchlistItem, PriceAlert } from "../models/types";

// Multi-tenant in-memory database helper
interface UserDb {
  holdings: Holding[];
  watchlist: WatchlistItem[];
  alerts: PriceAlert[];
  targetAllocation: { stock: number; mutual_fund: number; gold: number };
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
            buyDate: "2023-06-15",
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
            buyDate: "2024-02-05",
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
    } else {
      // Real new users start empty with a default allocation
      memDb[normalizedId] = {
        holdings: [],
        watchlist: [],
        alerts: [],
        targetAllocation: { stock: 60, mutual_fund: 30, gold: 10 },
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
