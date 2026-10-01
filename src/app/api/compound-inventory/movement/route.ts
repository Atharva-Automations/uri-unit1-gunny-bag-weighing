import { NextResponse } from "next/server";
import { db } from "@/db";
import { compoundInwards, compoundOutwards, parts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/compound-inventory/movement
 * Per-inward movement tracker data: every inward with the outward
 * transactions linked to it, how many times it was outwarded, the total
 * outward quantity and the remaining/available quantity.
 */
export async function GET() {
  try {
    const [inwardRows, outwardRows] = await Promise.all([
      db
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
          partId: parts.id,
          partNumber: parts.partNumber,
          description: parts.description,
        })
        .from(compoundInwards)
        .innerJoin(parts, eq(parts.id, compoundInwards.partId))
        .orderBy(compoundInwards.receivedAt),

      db
        .select({
          id: compoundOutwards.id,
          outwardNumber: compoundOutwards.outwardNumber,
          inwardId: compoundOutwards.inwardId,
          quantity: compoundOutwards.quantity,
          destination: compoundOutwards.destination,
          operatorName: compoundOutwards.operatorName,
          remarks: compoundOutwards.remarks,
          dispatchedAt: compoundOutwards.dispatchedAt,
        })
        .from(compoundOutwards)
        .orderBy(compoundOutwards.dispatchedAt),
    ]);

    const outwardTotals = await db
      .select({
        inwardId: compoundOutwards.inwardId,
        total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int`,
      })
      .from(compoundOutwards)
      .groupBy(compoundOutwards.inwardId);
    const totalMap = new Map(outwardTotals.map((row) => [row.inwardId, Number(row.total)]));
    const countMap = new Map<number, number>();
    for (const row of outwardRows) {
      if (row.inwardId == null) continue;
      countMap.set(row.inwardId, (countMap.get(row.inwardId) ?? 0) + 1);
    }

    const outwardsByInward = new Map<number, typeof outwardRows>();
    for (const row of outwardRows) {
      if (row.inwardId == null) continue;
      const list = outwardsByInward.get(row.inwardId) ?? [];
      list.push(row);
      outwardsByInward.set(row.inwardId, list);
    }

    const movements = inwardRows.map((inward) => {
      const outwards = outwardsByInward.get(inward.id) ?? [];
      const totalOutward = totalMap.get(inward.id) ?? 0;
      return {
        inward,
        outwards,
        outwardCount: countMap.get(inward.id) ?? 0,
        totalOutward,
        available: inward.quantity - totalOutward,
      };
    });

    return NextResponse.json({ success: true, data: movements });
  } catch (error) {
    console.error("GET /api/compound-inventory/movement error:", error);
    return NextResponse.json({ success: false, error: "Failed to load movement tracker data" }, { status: 500 });
  }
}
