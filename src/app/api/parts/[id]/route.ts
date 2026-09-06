import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET single part by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const [part] = await db.select().from(parts).where(eq(parts.id, partId));

    if (!part) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: part });
  } catch (error) {
    console.error("GET /api/parts/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch part" },
      { status: 500 }
    );
  }
}

// PUT update part
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { partNumber, description, minWeight, maxWeight, quantity, actualWeight } =
      body;

    if (parseFloat(minWeight) >= parseFloat(maxWeight)) {
      return NextResponse.json(
        {
          success: false,
          error: "Minimum weight must be less than maximum weight",
        },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(parts)
      .set({
        partNumber: partNumber.trim().toUpperCase(),
        description: description.trim(),
        minWeight: minWeight.toString(),
        maxWeight: maxWeight.toString(),
        quantity: parseInt(quantity),
        actualWeight: actualWeight.toString(),
        updatedAt: new Date(),
      })
      .where(eq(parts.id, partId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/parts/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update part" },
      { status: 500 }
    );
  }
}

// DELETE part
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(parts)
      .where(eq(parts.id, partId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("DELETE /api/parts/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete part" },
      { status: 500 }
    );
  }
}
