import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";

// GET all parts or search by query
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    let result;
    if (query && query.trim()) {
      result = await db
        .select()
        .from(parts)
        .where(
          or(
            ilike(parts.partNumber, `%${query}%`),
            ilike(parts.description, `%${query}%`)
          )
        )
        .orderBy(parts.createdAt);
    } else {
      result = await db.select().from(parts).orderBy(parts.createdAt);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/parts error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch parts" },
      { status: 500 }
    );
  }
}

// POST create a new part
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partNumber, description, minWeight, maxWeight, quantity, actualWeight } =
      body;

    if (
      !partNumber ||
      !description ||
      minWeight === undefined ||
      maxWeight === undefined ||
      quantity === undefined ||
      actualWeight === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    const minW = parseFloat(minWeight);
    const maxW = parseFloat(maxWeight);
    const qty = parseInt(quantity);
    const actW = parseFloat(actualWeight);

    if (!Number.isFinite(minW) || !Number.isFinite(maxW) || !Number.isFinite(actW)) {
      return NextResponse.json(
        { success: false, error: "Weights must be valid numbers" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json(
        { success: false, error: "Quantity must be a positive integer" },
        { status: 400 }
      );
    }
    if (minW >= maxW) {
      return NextResponse.json(
        {
          success: false,
          error: "Minimum weight must be less than maximum weight",
        },
        { status: 400 }
      );
    }

    const [newPart] = await db
      .insert(parts)
      .values({
        partNumber: partNumber.trim().toUpperCase(),
        description: description.trim(),
        minWeight: minW.toFixed(3),
        maxWeight: maxW.toFixed(3),
        quantity: qty,
        actualWeight: actW.toFixed(3),
      })
      .returning();

    return NextResponse.json({ success: true, data: newPart }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/parts error:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { success: false, error: "Part number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create part" },
      { status: 500 }
    );
  }
}
