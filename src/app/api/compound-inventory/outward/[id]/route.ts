import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundInwards, compoundOutwards, compoundReturns, parts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/compound-inventory/outward/[id]
 * Full detail for one outward transaction, including its related inward
 * record, cumulative outwarded/remaining quantity of that inward, and any
 * returns linked to the outward.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const outwardId = Number(id);
    if (!Number.isInteger(outwardId)) {
      return NextResponse.json({ success: false, error: "Invalid outward id" }, { status: 400 });
    }

    const [outward] = await db
      .select({
        id: compoundOutwards.id,
        outwardNumber: compoundOutwards.outwardNumber,
        labelCode: compoundOutwards.labelCode,
        inwardId: compoundOutwards.inwardId,
        partId: parts.id,
        partNumber: parts.partNumber,
        description: parts.description,
        quantity: compoundOutwards.quantity,
        destination: compoundOutwards.destination,
        operatorName: compoundOutwards.operatorName,
        remarks: compoundOutwards.remarks,
        dispatchedAt: compoundOutwards.dispatchedAt,
      })
      .from(compoundOutwards)
      .innerJoin(parts, eq(parts.id, compoundOutwards.partId))
      .where(eq(compoundOutwards.id, outwardId));

    if (!outward) {
      return NextResponse.json({ success: false, error: "Outward record not found" }, { status: 404 });
    }

    let inward = null;
    if (outward.inwardId) {
      const [row] = await db
        .select({
          id: compoundInwards.id,
          inwardNumber: compoundInwards.inwardNumber,
          labelCode: compoundInwards.labelCode,
          quantity: compoundInwards.quantity,
          supplier: compoundInwards.supplier,
          batchNumber: compoundInwards.batchNumber,
          operatorName: compoundInwards.operatorName,
          remarks: compoundInwards.remarks,
          receivedAt: compoundInwards.receivedAt,
        })
        .from(compoundInwards)
        .where(eq(compoundInwards.id, outward.inwardId));
      inward = row ?? null;
    }

    const siblingOutwards = outward.inwardId
      ? await db
          .select({
            id: compoundOutwards.id,
            outwardNumber: compoundOutwards.outwardNumber,
            quantity: compoundOutwards.quantity,
            destination: compoundOutwards.destination,
            dispatchedAt: compoundOutwards.dispatchedAt,
          })
          .from(compoundOutwards)
          .where(eq(compoundOutwards.inwardId, outward.inwardId))
      : [];

    const returns = await db
      .select({
        id: compoundReturns.id,
        quantity: compoundReturns.quantity,
        reason: compoundReturns.reason,
        addToInventory: compoundReturns.addToInventory,
        returnedAt: compoundReturns.returnedAt,
      })
      .from(compoundReturns)
      .where(eq(compoundReturns.outwardId, outwardId));

    const totalOutward = siblingOutwards.reduce((sum, row) => sum + Number(row.quantity), 0);
    const totalReturned = returns.reduce((sum, row) => sum + Number(row.quantity), 0);

    return NextResponse.json({
      success: true,
      data: {
        outward,
        inward,
        returns,
        summary: {
          inwardQuantity: inward ? Number(inward.quantity) : 0,
          outwardThis: Number(outward.quantity),
          totalOutward,
          remainingInward: inward ? Number(inward.quantity) - totalOutward : 0,
          outwardCount: siblingOutwards.length,
          totalReturned,
          siblingOutwards,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/compound-inventory/outward/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to load outward details" }, { status: 500 });
  }
}
