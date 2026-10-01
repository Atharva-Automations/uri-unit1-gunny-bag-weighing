import { NextRequest, NextResponse } from "next/server";
import { generateReportsPDF } from "@/utils/reportsPdf";
import { COMPANY_NAME } from "@/utils/label";
import type { ReportRow } from "@/app/api/reports/route";
export const runtime = "nodejs";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

type DetailRow = {
  id: number;
  inwardNumber: string;
  labelCode: string;
  quantity: number;
  receivedAt: string;
  supplier: string | null;
  batchNumber: string | null;
  operatorName: string | null;
};

type OutwardDetailRow = {
  id: number;
  outwardNumber: string;
  quantity: number;
  dispatchedAt: string;
  destination: string | null;
  operatorName: string | null;
  inwardNumber: string | null;
};

type ReturnDetailRow = {
  id: number;
  quantity: number;
  reason: string;
  returnedAt: string;
};

type Payload = {
  format?: "pdf" | "excel";
  scope?: "summary" | "detail";
  year: number;
  month?: number | null;
  rows: Array<
    Pick<
      ReportRow,
      "partNumber" | "description" | "monthKey" | "inventory" | "monthlyInward" | "monthlyOutward" | "monthlyReturns" | "available"
    > & {
      inwardRecords?: DetailRow[];
      outwardRecords?: OutwardDetailRow[];
      returnRecords?: ReturnDetailRow[];
    }
  >;
};

/**
 * POST /api/reports/export
 * Body: { format, scope, year, month, rows }
 * Generates the report file from the rows the client is currently viewing, so
 * the download always matches the on-screen selection (all parts/months or a
 * single part+month detail).
 */
export async function POST(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format") === "excel" ? "excel" : "pdf";
    const scope = request.nextUrl.searchParams.get("scope") === "detail" ? "detail" : "summary";

    let payload: Payload;
    try {
      payload = (await request.json()) as Payload;
    } catch {
      payload = { year: new Date().getUTCFullYear(), rows: [] };
    }

    const year = Number(payload.year) || new Date().getUTCFullYear();
    const month = payload.month ?? null;

    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const scopeLabel =
      scope === "detail" && rows.length === 1
        ? `${rows[0].partNumber} — ${monthLabel(rows[0].monthKey)}`
        : month
          ? `Month: ${MONTH_NAMES[month - 1]} ${year}`
          : `Year: ${year}`;

    if (format === "excel") {
      const csv = buildCsv(rows, scope);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="inventory-report-${scope}-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.csv"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    const buffer = await generateReportsPDF({
      rows: rows as unknown as ReportRow[],
      title: scope === "detail" ? "INVENTORY REPORT — DETAIL" : "MONTH-WISE INVENTORY REPORT",
      scope: `${COMPANY_NAME}  |  ${scopeLabel}`,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inventory-report-${scope}-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("POST /api/reports/export error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report file" }, { status: 500 });
  }
}

function buildCsv(
  rows: Payload["rows"],
  scope: "summary" | "detail"
) {
  const lines: string[] = [];
  lines.push(["UNITED RUBBER INDUSTRIES (I) PVT. LTD.", "Compound Inventory Report"].map(csvCell).join(","));
  lines.push(["Generated", new Date().toISOString()].map(csvCell).join(","));
  lines.push("");

  if (scope === "detail" && rows.length === 1) {
    const row = rows[0];
    lines.push(["Part Number", "Description", "Month", "Inventory", "Monthly Inward", "Monthly Outward", "Returns", "Available"].map(csvCell).join(","));
    lines.push(
      [row.partNumber, row.description, monthLabel(row.monthKey), row.inventory, row.monthlyInward, row.monthlyOutward, row.monthlyReturns ?? 0, row.available]
        .map(csvCell)
        .join(",")
    );
    lines.push("");
    if (row.inwardRecords?.length) {
      lines.push(["INWARD RECORDS"].map(csvCell).join(","));
      lines.push(["Inward No.", "Label Code", "Supplier", "Batch", "Operator", "Quantity", "Received At"].map(csvCell).join(","));
      for (const r of row.inwardRecords) {
        lines.push([r.inwardNumber, r.labelCode, r.supplier || "", r.batchNumber || "", r.operatorName || "", r.quantity, r.receivedAt].map(csvCell).join(","));
      }
      lines.push("");
    }
    if (row.outwardRecords?.length) {
      lines.push(["OUTWARD RECORDS"].map(csvCell).join(","));
      lines.push(["Outward No.", "From Inward", "Destination", "Operator", "Quantity", "Dispatched At"].map(csvCell).join(","));
      for (const r of row.outwardRecords) {
        lines.push([r.outwardNumber, r.inwardNumber || "", r.destination || "", r.operatorName || "", r.quantity, r.dispatchedAt].map(csvCell).join(","));
      }
      lines.push("");
    }
    if (row.returnRecords?.length) {
      lines.push(["RETURN RECORDS"].map(csvCell).join(","));
      lines.push(["Reason", "Quantity", "Returned At"].map(csvCell).join(","));
      for (const r of row.returnRecords) {
        lines.push([r.reason, r.quantity, r.returnedAt].map(csvCell).join(","));
      }
    }
    return lines.join("\r\n");
  }

  lines.push(["Part Number", "Description", "Month", "Inventory", "Monthly Inward", "Monthly Outward", "Returns", "Available"].map(csvCell).join(","));
  for (const row of rows) {
    lines.push(
      [row.partNumber, row.description, monthLabel(row.monthKey), row.inventory, row.monthlyInward, row.monthlyOutward, row.monthlyReturns ?? 0, row.available]
        .map(csvCell)
        .join(",")
    );
  }
  lines.push("");
  lines.push(
    ["TOTAL", "", "", "", rows.reduce((s, r) => s + r.monthlyInward, 0), rows.reduce((s, r) => s + r.monthlyOutward, 0), rows.reduce((s, r) => s + (r.monthlyReturns ?? 0), 0), rows.reduce((s, r) => s + r.available, 0)]
      .map(csvCell)
      .join(",")
  );
  return lines.join("\r\n");
}
