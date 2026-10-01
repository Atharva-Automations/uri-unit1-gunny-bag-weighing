import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  compoundInwards,
  compoundOutwards,
  compoundReturns,
  parts,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function reference(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const scan = request.nextUrl.searchParams.get("scan")?.trim();
    if (scan) {
      const [inward, outward] = await Promise.all([
        db
          .select({
            id: compoundInwards.id,
            labelCode: compoundInwards.labelCode,
            inwardNumber: compoundInwards.inwardNumber,
            quantity: compoundInwards.quantity,
            supplier: compoundInwards.supplier,
            batchNumber: compoundInwards.batchNumber,
            partId: parts.id,
            partNumber: parts.partNumber,
            description: parts.description,
          })
          .from(compoundInwards)
          .innerJoin(parts, eq(parts.id, compoundInwards.partId))
          .where(eq(compoundInwards.labelCode, scan)),
        db
          .select({
            id: compoundOutwards.id,
            outwardNumber: compoundOutwards.outwardNumber,
            quantity: compoundOutwards.quantity,
            partId: compoundOutwards.partId,
            partNumber: parts.partNumber,
            description: parts.description,
          })
          .from(compoundOutwards)
          .innerJoin(parts, eq(parts.id, compoundOutwards.partId))
          .where(eq(compoundOutwards.labelCode, scan)),
      ]);
      return NextResponse.json({
        success: true,
        data: { inward: inward[0] ?? null, outward: outward[0] ?? null },
      });
    }

    const [partRows, inwardTotals, outwardTotals, returnTotals, inwardRows, outwardRows, returnRows] =
      await Promise.all([
        db.select().from(parts).orderBy(parts.partNumber),
        db
          .select({
            partId: compoundInwards.partId,
            total: sql<number>`coalesce(sum(${compoundInwards.quantity}), 0)::int`,
          })
          .from(compoundInwards)
          .groupBy(compoundInwards.partId),
        db
          .select({
            partId: compoundOutwards.partId,
            total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int`,
          })
          .from(compoundOutwards)
          .groupBy(compoundOutwards.partId),
        db
          .select({
            partId: compoundReturns.partId,
            total: sql<number>`coalesce(sum(${compoundReturns.quantity}), 0)::int`,
          })
          .from(compoundReturns)
          .where(eq(compoundReturns.addToInventory, 1))
          .groupBy(compoundReturns.partId),
        db
          .select({
            record: compoundInwards,
            partNumber: parts.partNumber,
            description: parts.description,
          })
          .from(compoundInwards)
          .innerJoin(parts, eq(parts.id, compoundInwards.partId))
          .orderBy(desc(compoundInwards.receivedAt))
          .limit(200),
        db
          .select({
            record: compoundOutwards,
            partNumber: parts.partNumber,
            description: parts.description,
            inwardNumber: compoundInwards.inwardNumber,
          })
          .from(compoundOutwards)
          .innerJoin(parts, eq(parts.id, compoundOutwards.partId))
          .leftJoin(compoundInwards, eq(compoundInwards.id, compoundOutwards.inwardId))
          .orderBy(desc(compoundOutwards.dispatchedAt))
          .limit(200),
        db
          .select({
            record: compoundReturns,
            partNumber: parts.partNumber,
            description: parts.description,
          })
          .from(compoundReturns)
          .innerJoin(parts, eq(parts.id, compoundReturns.partId))
          .orderBy(desc(compoundReturns.returnedAt))
          .limit(200),
      ]);

    const totals = (rows: { partId: number; total: number }[]) =>
      new Map(rows.map((row) => [row.partId, Number(row.total)]));
    const inwardMap = totals(inwardTotals);
    const outwardMap = totals(outwardTotals);
    const returnMap = totals(returnTotals);
    const dashboard = partRows
      .map((part) => ({
        partId: part.id,
        partNumber: part.partNumber,
        description: part.description,
        totalInwards: inwardMap.get(part.id) ?? 0,
        totalOutwards: outwardMap.get(part.id) ?? 0,
        totalReturns: returnMap.get(part.id) ?? 0,
      }))
      .filter((row) => row.totalInwards > 0 || row.totalOutwards > 0 || row.totalReturns > 0);

    return NextResponse.json({
      success: true,
      data: {
        dashboard,
        inwards: inwardRows,
        outwards: outwardRows,
        returns: returnRows,
        parts: partRows,
      },
    });
  } catch (error) {
    console.error("GET /api/compound-inventory error:", error);
    return NextResponse.json({ success: false, error: "Failed to load Compound Inventory" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const partId = Number(body.partId);
    if (!Number.isInteger(partId)) {
      return NextResponse.json({ success: false, error: "A valid part is required" }, { status: 400 });
    }
    const [part] = await db.select().from(parts).where(eq(parts.id, partId));
    if (!part) return NextResponse.json({ success: false, error: "Part not found" }, { status: 404 });

    if (action === "inward") {
      const quantity = positiveInteger(body.quantity);
      if (!quantity)
        return NextResponse.json({ success: false, error: "Quantity must be a positive integer" }, { status: 400 });
      const [record] = await db
        .insert(compoundInwards)
        .values({
          partId,
          inwardNumber: reference("INW"),
          labelCode: reference("INW-LBL"),
          quantity,
          supplier: body.supplier?.trim() || null,
          batchNumber: body.batchNumber?.trim() || null,
          operatorName: body.operatorName?.trim() || null,
          remarks: body.remarks?.trim() || null,
        })
        .returning();
      return NextResponse.json({ success: true, type: "inward", data: record }, { status: 201 });
    }

    if (action === "outward") {
      const inwardId = Number(body.inwardId);
      const quantity = positiveInteger(body.quantity);
      if (!Number.isInteger(inwardId) || !quantity) {
        return NextResponse.json(
          { success: false, error: "Inward record and positive quantity are required" },
          { status: 400 }
        );
      }

      // Use a transaction to prevent race conditions on balance check + insert
      const result = await db.transaction(async (tx) => {
        const [inward] = await tx.select().from(compoundInwards).where(eq(compoundInwards.id, inwardId));
        if (!inward || inward.partId !== partId) return { error: "Inward record does not match the selected part" };

        const [outwarded] = await tx
          .select({ total: sql<number>`coalesce(sum(quantity), 0)::int` })
          .from(compoundOutwards)
          .where(eq(compoundOutwards.inwardId, inwardId));
        if (quantity + Number(outwarded.total) > inward.quantity) {
          return { error: "Outward quantity exceeds the remaining inward balance" };
        }

        const [record] = await tx
          .insert(compoundOutwards)
          .values({
            inwardId,
            partId,
            outwardNumber: reference("OUT"),
            quantity,
            destination: body.destination?.trim() || null,
            operatorName: body.operatorName?.trim() || null,
            remarks: body.remarks?.trim() || null,
          })
          .returning();
        return { record };
      });

      if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, type: "outward", data: result.record }, { status: 201 });
    }

    if (action === "return") {
      const quantity = positiveInteger(body.quantity);
      const reason = body.reason?.trim();
      if (!quantity || !reason)
        return NextResponse.json({ success: false, error: "Quantity and return reason are required" }, { status: 400 });
      const outwardId = body.outwardId ? Number(body.outwardId) : null;
      const inwardId = body.inwardId ? Number(body.inwardId) : null;
      const addToInventory =
        body.addToInventory === true || body.addToInventory === "true" || body.addToInventory === 1 ? 1 : 0;

      const result = await db.transaction(async (tx) => {
        let resolvedInwardId: number | null = Number.isInteger(inwardId) ? inwardId : null;

        if (outwardId && Number.isInteger(outwardId)) {
          const [outward] = await tx
            .select()
            .from(compoundOutwards)
            .where(and(eq(compoundOutwards.id, outwardId), eq(compoundOutwards.partId, partId)));
          if (!outward) return { error: "Outward record does not match the selected part" };

          const [returned] = await tx
            .select({ total: sql<number>`coalesce(sum(quantity), 0)::int` })
            .from(compoundReturns)
            .where(eq(compoundReturns.outwardId, outwardId));
          if (quantity + Number(returned.total) > outward.quantity) {
            return { error: "Return quantity exceeds the remaining outward balance" };
          }
          if (resolvedInwardId === null && outward.inwardId) resolvedInwardId = outward.inwardId;
        }

        if (resolvedInwardId !== null) {
          const [inward] = await tx
            .select()
            .from(compoundInwards)
            .where(and(eq(compoundInwards.id, resolvedInwardId), eq(compoundInwards.partId, partId)));
          if (!inward) return { error: "Inward record does not match the selected part" };
        }

        const [record] = await tx
          .insert(compoundReturns)
          .values({
            partId,
            outwardId: Number.isInteger(outwardId) ? outwardId : null,
            inwardId: resolvedInwardId,
            quantity,
            reason,
            batchNumber: body.batchNumber?.trim() || null,
            supplier: body.supplier?.trim() || null,
            inwardNumber: body.inwardNumber?.trim() || null,
            qualityGrade: body.qualityGrade?.trim() || null,
            operatorName: body.operatorName?.trim() || null,
            remarks: body.remarks?.trim() || null,
            addToInventory,
          })
          .returning();
        return { record };
      });

      if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, type: "return", data: result.record }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: "Unknown Compound Inventory action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/compound-inventory error:", error);
    return NextResponse.json({ success: false, error: "Failed to save Compound Inventory record" }, { status: 500 });
  }
}
