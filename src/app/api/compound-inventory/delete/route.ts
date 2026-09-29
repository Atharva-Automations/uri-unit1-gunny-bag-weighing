import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundCis, compoundInwards, compoundOutwards, compoundReturns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { COMPOUND_SESSION_COOKIE, isValidCompoundSession } from "@/utils/compoundAuth";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  try {
    // Authentication disabled
    // if (!isValidCompoundSession(request.cookies.get(COMPOUND_SESSION_COOKIE)?.value)) {
    //   return NextResponse.json({ success: false, error: "Compound Inventory login required" }, { status: 401 });
    // }

    const body = await request.json();
    const partId = Number(body.partId);

    if (!Number.isInteger(partId)) {
      return NextResponse.json({ success: false, error: "Valid part ID is required" }, { status: 400 });
    }

    // Delete all related records in a transaction
    await db.transaction(async (tx) => {
      // Delete returns first (they reference outwards)
      await tx.delete(compoundReturns).where(eq(compoundReturns.partId, partId));

      // Delete outwards (they reference cis)
      await tx.delete(compoundOutwards).where(eq(compoundOutwards.partId, partId));

      // Delete CIS (they reference inwards)
      await tx.delete(compoundCis).where(eq(compoundCis.partId, partId));

      // Delete inwards
      await tx.delete(compoundInwards).where(eq(compoundInwards.partId, partId));
    });

    return NextResponse.json({ success: true, message: "All compound inventory records for this part have been deleted" });
  } catch (error) {
    console.error("DELETE /api/compound-inventory/delete error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete compound inventory records" }, { status: 500 });
  }
}
