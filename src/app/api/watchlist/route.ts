import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getWatchlist,
  addWatchlistItem,
  deleteWatchlistItem,
  getPriceAlerts,
  addPriceAlert,
  updatePriceAlert,
  deletePriceAlert,
} from "@/lib/storage";
import { WatchlistItem, PriceAlert } from "@/models/types";

/**
 * GET: Retrieve watchlist or price alerts
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "alerts") {
      const alerts = await getPriceAlerts();
      return NextResponse.json({ success: true, data: alerts });
    }

    const list = await getWatchlist();
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Add to watchlist or create a price alert
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    if (action === "add_alert") {
      const { symbol, targetPrice, condition } = body;
      if (!symbol || targetPrice === undefined || !condition) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
      }

      const newAlert: PriceAlert = {
        id: uuidv4(),
        symbol: symbol.toUpperCase(),
        targetPrice: Number(targetPrice),
        condition,
        active: true,
        createdAt: new Date().toISOString(),
      };

      await addPriceAlert(newAlert);
      return NextResponse.json({ success: true, data: newAlert }, { status: 201 });
    }

    const { symbol, name, type } = body;
    if (!symbol || !name || !type) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    let processedSymbol = symbol.trim().toUpperCase();
    if (type === "stock") {
      if (!processedSymbol.endsWith(".NS") && !processedSymbol.endsWith(".BO") && processedSymbol.length <= 6) {
        processedSymbol = `${processedSymbol}.NS`;
      }
    }

    const newItem: WatchlistItem = {
      id: uuidv4(),
      symbol: processedSymbol,
      name: name.trim(),
      type,
    };

    await addWatchlistItem(newItem);
    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Update alert status
 */
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    if (action === "update_alert") {
      const { id, active } = body;
      if (!id || active === undefined) {
        return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
      }

      const success = await updatePriceAlert(id, { active });
      if (!success) {
        return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: "Alert updated successfully" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Remove from watchlist or delete alert
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
    }

    if (action === "delete_alert") {
      const success = await deletePriceAlert(id);
      if (!success) {
        return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Price alert deleted" });
    }

    const success = await deleteWatchlistItem(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Watchlist item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Watchlist item removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
