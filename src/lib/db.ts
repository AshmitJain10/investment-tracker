import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/investment-tracker";
const MONGODB_DB = process.env.MONGODB_DB || "investment-tracker";

// Global cache to prevent multiple client connections in development
interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = global as typeof globalThis & GlobalWithMongo;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

/**
 * Helper to get the MongoDB database object directly
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  try {
    const activeClient = await clientPromise;
    const db = activeClient.db(MONGODB_DB);
    return { client: activeClient, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error("MongoDB connection failed. Please ensure MONGODB_URI is valid and MongoDB is running.");
  }
}

export default clientPromise;
