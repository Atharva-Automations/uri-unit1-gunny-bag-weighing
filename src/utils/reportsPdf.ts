import PDFDocument from "pdfkit";
import type { ReportRow } from "@/app/api/reports/route";
import { COMPANY_NAME } from "./label";

const NAVY = "#17324d";
const SLATE = "#64748b";
const INK = "#0f172a";
const LINE = "#e2e8f0";

/**
 * Column layout for a table drawn inside `left`/`width`. `offset` is the
 * distance from the table's left edge, `w` the cell width. Widths must stay
 * positive: pdfkit loops forever when it is asked to lay out text in a
 * negative width, so every width is clamped before use.
 */
type Column = { label: string; offset: number; w: number; align?: "left" | "right" };

const SUMMARY_COLUMNS: Column[] = [
  { label: "Part Number", offset: 14, w: 88 },
  { label: "Description", offset: 106, w: 150 },
  { label: "Inventory", offset: 260, w: 58, align: "right" },
  { label: "Inward", offset: 322, w: 52, align: "right" },
  { label: "Outward", offset: 378, w: 52, align: "right" },
  { label: "Available", offset: 434, w: 58, align: "right" },
];

const INWARD_COLUMNS: Column[] = [
  { label: "Inward No.", offset: 14, w: 120 },
  { label: "Label Code", offset: 138, w: 148 },
  { label: "Supplier", offset: 290, w: 110 },
  { label: "Qty", offset: 404, w: 44, align: "right" },
  { label: "Received", offset: 452, w: 40, align: "right" },
];

const OUTWARD_COLUMNS: Column[] = [
  { label: "Outward No.", offset: 14, w: 120 },
  { label: "From Inward", offset: 138, w: 132 },
  { label: "Destination", offset: 274, w: 120 },
  { label: "Qty", offset: 398, w: 44, align: "right" },
  { label: "Dispatched", offset: 446, w: 46, align: "right" },
];

const RETURN_COLUMNS: Column[] = [
  { label: "Reason", offset: 14, w: 280 },
  { label: "Qty", offset: 404, w: 44, align: "right" },
  { label: "Returned", offset: 452, w: 40, align: "right" },
];

/** Guard against non-positive widths reaching pdfkit. */
function cellWidth(column: Column, tableWidth: number) {
  return Math.max(12, Math.min(column.w, tableWidth - column.offset - 8));
}

function fmtDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${date.toLocaleTimeString(
    "en-IN",
    { hour: "2-digit", minute: "2-digit", hour12: true }
  )}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return name;
}

const ROW_H = 22;
const HEAD_H = 26;
const PAGE_TOP = 50;
const PAGE_BOTTOM_MARGIN = 55;

export type ReportsPdfOptions = {
  rows: ReportRow[];
  title: string;
  scope: string;
};

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                         */
/* ────────────────────────────────────────────────────────────────── */

/** Usable vertical space on a page. */
function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PAGE_BOTTOM_MARGIN;
}

/** Ensure at least `needed` vertical space; add page if not. Returns updated y. */
function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > pageBottom(doc)) {
    doc.addPage();
    return PAGE_TOP;
  }
  return y;
}

/** Draw a section title with a blue underline. */
function sectionTitle(doc: PDFKit.PDFDocument, left: number, y: number, title: string) {
  doc.fillColor(NAVY).fontSize(12).font("Helvetica-Bold").text(title, left, y, { lineBreak: false });
  const width = doc.widthOfString(title) + 6;
  doc.moveTo(left, y + 16).lineTo(left + width, y + 16).lineWidth(2).strokeColor("#3b82f6").stroke();
  return y + 28;
}

/** Draw a table header row. */
function drawTableHeader(doc: PDFKit.PDFDocument, left: number, y: number, width: number, columns: Column[]) {
  doc.rect(left, y, width, HEAD_H).fillColor(NAVY).fill();
  doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
  for (const column of columns) {
    doc.text(column.label, left + column.offset, y + 9, {
      width: cellWidth(column, width),
      align: column.align ?? "left",
      lineBreak: false,
    });
  }
  return y + HEAD_H;
}

/** Draw a single data row. `index` is used for zebra striping. */
function drawDataRow(
  doc: PDFKit.PDFDocument,
  left: number,
  y: number,
  width: number,
  columns: Column[],
  values: string[],
  index: number,
  colors?: string[]
) {
  if (index % 2 === 1) {
    doc.rect(left, y, width, ROW_H).fillColor("#f8fafc").fill();
  }
  columns.forEach((column, col) => {
    doc.fillColor(colors?.[col] ?? INK).fontSize(9).font("Helvetica");
    doc.text(values[col] ?? "", left + column.offset, y + 7, {
      width: cellWidth(column, width),
      align: column.align ?? "left",
      lineBreak: false,
    });
  });
  return y + ROW_H;
}

/**
 * Draw a table that properly splits across pages. Re-draws the header on
 * each new page. Returns the y position after the last row.
 */
function drawPaginatedTable(
  doc: PDFKit.PDFDocument,
  left: number,
  y: number,
  width: number,
  columns: Column[],
  rows: string[][],
  colors?: string[]
): number {
  // Ensure room for at least the header + 1 row
  y = ensureSpace(doc, y, HEAD_H + ROW_H);
  y = drawTableHeader(doc, left, y, width, columns);

  rows.forEach((row, index) => {
    if (y + ROW_H > pageBottom(doc)) {
      doc.addPage();
      y = PAGE_TOP;
      y = drawTableHeader(doc, left, y, width, columns);
    }
    y = drawDataRow(doc, left, y, width, columns, row, index, colors);
  });

  // Light border around the final segment
  return y;
}

/** Add page number footer at the bottom of each page. */
function addPageNumbers(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const pageWidth = doc.page.width;
    const bottomY = doc.page.height - 32;
    doc
      .fillColor(SLATE)
      .fontSize(8)
      .font("Helvetica")
      .text(`Page ${i + 1} of ${totalPages}`, 0, bottomY, {
        width: pageWidth,
        align: "center",
        lineBreak: false,
      });
  }
}

/* ────────────────────────────────────────────────────────────────── */
/*  Main PDF generator                                              */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Renders the month-wise / part-wise inventory report. When a single
 * part+month cell is selected the PDF includes that cell's transaction detail;
 * otherwise it prints the full summary grid.
 */
export async function generateReportsPDF({ rows, title, scope }: ReportsPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 45,
        autoFirstPage: true,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 45;
      const pageWidth = doc.page.width - 90;

      // ── Header ──
      doc.roundedRect(left, 40, pageWidth, 70, 10).fillColor(NAVY).fill();
      doc
        .fillColor("white")
        .fontSize(17)
        .font("Helvetica-Bold")
        .text(title, left + 18, 52, { width: pageWidth - 36, lineBreak: false });
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#cbd5e1")
        .text(
          `${COMPANY_NAME}  |  ${scope}  |  Generated ${fmtDateTime(new Date().toISOString())}`,
          left + 18,
          78,
          { width: pageWidth - 36, lineBreak: false }
        );

      let y = 128;

      // ── Empty state ──
      if (rows.length === 0) {
        doc
          .fillColor(SLATE)
          .fontSize(11)
          .font("Helvetica")
          .text("No inventory movements found for this period.", left, y);
        addPageNumbers(doc);
        doc.end();
        return;
      }

      // ── Totals ──
      const totalInward = rows.reduce((sum, row) => sum + row.monthlyInward, 0);
      const totalOutward = rows.reduce((sum, row) => sum + row.monthlyOutward, 0);
      const totalReturns = rows.reduce((sum, row) => sum + row.monthlyReturns, 0);
      const totalAvailable = rows.reduce((sum, row) => sum + row.available, 0);

      // ── Summary cards ──
      const cardW = (pageWidth - 24) / 4;
      const cards = [
        { label: "Monthly Inward", value: totalInward, color: "#3b82f6" },
        { label: "Monthly Outward", value: totalOutward, color: "#ef4444" },
        { label: "Returns", value: totalReturns, color: "#f59e0b" },
        { label: "Available (Closing)", value: totalAvailable, color: "#10b981" },
      ];
      cards.forEach((card, index) => {
        const x = left + index * (cardW + 8);
        doc.roundedRect(x, y, cardW, 56, 6).fillColor("#f8fafc").fill();
        doc
          .fillColor(SLATE)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(card.label.toUpperCase(), x + 10, y + 10, { width: cardW - 20, lineBreak: false });
        doc
          .fillColor(card.color)
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(String(card.value), x + 10, y + 28, { width: cardW - 20, lineBreak: false });
      });
      y += 56 + 24;

      // ── Summary grid (paginated row by row) ──
      y = sectionTitle(doc, left, y, "INVENTORY SUMMARY");

      const summaryRowColors = [INK, INK, INK, "#3b82f6", "#ef4444", "#10b981"];

      // Ensure room for header + at least 1 row
      y = ensureSpace(doc, y, HEAD_H + ROW_H);
      y = drawTableHeader(doc, left, y, pageWidth, SUMMARY_COLUMNS);

      rows.forEach((row, index) => {
        // If the current row won't fit, start a new page with a fresh header
        if (y + ROW_H > pageBottom(doc)) {
          doc.addPage();
          y = PAGE_TOP;
          y = drawTableHeader(doc, left, y, pageWidth, SUMMARY_COLUMNS);
        }

        // Zebra stripe
        if (index % 2 === 1) {
          doc.rect(left, y, pageWidth, ROW_H).fillColor("#f8fafc").fill();
        }

        const values = [
          row.partNumber,
          row.description,
          String(row.inventory),
          String(row.monthlyInward),
          String(row.monthlyOutward),
          String(row.available),
        ];

        SUMMARY_COLUMNS.forEach((column, col) => {
          doc.fillColor(row.available < 0 && col === 5 ? "#ef4444" : summaryRowColors[col]);
          doc.fontSize(9).font(col >= 3 ? "Helvetica-Bold" : "Helvetica");
          doc.text(values[col], left + column.offset, y + 7, {
            width: cellWidth(column, pageWidth),
            align: column.align ?? "left",
            lineBreak: false,
          });
        });
        y += ROW_H;
      });

      y += 24;

      // ── Transaction detail sections ──
      const detailRows = rows.filter(
        (row) => row.inwardRecords.length > 0 || row.outwardRecords.length > 0 || row.returnRecords.length > 0
      );

      for (const row of detailRows) {
        // Need space for title + formula line + at least a header row
        y = ensureSpace(doc, y, 28 + 20 + HEAD_H + ROW_H);

        y = sectionTitle(doc, left, y, `${row.partNumber} — ${monthLabel(row.monthKey)}`);
        doc
          .fillColor(SLATE)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Inventory ${row.inventory}  +  Inward ${row.monthlyInward}  -  Outward ${row.monthlyOutward}  +  Returns ${row.monthlyReturns}  =  Available ${row.available}`,
            left,
            y + 2,
            { width: pageWidth, lineBreak: false }
          );
        y += 20;

        if (row.inwardRecords.length > 0) {
          y = drawPaginatedTable(
            doc,
            left,
            y,
            pageWidth,
            INWARD_COLUMNS,
            row.inwardRecords.map((r) => [
              r.inwardNumber,
              r.labelCode,
              r.supplier || "—",
              String(r.quantity),
              fmtDateTime(r.receivedAt),
            ]),
            [INK, "#b45309", INK, "#3b82f6", SLATE]
          );
          y += 16;
        }

        if (row.outwardRecords.length > 0) {
          y = drawPaginatedTable(
            doc,
            left,
            y,
            pageWidth,
            OUTWARD_COLUMNS,
            row.outwardRecords.map((r) => [
              r.outwardNumber,
              r.inwardNumber || "—",
              r.destination || "—",
              String(r.quantity),
              fmtDateTime(r.dispatchedAt),
            ]),
            [INK, INK, INK, "#ef4444", SLATE]
          );
          y += 16;
        }

        if (row.returnRecords.length > 0) {
          y = drawPaginatedTable(
            doc,
            left,
            y,
            pageWidth,
            RETURN_COLUMNS,
            row.returnRecords.map((r) => [r.reason, String(r.quantity), fmtDateTime(r.returnedAt)]),
            [INK, "#f59e0b", SLATE]
          );
          y += 16;
        }

        y += 8;
      }

      // ── Page numbers ──
      addPageNumbers(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
