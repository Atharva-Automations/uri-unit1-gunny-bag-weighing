import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundCis, compoundInwards, compoundOutwards, compoundReturns, parts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { COMPOUND_SESSION_COOKIE, isValidCompoundSession } from "@/utils/compoundAuth";
import { generateCompoundInventoryPDF } from "@/utils/compoundPdf";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Authentication disabled
    // if (!isValidCompoundSession(request.cookies.get(COMPOUND_SESSION_COOKIE)?.value)) {
    //   return NextResponse.json({ success: false, error: "Compound Inventory login required" }, { status: 401 });
    // }

    const partId = request.nextUrl.searchParams.get("partId");
    if (!partId || !Number.isInteger(Number(partId))) {
      return NextResponse.json({ success: false, error: "Valid part ID is required" }, { status: 400 });
    }

    const id = Number(partId);

    // Fetch part details and movement data
    const [part] = await db.select().from(parts).where(eq(parts.id, id));
    if (!part) {
      return NextResponse.json({ success: false, error: "Part not found" }, { status: 404 });
    }

    const [inwardTotal, issuedTotal, outwardTotal, returnTotal] = await Promise.all([
      db.select({ total: sql<number>`coalesce(sum(${compoundInwards.quantity}), 0)::int` }).from(compoundInwards).where(eq(compoundInwards.partId, id)),
      db.select({ total: sql<number>`coalesce(sum(${compoundCis.quantity}), 0)::int` }).from(compoundCis).where(eq(compoundCis.partId, id)),
      db.select({ total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int` }).from(compoundOutwards).where(eq(compoundOutwards.partId, id)),
      db.select({ total: sql<number>`coalesce(sum(${compoundReturns.quantity}), 0)::int` }).from(compoundReturns).where(eq(compoundReturns.partId, id)),
    ]);

    const data = {
      partNumber: part.partNumber,
      description: part.description,
      totalInwards: Number(inwardTotal[0].total),
      totalIssued: Number(issuedTotal[0].total),
      totalOutwards: Number(outwardTotal[0].total),
      totalReturns: Number(returnTotal[0].total),
    };

    const pdfBuffer = await generateCompoundInventoryPDF(data);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="compound-inventory-${part.partNumber}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET /api/compound-inventory/pdf error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 });
  }
}
