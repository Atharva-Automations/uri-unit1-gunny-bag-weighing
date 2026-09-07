import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weighingHistory, parts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeRecordPDF } from "@/utils/pdf";

export const runtime = "nodejs";

/**
 * GET /api/history/[id]/pdf
 * Streams a full A4 record PDF for a single weighing history entry.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const histId = parseInt(id);
    if (isNaN(histId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const [rec] = await db
      .select()
      .from(weighingHistory)
      .where(eq(weighingHistory.id, histId));
    if (!rec) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }

    const [part] = await db.select().from(parts).where(eq(parts.id, rec.partId));
    if (!part) {
      return NextResponse.json({ success: false, error: "Part missing" }, { status: 404 });
    }

    const buffer = await writeRecordPDF({
      id: rec.id,
      partId: rec.partId,
      partNumber: rec.partNumber,
      description: rec.description,
      minWeight: part.minWeight,
      maxWeight: part.maxWeight,
      quantity: part.quantity,
      actualWeight: part.actualWeight,
      recordActualWeight: rec.actualWeight,
      status: rec.status,
      operatorName: rec.operatorName,
      remarks: rec.remarks,
      recordedAt: rec.recordedAt instanceof Date
        ? rec.recordedAt.toISOString()
        : String(rec.recordedAt ?? ""),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="record-${rec.id}-${rec.partNumber}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Record PDF error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate record PDF: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
