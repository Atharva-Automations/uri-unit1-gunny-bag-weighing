import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { compoundInwards, parts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { tscPrinterClient, getPrinter } from "@/utils/printer";
import { cleanLabelText, LABEL, COMPANY_NAME } from "@/utils/label";
import QRCode from "qrcode";

export const runtime = "nodejs";

/**
 * Compound Inventory label — same 100 mm × 50 mm format as the master
 * gunny-bag label. 203 dpi → 8 dots/mm. Width=800, Height=400 dots.
 *
 *  ┌──────────────────────── 800 dots (100 mm) ─────────────────────────┐
 *  │      UNITED RUBBER INDUSTRIES (I) PVT. LTD.                        │
 *  │ ─────────────────────────────────────────────────────────────────  │
 *  │  ┌────────┐ │  INWARD RECEIPT                                      │
 *  │  │        │ │  Ref No.   : INW-20260910-ABCDE                      │ 400 dots
 *  │  │   QR   │ │  Part No.  : PN-0001                                 │ (50 mm)
 *  │  │        │ │  Qty       : 500 pcs                                 │
 *  │  └────────┘ │  Supplier  : ABC Corp                                │
 *  │             │  Date      : 10-09-2026                              │
 *  └────────────────────────────────────────────────────────────────────┘
 */

function formatDate(d: Date | string) {
  return new Date(d)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
}

function buildCompoundTSPL(params: {
  type: "INWARD RECEIPT";
  labelCode: string;
  refNumber: string;
  partNumber: string;
  quantity: number;
  date: string;
  line1: string;
  line2?: string;
  line3?: string;
}): string {
  const { type, labelCode, refNumber, partNumber, quantity, date, line1, line2, line3 } = params;
  const clean = (s: string) => cleanLabelText(s).replace(/"/g, "'");

  // ── QR code encodes the label code for scanning ───────────────────
  const qr = QRCode.create(clean(labelCode), { errorCorrectionLevel: "M" });
  const cell = Math.floor(220 / (qr.modules.size + 8));
  const size = (qr.modules.size + 8) * cell;
  const qrX = LABEL.borderLeft + 4 + Math.floor((234 - size) / 2) + 4 * cell;
  const qrY = 90 + Math.floor((220 - size) / 2) + 4 * cell;

  const squares: string[] = [];
  for (let r = 0; r < qr.modules.size; r++) {
    for (let c = 0; c < qr.modules.size; c++) {
      if (qr.modules.get(r, c)) {
        squares.push(`BAR ${qrX + c * cell},${qrY + r * cell},${cell},${cell}`);
      }
    }
  }

  const tx = LABEL.textX; // 280 — same column as master label
  const maxChars = Math.floor((LABEL.borderRight - tx - 12) / LABEL.textCharWidth);
  const fmt = (s: string) => clean(s).slice(0, maxChars);

  // Company header — same as master label
  const companyText = COMPANY_NAME;
  const headerX = Math.floor((LABEL.width - companyText.length * LABEL.textCharWidth) / 2);

  const rows = [
    fmt(type),
    fmt(`Ref No.   : ${refNumber}`),
    fmt(`Part No.  : ${partNumber}`),
    fmt(`Qty       : ${quantity} pcs`),
    fmt(line1),
    ...(line2 ? [fmt(line2)] : []),
    ...(line3 ? [fmt(line3)] : []),
    fmt(`Date      : ${date}`),
  ];

  const startY = 100;
  const lineH = 30;
  const textLines = rows.map(
    (text, i) => `TEXT ${tx},${startY + i * lineH},"${LABEL.textFont}",0,1,1,"${text}"`
  );

  const tsplLines = [
    `SIZE ${LABEL.widthMm} mm, ${LABEL.heightMm} mm`,
    `GAP 3 mm, 0 mm`,
    `DIRECTION 0`,
    `REFERENCE 0,0`,
    `CLS`,
    // Outer border — identical to master label
    `BOX ${LABEL.borderLeft},12,${LABEL.borderRight},388,2`,
    // Company heading
    `TEXT ${headerX},42,"${LABEL.textFont}",0,1,1,"${companyText}"`,
    // Horizontal rule under heading
    `BAR 26,82,748,2`,
    // Vertical divider between QR area and text
    `BAR 260,82,2,306`,
    // QR modules
    ...squares,
    // Data rows
    ...textLines,
    `PRINT 1,1`,
    ``,
  ];

  return tsplLines.join("\r\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id } = body as { type: string; id: number };

    if (!type || !id || !Number.isInteger(Number(id))) {
      return NextResponse.json({ success: false, error: "type and id are required" }, { status: 400 });
    }

    const printer = getPrinter();
    let tspl: string;
    let refNumber: string;

    if (type === "inward") {
      const [row] = await db
        .select({ record: compoundInwards, partNumber: parts.partNumber })
        .from(compoundInwards)
        .innerJoin(parts, eq(parts.id, compoundInwards.partId))
        .where(eq(compoundInwards.id, Number(id)));

      if (!row)
        return NextResponse.json({ success: false, error: "Inward record not found" }, { status: 404 });
      refNumber = row.record.inwardNumber;

      tspl = buildCompoundTSPL({
        type: "INWARD RECEIPT",
        labelCode: row.record.labelCode,
        refNumber,
        partNumber: row.partNumber,
        quantity: row.record.quantity,
        date: formatDate(row.record.receivedAt),
        line1: `Supplier  : ${row.record.supplier || "—"}`,
        line2: row.record.batchNumber ? `Batch     : ${row.record.batchNumber}` : undefined,
        line3: row.record.operatorName ? `Operator  : ${row.record.operatorName}` : undefined,
      });
    } else {
      return NextResponse.json({ success: false, error: "type must be inward" }, { status: 400 });
    }

    await tscPrinterClient.send(printer.ip, printer.port, tspl);
    return NextResponse.json({ success: true, message: `Label printed for ${refNumber}` });
  } catch (error) {
    console.error("Compound print error:", error);
    const message = error instanceof Error ? error.message : "Print failed";
    return NextResponse.json({ success: false, error: `Print failed: ${message}` }, { status: 500 });
  }
}
