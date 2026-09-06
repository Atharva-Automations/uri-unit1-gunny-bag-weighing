import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weighingHistory } from "@/db/schema";
import { eq } from "drizzle-orm";

// DELETE history record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const histId = parseInt(id);
    if (isNaN(histId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(weighingHistory)
      .where(eq(weighingHistory.id, histId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("DELETE /api/history/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete record" },
      { status: 500 }
    );
  }
}
