import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, weighingHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeLabelPDF } from "@/utils/pdf";

export const runtime = "nodejs";

/**
 * GET /api/parts/[id]/label-pdf
 * Streams a single-label PDF (A6 landscape) for the part. If a
 * `recordId` query parameter is provided, the actual measured weight
 * and status from that record are included on the label.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const [part] = await db.select().from(parts).where(eq(parts.id, partId));
    if (!part) {
      return NextResponse.json({ success: false, error: "Part not found" }, { status: 404 });
    }

    let actualWeight: string | null = null;
    let status: string | null = null;
    let operatorName: string | null = null;
    let remarks: string | null = null;
    let recordedAt: string | null = null;
    const recordId = request.nextUrl.searchParams.get("recordId");
    if (recordId) {
      const rid = parseInt(recordId);
      if (!isNaN(rid)) {
        const [rec] = await db
          .select()
          .from(weighingHistory)
          .where(eq(weighingHistory.id, rid));
        if (rec) {
          actualWeight = rec.actualWeight;
          status = rec.status;
          operatorName = rec.operatorName;
          remarks = rec.remarks;
          recordedAt = rec.recordedAt;
        }
      }
    }

    const buffer = await writeLabelPDF({
      partNumber: part.partNumber,
      description: part.description,
      minWeight: part.minWeight,
      maxWeight: part.maxWeight,
      quantity: part.quantity,
      actualWeight: part.actualWeight,
      recordActualWeight: actualWeight,
      status,
      operatorName,
      remarks,
      recordedAt,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${part.partNumber}-label.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Label PDF error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate label PDF: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
