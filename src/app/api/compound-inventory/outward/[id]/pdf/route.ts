import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundInwards, compoundOutwards, compoundReturns, parts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateOutwardPDF } from "@/utils/outwardPdf";

export const runtime = "nodejs";

/**
 * GET /api/compound-inventory/outward/[id]/pdf
 * Streams a complete, downloadable transaction-detail PDF for one outward,
 * including the related inward record and quantity breakdown.
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
        outwardNumber: compoundOutwards.outwardNumber,
        labelCode: compoundOutwards.labelCode,
        inwardId: compoundOutwards.inwardId,
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

    const [inward] = outward.inwardId
      ? await db
          .select({
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
          .where(eq(compoundInwards.id, outward.inwardId))
      : [null];

    const siblingOutwards = outward.inwardId
      ? await db
          .select({
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
        quantity: compoundReturns.quantity,
        reason: compoundReturns.reason,
        addToInventory: compoundReturns.addToInventory,
        returnedAt: compoundReturns.returnedAt,
      })
      .from(compoundReturns)
      .where(eq(compoundReturns.outwardId, outwardId));

    const totalOutward = siblingOutwards.reduce((sum, row) => sum + Number(row.quantity), 0);
    const buffer = await generateOutwardPDF({
      outwardNumber: outward.outwardNumber,
      labelCode: outward.labelCode,
      partNumber: outward.partNumber,
      description: outward.description,
      quantity: Number(outward.quantity),
      destination: outward.destination,
      operatorName: outward.operatorName,
      remarks: outward.remarks,
      dispatchedAt: outward.dispatchedAt,
      inward: inward ?? null,
      returns,
      inwardQuantity: inward ? Number(inward.quantity) : 0,
      totalOutward,
      remainingInward: inward ? Number(inward.quantity) - totalOutward : 0,
      outwardCount: siblingOutwards.length,
      siblingOutwards,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="outward-${outward.outwardNumber}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("GET /api/compound-inventory/outward/[id]/pdf error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate outward PDF" }, { status: 500 });
  }
}
