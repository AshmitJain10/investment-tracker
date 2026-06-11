import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { addTransaction, updateTransaction, deleteTransaction, getTransactionById, recalculateHoldingForSymbol } from "@/lib/storage";
import { fetchHistoricalExchangeRate } from "@/lib/math/forex";
import { Transaction } from "@/models/types";

/**
 * POST: Create a new raw transaction record and update the parent holding.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const body = await req.json();
    const { symbol, name, type, currency, quantity, buyPrice, buyDate, sector } = body;

    if (!symbol || !name || !type || quantity === undefined || buyPrice === undefined || !buyDate) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    let processedSymbol = symbol.trim().toUpperCase();
    if (type === "stock" && currency !== "USD") {
      if (!processedSymbol.endsWith(".NS") && !processedSymbol.endsWith(".BO")) {
        processedSymbol = `${processedSymbol}.NS`;
      }
    }

    let exchangeRate = 1.0;
    if (currency === "USD") {
      exchangeRate = await fetchHistoricalExchangeRate(buyDate);
    }

    const newTx: Transaction = {
      id: uuidv4(),
      userId,
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

    await addTransaction(userId, newTx);
    await recalculateHoldingForSymbol(userId, processedSymbol);

    return NextResponse.json({ success: true, data: newTx }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Edit an existing transaction.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const body = await req.json();
    const { id, buyDate, quantity, buyPrice } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing transaction ID" }, { status: 400 });
    }

    // Support migrating legacy holdings on edit
    if (id.startsWith("legacy-")) {
      const holdingId = id.replace("legacy-", "");
      const { getHoldings, addTransaction } = require("@/lib/storage");
      const holdings = await getHoldings(userId);
      const holding = holdings.find((h: any) => h.id === holdingId);
      if (!holding) {
        return NextResponse.json({ success: false, error: "Legacy holding not found" }, { status: 404 });
      }

      let exchangeRate = holding.exchangeRate || 1.0;
      const finalBuyDate = buyDate !== undefined ? buyDate : holding.buyDate;
      if (buyDate !== undefined && holding.currency === "USD") {
        exchangeRate = await fetchHistoricalExchangeRate(buyDate);
      }

      const newTx: Transaction = {
        id: uuidv4(),
        userId,
        symbol: holding.symbol.toUpperCase(),
        name: holding.name,
        type: holding.type,
        currency: holding.currency,
        quantity: quantity !== undefined ? Number(quantity) : holding.quantity,
        buyPrice: buyPrice !== undefined ? Number(buyPrice) : holding.buyPrice,
        buyDate: finalBuyDate,
        exchangeRate,
        sector: holding.sector,
      };

      await addTransaction(userId, newTx);
      await recalculateHoldingForSymbol(userId, holding.symbol);

      return NextResponse.json({ success: true, message: "Legacy holding migrated and updated successfully" });
    }

    const existingTx = await getTransactionById(userId, id);
    if (!existingTx) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const updates: Partial<Transaction> = {};
    if (buyDate !== undefined) updates.buyDate = buyDate;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (buyPrice !== undefined) updates.buyPrice = Number(buyPrice);

    // Recalculate exchange rate if date changed and currency is USD
    if (updates.buyDate && existingTx.currency === "USD") {
      updates.exchangeRate = await fetchHistoricalExchangeRate(updates.buyDate);
    }

    const success = await updateTransaction(userId, id, updates);
    if (!success) {
      return NextResponse.json({ success: false, error: "Failed to update transaction" }, { status: 500 });
    }

    // Recalculate the holding
    await recalculateHoldingForSymbol(userId, existingTx.symbol);

    return NextResponse.json({ success: true, message: "Transaction updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Delete a transaction.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id || session.user.email || "default";

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing transaction ID" }, { status: 400 });
    }

    // Support deleting virtual Gold SIP transactions
    if (id.startsWith("gold-sip-")) {
      const dateStr = id.replace("gold-sip-", "");
      const { getGoldSipData, saveGoldSipData } = require("@/lib/storage");
      const sipData = await getGoldSipData(userId);
      const updatedDates = sipData.checkedDates.filter((d: string) => d !== dateStr);
      await saveGoldSipData(userId, updatedDates, sipData.dailySipAmount);
      return NextResponse.json({ success: true, message: "Gold SIP transaction deleted successfully" });
    }

    // Support deleting legacy holdings
    if (id.startsWith("legacy-")) {
      const holdingId = id.replace("legacy-", "");
      const { deleteHolding } = require("@/lib/storage");
      const success = await deleteHolding(userId, holdingId);
      if (!success) {
        return NextResponse.json({ success: false, error: "Legacy holding not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Legacy holding deleted successfully" });
    }

    const existingTx = await getTransactionById(userId, id);
    if (!existingTx) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const success = await deleteTransaction(userId, id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Failed to delete transaction" }, { status: 500 });
    }

    // Recalculate the holding
    await recalculateHoldingForSymbol(userId, existingTx.symbol);

    return NextResponse.json({ success: true, message: "Transaction deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
