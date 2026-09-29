import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  compoundCis,
  compoundInwards,
  compoundOutwards,
  compoundReturns,
  parts,
} from "@/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { COMPOUND_SESSION_COOKIE, isValidCompoundSession } from "@/utils/compoundAuth";

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
    // Authentication disabled
    // if (!isValidCompoundSession(request.cookies.get(COMPOUND_SESSION_COOKIE)?.value)) {
    //   return NextResponse.json({ success: false, error: "Compound Inventory login required" }, { status: 401 });
    // }

    const scan = request.nextUrl.searchParams.get("scan")?.trim();
    if (scan) {
      const [inward, cis, outward] = await Promise.all([
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
            id: compoundCis.id,
            labelCode: compoundCis.labelCode,
            cisNumber: compoundCis.cisNumber,
            quantity: compoundCis.quantity,
            inwardId: compoundCis.inwardId,
            partId: parts.id,
            partNumber: parts.partNumber,
            description: parts.description,
          })
          .from(compoundCis)
          .innerJoin(parts, eq(parts.id, compoundCis.partId))
          .where(eq(compoundCis.labelCode, scan)),
        Promise.resolve([]),
      ]);
      return NextResponse.json({ success: true, data: { inward: inward[0] ?? null, cis: cis[0] ?? null, outward: outward[0] ?? null } });
    }

    const [partRows, inwardTotals, issuedTotals, outwardTotals, returnTotals, inwardRows, cisRows, outwardRows, returnRows] = await Promise.all([
      db.select().from(parts).orderBy(parts.partNumber),
      db.select({ partId: compoundInwards.partId, total: sql<number>`coalesce(sum(${compoundInwards.quantity}), 0)::int` }).from(compoundInwards).groupBy(compoundInwards.partId),
      db.select({ partId: compoundCis.partId, total: sql<number>`coalesce(sum(${compoundCis.quantity}), 0)::int` }).from(compoundCis).groupBy(compoundCis.partId),
      db.select({ partId: compoundOutwards.partId, total: sql<number>`coalesce(sum(${compoundOutwards.quantity}), 0)::int` }).from(compoundOutwards).groupBy(compoundOutwards.partId),
      db.select({ partId: compoundReturns.partId, total: sql<number>`coalesce(sum(${compoundReturns.quantity}), 0)::int` }).from(compoundReturns).groupBy(compoundReturns.partId),
      db.select({ record: compoundInwards, partNumber: parts.partNumber, description: parts.description }).from(compoundInwards).innerJoin(parts, eq(parts.id, compoundInwards.partId)).orderBy(desc(compoundInwards.receivedAt)).limit(100),
      db.select({ record: compoundCis, partNumber: parts.partNumber, description: parts.description, inwardNumber: compoundInwards.inwardNumber }).from(compoundCis).innerJoin(parts, eq(parts.id, compoundCis.partId)).innerJoin(compoundInwards, eq(compoundInwards.id, compoundCis.inwardId)).orderBy(desc(compoundCis.createdAt)).limit(100),
      db.select({ record: compoundOutwards, partNumber: parts.partNumber, description: parts.description, cisNumber: compoundCis.cisNumber }).from(compoundOutwards).innerJoin(parts, eq(parts.id, compoundOutwards.partId)).innerJoin(compoundCis, eq(compoundCis.id, compoundOutwards.cisId)).orderBy(desc(compoundOutwards.dispatchedAt)).limit(100),
      db.select({ record: compoundReturns, partNumber: parts.partNumber, description: parts.description, addToInventory: compoundReturns.addToInventory }).from(compoundReturns).innerJoin(parts, eq(parts.id, compoundReturns.partId)).orderBy(desc(compoundReturns.returnedAt)).limit(100),
    ]);

    const totals = (rows: { partId: number; total: number }[]) => new Map(rows.map((row) => [row.partId, Number(row.total)]));
    const inwardMap = totals(inwardTotals);
    const issuedMap = totals(issuedTotals);
    const outwardMap = totals(outwardTotals);
    const returnMap = totals(returnTotals);
    const dashboard = partRows
      .map((part) => ({
        partId: part.id,
        partNumber: part.partNumber,
        description: part.description,
        totalInwards: inwardMap.get(part.id) ?? 0,
        totalIssued: issuedMap.get(part.id) ?? 0,
        totalOutwards: outwardMap.get(part.id) ?? 0,
        totalReturns: returnMap.get(part.id) ?? 0,
        totalOutwardReturns: 0,
        totalGeneralReturns: 0,
      }))
      .filter((row) => row.totalInwards > 0 || row.totalIssued > 0 || row.totalOutwards > 0 || row.totalReturns > 0);

    return NextResponse.json({ success: true, data: { dashboard, inwards: inwardRows, cis: cisRows, outwards: outwardRows, returns: returnRows, parts: partRows } });
  } catch (error) {
    console.error("GET /api/compound-inventory error:", error);
    return NextResponse.json({ success: false, error: "Failed to load Compound Inventory" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication disabled
    // if (!isValidCompoundSession(request.cookies.get(COMPOUND_SESSION_COOKIE)?.value)) {
    //   return NextResponse.json({ success: false, error: "Compound Inventory login required" }, { status: 401 });
    // }

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
      if (!quantity) return NextResponse.json({ success: false, error: "Quantity must be a positive integer" }, { status: 400 });
      const [record] = await db.insert(compoundInwards).values({
        partId,
        inwardNumber: reference("INW"),
        labelCode: reference("INW-LBL"),
        quantity,
        supplier: body.supplier?.trim() || null,
        batchNumber: body.batchNumber?.trim() || null,
        operatorName: body.operatorName?.trim() || null,
        remarks: body.remarks?.trim() || null,
      }).returning();
      return NextResponse.json({ success: true, type: "inward", data: record }, { status: 201 });
    }

    if (action === "cis") {
      const inwardId = Number(body.inwardId);
      const quantity = positiveInteger(body.quantity);
      if (!Number.isInteger(inwardId) || !quantity) return NextResponse.json({ success: false, error: "Inward and positive quantity are required" }, { status: 400 });

      // Use a transaction to prevent race conditions on balance check + insert
      const result = await db.transaction(async (tx) => {
        const [inward] = await tx.select().from(compoundInwards).where(eq(compoundInwards.id, inwardId));
        if (!inward || inward.partId !== partId) return { error: "Inward record does not match the selected part" };

        const [issued] = await tx.select({ total: sql<number>`coalesce(sum(quantity), 0)::int` }).from(compoundCis).where(eq(compoundCis.inwardId, inwardId));
        if (quantity + Number(issued.total) > inward.quantity) return { error: "CIS quantity exceeds the inward balance" };

        const [record] = await tx.insert(compoundCis).values({
          inwardId,
          partId,
          cisNumber: reference("CIS"),
          labelCode: reference("CIS-LBL"),
          quantity,
          operatorName: body.operatorName?.trim() || null,
          remarks: body.remarks?.trim() || null,
        }).returning();
        return { record };
      });

      if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, type: "cis", data: result.record }, { status: 201 });
    }

    if (action === "outward") {
      const cisId = Number(body.cisId);
      const quantity = positiveInteger(body.quantity);
      if (!Number.isInteger(cisId) || !quantity) return NextResponse.json({ success: false, error: "CIS and positive quantity are required" }, { status: 400 });

      // Use a transaction to prevent race conditions on balance check + insert
      const result = await db.transaction(async (tx) => {
        const [cis] = await tx.select().from(compoundCis).where(eq(compoundCis.id, cisId));
        if (!cis || cis.partId !== partId) return { error: "CIS record does not match the selected part" };

        const [issued] = await tx.select({ total: sql<number>`coalesce(sum(quantity), 0)::int` }).from(compoundOutwards).where(eq(compoundOutwards.cisId, cisId));
        if (quantity + Number(issued.total) > cis.quantity) return { error: "Outward quantity exceeds the CIS balance" };

        const [record] = await tx.insert(compoundOutwards).values({
          cisId,
          partId,
          outwardNumber: reference("OUT"),
          quantity,
          destination: body.destination?.trim() || null,
          operatorName: body.operatorName?.trim() || null,
          remarks: body.remarks?.trim() || null,
        }).returning();
        return { record };
      });

      if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, type: "outward", data: result.record }, { status: 201 });
    }

    if (action === "return") {
      const quantity = positiveInteger(body.quantity);
      const reason = body.reason?.trim();
      if (!quantity || !reason) return NextResponse.json({ success: false, error: "Quantity and return reason are required" }, { status: 400 });
      const outwardId = body.outwardId ? Number(body.outwardId) : null;
      const cisId = body.cisId ? Number(body.cisId) : null;
      const addToInventory = body.addToInventory === true || body.addToInventory === "true" || body.addToInventory === 1 ? 1 : 0;

      const result = await db.transaction(async (tx) => {
        if (outwardId && Number.isInteger(outwardId)) {
          const [outward] = await tx.select().from(compoundOutwards).where(and(eq(compoundOutwards.id, outwardId), eq(compoundOutwards.partId, partId)));
          if (!outward) return { error: "Outward record does not match the selected part" };

          const [returned] = await tx.select({ total: sql<number>`coalesce(sum(quantity), 0)::int` }).from(compoundReturns).where(eq(compoundReturns.outwardId, outwardId));
          if (quantity + Number(returned.total) > outward.quantity) return { error: "Return quantity exceeds the remaining outward balance" };
        }

        if (cisId && Number.isInteger(cisId)) {
          const [cis] = await tx.select().from(compoundCis).where(and(eq(compoundCis.id, cisId), eq(compoundCis.partId, partId)));
          if (!cis) return { error: "CIS record does not match the selected part" };
        }

        const [record] = await tx.insert(compoundReturns).values({
          partId,
          outwardId: Number.isInteger(outwardId) ? outwardId : null,
          cisId: Number.isInteger(cisId) ? cisId : null,
          quantity,
          reason,
          batchNumber: body.batchNumber?.trim() || null,
          supplier: body.supplier?.trim() || null,
          inwardNumber: body.inwardNumber?.trim() || null,
          qualityGrade: body.qualityGrade?.trim() || null,
          operatorName: body.operatorName?.trim() || null,
          remarks: body.remarks?.trim() || null,
          addToInventory,
        }).returning();
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
