import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundInwards, compoundOutwards, compoundReturns, parts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * IST (UTC+5:30) month window for a stored TIMESTAMPTZ. `received_at` and
 * `dispatched_at` hold UTC instants, so month boundaries must be built in IST
 * before they are compared.
 */
function istMonthWindow(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, -5, -30, 0)),
    end: new Date(Date.UTC(year, month, 1, -5, -30, 0) - 1),
  };
}

export type ReportInwardRecord = {
  id: number;
  inwardNumber: string;
  labelCode: string;
  quantity: number;
  receivedAt: string;
  supplier: string | null;
  batchNumber: string | null;
  operatorName: string | null;
};

export type ReportOutwardRecord = {
  id: number;
  outwardNumber: string;
  quantity: number;
  dispatchedAt: string;
  destination: string | null;
  operatorName: string | null;
  inwardNumber: string | null;
};

export type ReportReturnRecord = {
  id: number;
  quantity: number;
  reason: string;
  returnedAt: string;
};

export type ReportRow = {
  partId: number;
  partNumber: string;
  description: string;
  inventory: number;
  monthlyInward: number;
  monthlyOutward: number;
  monthlyReturns: number;
  available: number;
  monthKey: string;
  inwardRecords: ReportInwardRecord[];
  outwardRecords: ReportOutwardRecord[];
  returnRecords: ReportReturnRecord[];
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthChain(first: string, last: string) {
  const [startYear, startMonth] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  const keys: string[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (keys.length > 240) break; // 20-year safety cap
  }
  return keys;
}

/**
 * GET /api/reports?year=2026[&month=1..12]
 *
 * Month-wise, part-wise inventory report. For each part and month:
 *   inventory      = opening stock (the previous month's available quantity)
 *   monthlyInward  = compound inward quantity received that month
 *   monthlyOutward = compound outward quantity dispatched that month
 *   available      = inventory + monthlyInward + returns - monthlyOutward
 *
 * The chain is replayed from the first month that has activity so the opening
 * balance of a month always equals the closing balance of the previous one.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const yearParam = request.nextUrl.searchParams.get("year");
    const year =
      yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : now.getUTCFullYear();
    const monthParam = request.nextUrl.searchParams.get("month");
    const month =
      monthParam && /^\d{1,2}$/.test(monthParam) && Number(monthParam) >= 1 && Number(monthParam) <= 12
        ? Number(monthParam)
        : null;

    const [inwardRows, outwardRows, returnRows] = await Promise.all([
      db.select().from(compoundInwards).orderBy(compoundInwards.receivedAt),
      db.select().from(compoundOutwards).orderBy(compoundOutwards.dispatchedAt),
      db.select().from(compoundReturns).where(eq(compoundReturns.addToInventory, 1)),
    ]);

    // Part metadata for every part that appears in any movement.
    const partIds = [
      ...new Set([...inwardRows, ...outwardRows, ...returnRows].map((row) => row.partId)),
    ];
    const partRows = partIds.length
      ? await db.select().from(parts).where(inArray(parts.id, partIds))
      : [];
    const partMeta = new Map<number, { partId: number; partNumber: string; description: string }>();
    for (const part of partRows) {
      partMeta.set(part.id, { partId: part.id, partNumber: part.partNumber, description: part.description });
    }
    for (const id of partIds) {
      if (!partMeta.has(id)) partMeta.set(id, { partId: id, partNumber: `#${id}`, description: "Unknown part" });
    }

    // Inward number for each outward, so the report shows the linked reference.
    const inwardById = new Map(inwardRows.map((row) => [row.id, row.inwardNumber]));

    const monthsWithActivity = new Set<string>();
    for (const row of inwardRows) monthsWithActivity.add(monthKey(row.receivedAt));
    for (const row of outwardRows) monthsWithActivity.add(monthKey(row.dispatchedAt));
    for (const row of returnRows) monthsWithActivity.add(monthKey(row.returnedAt));
    monthsWithActivity.add(`${year}-01`);

    const sorted = [...monthsWithActivity].sort();
    const chain = buildMonthChain(sorted[0], sorted[sorted.length - 1]);
    const chainSet = new Set(chain);
    const scopedMonths = month
      ? chain.filter((key) => key.split("-")[0] === String(year) && Number(key.split("-")[1]) === month)
      : chain.filter((key) => key.split("-")[0] === String(year));
    const scopedSet = new Set(scopedMonths);

    const rows: ReportRow[] = [];

    for (const meta of partMeta.values()) {
      // Opening balance before the first month in the chain.
      const firstWindow = istMonthWindow(
        Number(chain[0].split("-")[0]),
        Number(chain[0].split("-")[1])
      );
      let balance = 0;
      for (const row of inwardRows) {
        if (row.partId === meta.partId && row.receivedAt < firstWindow.start) balance += Number(row.quantity);
      }
      for (const row of outwardRows) {
        if (row.partId === meta.partId && row.dispatchedAt < firstWindow.start) balance -= Number(row.quantity);
      }
      for (const row of returnRows) {
        if (row.partId === meta.partId && row.returnedAt < firstWindow.start) balance += Number(row.quantity);
      }

      for (const key of chain) {
        if (!chainSet.has(key)) continue;
        const chainYear = Number(key.split("-")[0]);
        const chainMonth = Number(key.split("-")[1]);
        const window = istMonthWindow(chainYear, chainMonth);

        const inwards = inwardRows.filter(
          (r) => r.partId === meta.partId && r.receivedAt >= window.start && r.receivedAt <= window.end
        );
        const outwards = outwardRows.filter(
          (r) => r.partId === meta.partId && r.dispatchedAt >= window.start && r.dispatchedAt <= window.end
        );
        const returns = returnRows.filter(
          (r) => r.partId === meta.partId && r.returnedAt >= window.start && r.returnedAt <= window.end
        );

        const monthlyInward = inwards.reduce((sum, r) => sum + Number(r.quantity), 0);
        const monthlyOutward = outwards.reduce((sum, r) => sum + Number(r.quantity), 0);
        const monthlyReturns = returns.reduce((sum, r) => sum + Number(r.quantity), 0);
        const inventory = balance;
        const available = inventory + monthlyInward + monthlyReturns - monthlyOutward;
        // The closing balance of this month becomes next month's inventory.
        balance = available;

        if (!scopedSet.has(key)) continue;

        rows.push({
          ...meta,
          inventory,
          monthlyInward,
          monthlyOutward,
          monthlyReturns,
          available,
          monthKey: key,
          inwardRecords: inwards.map((r) => ({
            id: r.id,
            inwardNumber: r.inwardNumber,
            labelCode: r.labelCode,
            quantity: Number(r.quantity),
            receivedAt: new Date(r.receivedAt).toISOString(),
            supplier: r.supplier,
            batchNumber: r.batchNumber,
            operatorName: r.operatorName,
          })),
          outwardRecords: outwards.map((r) => ({
            id: r.id,
            outwardNumber: r.outwardNumber,
            quantity: Number(r.quantity),
            dispatchedAt: new Date(r.dispatchedAt).toISOString(),
            destination: r.destination,
            operatorName: r.operatorName,
            inwardNumber: r.inwardId ? inwardById.get(r.inwardId) ?? null : null,
          })),
          returnRecords: returns.map((r) => ({
            id: r.id,
            quantity: Number(r.quantity),
            reason: r.reason,
            returnedAt: new Date(r.returnedAt).toISOString(),
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        rows: rows.sort(
          (a, b) => a.partNumber.localeCompare(b.partNumber) || a.monthKey.localeCompare(b.monthKey)
        ),
        months: MONTH_NAMES.map((label, index) => ({
          value: index + 1,
          label,
          key: `${year}-${String(index + 1).padStart(2, "0")}`,
        })),
        availableYears: yearOptions(now.getUTCFullYear()),
      },
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
  }
}

function yearOptions(currentYear: number) {
  const years: number[] = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) years.push(y);
  return years;
}
