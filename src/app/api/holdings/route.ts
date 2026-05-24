import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getHoldings, addHolding, updateHolding, deleteHolding } from "@/lib/storage";
import { fetchHistoricalExchangeRate } from "@/lib/math/forex";
import { Holding } from "@/models/types";

/**
 * GET: Retrieve all holdings
 */
export async function GET() {
  try {
    const holdings = await getHoldings();
    return NextResponse.json({ success: true, data: holdings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Create a new holding
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, name, type, currency, quantity, buyPrice, buyDate, sector } = body;

    if (!symbol || !name || !type || !quantity || buyPrice === undefined || !buyDate) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Process ticker based on currency & type
    let processedSymbol = symbol.trim().toUpperCase();
    if (type === "stock") {
      if (currency === "USD") {
        // Bypass .NS
      } else {
        // Default to Indian stocks by appending .NS if not present
        if (!processedSymbol.endsWith(".NS") && !processedSymbol.endsWith(".BO")) {
          processedSymbol = `${processedSymbol}.NS`;
        }
      }
    }

    // Calculate historical forex exchange rate if currency is USD
    let exchangeRate = 1.0;
    if (currency === "USD") {
      exchangeRate = await fetchHistoricalExchangeRate(buyDate);
    }

    const newHolding: Holding = {
      id: uuidv4(),
      symbol: processedSymbol,
      name: name.trim(),
      type,
      currency: currency || "INR",
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      buyDate,
      exchangeRate,
      sector: sector || "General",
    };

    await addHolding(newHolding);
    return NextResponse.json({ success: true, data: newHolding }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Update an existing holding
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing holding ID" }, { status: 400 });
    }

    // If buyDate is updated, recalculate exchangeRate
    if (updates.buyDate && updates.currency === "USD") {
      updates.exchangeRate = await fetchHistoricalExchangeRate(updates.buyDate);
    }

    const success = await updateHolding(id, updates);
    if (!success) {
      return NextResponse.json({ success: false, error: "Holding not found or no changes made" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Holding updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Delete a holding
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing holding ID" }, { status: 400 });
    }

    const success = await deleteHolding(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Holding not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Holding deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
