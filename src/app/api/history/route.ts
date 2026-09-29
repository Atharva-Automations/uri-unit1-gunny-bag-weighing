import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weighingHistory, parts } from "@/db/schema";
import { eq, desc, and, ilike, gte, lte } from "drizzle-orm";

// GET weighing history with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partNumber = searchParams.get("partNumber");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const conditions = [];

    if (partNumber && partNumber.trim()) {
      conditions.push(ilike(weighingHistory.partNumber, `%${partNumber}%`));
    }
    if (status && status !== "ALL") {
      conditions.push(eq(weighingHistory.status, status));
    }
    if (dateFrom) {
      conditions.push(
        gte(weighingHistory.recordedAt, new Date(dateFrom + "T00:00:00"))
      );
    }
    if (dateTo) {
      conditions.push(
        lte(weighingHistory.recordedAt, new Date(dateTo + "T23:59:59"))
      );
    }

    const result = await db
      .select()
      .from(weighingHistory)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(weighingHistory.recordedAt))
      .limit(500);

    // The recordedAt column is now TIMESTAMP WITH TIME ZONE.
    // Postgres returns proper UTC instants; just format in IST directly.
    const formatIST = (raw: unknown) => {
      return new Date(raw as string | number | Date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    };

    const formatted = result.map((r) => ({
      ...r,
      recordedAt: formatIST(r.recordedAt),
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

// POST create new weighing record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partId, actualWeight, quantity, operatorName, remarks } = body;

    if (!partId || actualWeight === undefined || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: "partId, actualWeight, and quantity are required" },
        { status: 400 }
      );
    }

    // Fetch part details
    const [part] = await db.select().from(parts).where(eq(parts.id, partId));
    if (!part) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    // Determine status against the part's per-bag expected range.
    // Min expected bag weight = minWeight * quantity (each item must be
    // at least minWeight). Max allowed bag weight = maxWeight * quantity
    // (computed from the per-item max, no separate cap stored).
    const qty = parseInt(quantity);
    const minW = parseFloat(part.minWeight.toString()) * qty;
    const maxW = parseFloat(part.maxWeight.toString()) * qty;
    const actual = parseFloat(actualWeight);

    let status = "OK";
    if (actual < minW) status = "UNDERWEIGHT";
    else if (actual > maxW) status = "OVERWEIGHT";

    const [record] = await db
      .insert(weighingHistory)
      .values({
        partId: part.id,
        partNumber: part.partNumber,
        description: part.description,
        actualWeight: actual.toString(),
        quantity: parseInt(quantity),
        status,
        operatorName: operatorName?.trim() || null,
        remarks: remarks?.trim() || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error("POST /api/history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record weighing" },
      { status: 500 }
    );
  }
}
