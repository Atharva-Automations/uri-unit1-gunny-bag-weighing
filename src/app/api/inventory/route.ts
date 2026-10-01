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

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partId = searchParams.get("partId");

    let partRows;
    if (partId && Number.isInteger(Number(partId))) {
      partRows = await db.select().from(parts).where(eq(parts.id, Number(partId)));
    } else {
      partRows = await db.select().from(parts).orderBy(parts.partNumber);
    }

    if (partRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const partIds = partRows.map((p) => p.id);

    const returnWhere = partIds.length === 1
      ? and(eq(compoundReturns.partId, partIds[0]), eq(compoundReturns.addToInventory, 1))
      : and(inArray(compoundReturns.partId, partIds), eq(compoundReturns.addToInventory, 1));

    const [inwardTotals, outwardTotals, returnTotals, weighedTotals] = await Promise.all([
      db
        .select({
          partId: compoundInwards.partId,
          total: sql<number>`coalesce(sum(${compoundInwards.quantity}), 0)::int`,
        })
        .from(compoundInwards)
        .where(partIds.length === 1 ? eq(compoundInwards.partId, partIds[0]) : inArray(compoundInwards.partId, partIds))
        .groupBy(compoundInwards.partId),
      db
        .select({
          partId: compoundOutwards.partId,
          total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int`,
        })
        .from(compoundOutwards)
        .where(partIds.length === 1 ? eq(compoundOutwards.partId, partIds[0]) : inArray(compoundOutwards.partId, partIds))
        .groupBy(compoundOutwards.partId),
      db
        .select({
          partId: compoundReturns.partId,
          total: sql<number>`coalesce(sum(${compoundReturns.quantity}), 0)::int`,
        })
        .from(compoundReturns)
        .where(returnWhere)
        .groupBy(compoundReturns.partId),
      db
        .select({
          partId: weighingHistory.partId,
          total: sql<number>`coalesce(sum(${weighingHistory.quantity}), 0)::int`,
        })
        .from(weighingHistory)
        .where(
          and(
            partIds.length === 1
              ? eq(weighingHistory.partId, partIds[0])
              : inArray(weighingHistory.partId, partIds),
            // Only "OK" weighings add to inventory. UNDERWEIGHT and OVERWEIGHT
            // transactions are recorded for audit but never create or update an
            // inventory entry.
            eq(weighingHistory.status, "OK")
          )
        )
        .groupBy(weighingHistory.partId),
    ]);

    const inwardMap = new Map(inwardTotals.map((row) => [row.partId, Number(row.total)]));
    const outwardMap = new Map(outwardTotals.map((row) => [row.partId, Number(row.total)]));
    const returnMap = new Map(returnTotals.map((row) => [row.partId, Number(row.total)]));
    const weighedMap = new Map(weighedTotals.map((row) => [row.partId, Number(row.total)]));

    const inventoryData = partRows.map((part) => {
      const baseQty = 0;
      const inwards = inwardMap.get(part.id) ?? 0;
      const outwards = outwardMap.get(part.id) ?? 0;
      const returns = returnMap.get(part.id) ?? 0;
      const weighed = weighedMap.get(part.id) ?? 0;
      const avlQuantity = baseQty + inwards - outwards + returns + weighed;

      return {
        id: part.id,
        partNumber: part.partNumber,
        description: part.description,
        baseQuantity: baseQty,
        totalInwards: inwards,
        totalOutwards: outwards,
        totalReturns: returns,
        weighedQuantity: weighed,
        avlQuantity,
      };
    });

    return NextResponse.json({ success: true, data: inventoryData });
  } catch (error) {
    console.error("GET /api/inventory error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}