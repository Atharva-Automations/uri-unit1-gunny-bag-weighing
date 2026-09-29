import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  parts,
  weighingHistory,
  compoundInwards,
  compoundOutwards,
  compoundReturns,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { generateInventoryPDF } from "@/utils/inventoryPdf";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const partId = request.nextUrl.searchParams.get("partId");
    if (!partId || !Number.isInteger(Number(partId))) {
      return NextResponse.json({ success: false, error: "Valid part ID is required" }, { status: 400 });
    }

    const id = Number(partId);

    const [part] = await db.select().from(parts).where(eq(parts.id, id));
    if (!part) {
      return NextResponse.json({ success: false, error: "Part not found" }, { status: 404 });
    }

    const [inwardTotal, outwardTotal, returnTotal, weighedTotal] = await Promise.all([
      db
        .select({ total: sql<number>`coalesce(sum(${compoundInwards.quantity}), 0)::int` })
        .from(compoundInwards)
        .where(eq(compoundInwards.partId, id)),
      db
        .select({ total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int` })
        .from(compoundOutwards)
        .where(eq(compoundOutwards.partId, id)),
      db
        .select({ total: sql<number>`coalesce(sum(${compoundReturns.quantity}), 0)::int` })
        .from(compoundReturns)
        .where(and(eq(compoundReturns.partId, id), eq(compoundReturns.addToInventory, 1))),
      db
        .select({ total: sql<number>`coalesce(sum(${weighingHistory.quantity}), 0)::int` })
        .from(weighingHistory)
        .where(
          and(
            eq(weighingHistory.partId, id),
            inArray(weighingHistory.status, ["OK", "OVERWEIGHT"])
          )
        ),
    ]);

    const weighed = Number(weighedTotal[0]?.total ?? 0);

    const data = {
      partNumber: part.partNumber,
      description: part.description,
      avlQuantity: weighed + Number(inwardTotal[0].total) - Number(outwardTotal[0].total) + Number(returnTotal[0].total),
      baseQuantity: 0,
      weighedQuantity: weighed,
      totalInwards: Number(inwardTotal[0].total),
      totalOutwards: Number(outwardTotal[0].total),
      totalReturns: Number(returnTotal[0].total),
    };

    const pdfBuffer = await generateInventoryPDF(data);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inventory-${part.partNumber}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET /api/inventory/pdf error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 });
  }
}