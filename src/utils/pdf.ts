/**
 * PDF helpers for the Gunny Bag project.
 *
 * Two main use-cases:
 *   1. Label PDF — A6 size with QR + part details (for downloading a
 *      single label before it's printed on the TSC, or for record-keeping).
 *   2. Record PDF — A4 size with full record metadata (used by the
 *      History page "Download" button).
 *
 * Uses pdfkit directly so we don't pull in a heavy client-side PDF lib.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export interface LabelPayload {
  partNumber: string;
  description: string;
  minWeight: string;
  maxWeight: string;
  quantity: number;
  actualWeight: string;
  recordActualWeight?: string | null;
  status?: string | null;
  recordedAt?: string | null;
  operatorName?: string | null;
  remarks?: string | null;
}

/**
 * Helper: drain a pdfkit document into a Buffer. Uses the document's
 * `on('data')` / `on('end')` events instead of piping into a Writable
 * collector, because the latter can hang in some Next.js dev (Turbopack)
 * environments, which in turn triggers the
 * "Jest worker encountered N child process exceptions" worker crash.
 */
function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Generate a single-label PDF (A6 landscape, 105×148mm) and return it
 * as a Buffer. Mirrors the new boxed TSPL label design.
 */
export async function writeLabelPDF(payload: LabelPayload): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A6",
    layout: "landscape",
    margins: { top: 24, bottom: 24, left: 24, right: 24 },
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  // ── Outer border (box) ──
  doc
    .rect(8, 8, pageW - 16, pageH - 16)
    .lineWidth(1.2)
    .strokeColor("#0f172a")
    .stroke();

  // ── Header band: "UNITED RUBBER" centered above a thick rule ──
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#0f172a")
    .text("UNITED RUBBER", 24, 18, { width: pageW - 48, align: "center" });
  doc
    .moveTo(20, 42)
    .lineTo(pageW - 20, 42)
    .strokeColor("#0f172a")
    .lineWidth(1.5)
    .stroke();

  // ── QR code (left) ──
  const qrSize = Math.min(pageH - 90, 100);
  const qrBuffer = await QRCode.toBuffer(payload.partNumber, {
    type: "png",
    margin: 1,
    width: qrSize * 3,
    errorCorrectionLevel: "H",
  });
  const qrX = 24;
  const qrY = 60;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // ── Vertical separator between QR and data column ──
  const sepX = qrX + qrSize + 18;
  doc
    .moveTo(sepX, 56)
    .lineTo(sepX, pageH - 24)
    .strokeColor("#0f172a")
    .lineWidth(0.8)
    .stroke();

  // ── Right-side details ──
  const txtX = sepX + 12;
  const txtW = pageW - txtX - 24;
  let y = 60;

  const row = (
    label: string,
    value: string,
    opts?: { bold?: boolean; size?: number; color?: string }
  ) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#64748b")
      .text(label.toUpperCase(), txtX, y, { width: 70 });
    doc
      .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts?.size ?? 9)
      .fillColor(opts?.color ?? "#1e293b")
      .text(value, txtX + 75, y, { width: txtW - 75 });
    y += opts?.size ? opts.size + 4 : 13;
  };

  row("Material", payload.partNumber, { bold: true, size: 11 });
  row("Batch", payload.description.slice(0, 30));
  row("Qty", `${payload.quantity} pcs`);
  row(
    "Min–Max",
    `${parseFloat(payload.minWeight).toFixed(3)} - ${parseFloat(payload.maxWeight).toFixed(3)} kg`
  );
  row(
    "Max Bag",
    `${(parseFloat(payload.maxWeight) * payload.quantity).toFixed(3)} kg`
  );

  if (payload.recordedAt) {
    const d = new Date(payload.recordedAt);
    row("Date", d.toISOString().slice(0, 10));
  } else {
    row("Date", new Date().toISOString().slice(0, 10));
  }

  if (payload.recordActualWeight) {
    y += 4;
    row(
      "Actual",
      `${parseFloat(payload.recordActualWeight).toFixed(3)} kg`,
      { bold: true, size: 11, color: "#0f172a" }
    );
  }

  if (payload.status) {
    const statusColor =
      payload.status === "OK"
        ? "#059669"
        : payload.status === "OVERWEIGHT"
        ? "#dc2626"
        : "#d97706";
    // Status pill
    const pillW = 90;
    const pillH = 18;
    doc
      .roundedRect(txtX, y, pillW, pillH, 9)
      .fill(statusColor);
    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(payload.status, txtX, y + 4, { width: pillW, align: "center" });
    y += pillH + 6;
  }

  // ── Footer: serial-style number bottom-right ──
  doc
    .fontSize(7)
    .fillColor("#94a3b8")
    .font("Helvetica")
    .text(`SR-${payload.partNumber}`, 0, pageH - 22, {
      width: pageW - 18,
      align: "right",
    });
  doc
    .fontSize(6)
    .fillColor("#94a3b8")
    .font("Helvetica")
    .text(
      `Generated ${new Date().toLocaleString("en-IN")}`,
      18,
      pageH - 22,
      { width: 200 }
    );

  return docToBuffer(doc);
}

export interface RecordPayload extends LabelPayload {
  id: number;
  recordedAt: string;
  operatorName: string | null;
  remarks: string | null;
  partId: number;
}

/**
 * Generate a full A4 record PDF for a single weighing history entry.
 * Includes the part spec, the measured weight, status, operator, and
 * a small QR for re-scanning.
 */
export async function writeRecordPDF(payload: RecordPayload): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: 50 });

  const pageW = doc.page.width;

  // Header
  doc.rect(0, 0, pageW, 60).fill("#1e3a5f");
  doc
    .fillColor("#fbbf24")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("UNITED RUBBER — Weighing Record", 50, 18);
  doc
    .fillColor("#ffffff")
    .fontSize(10)
    .font("Helvetica")
    .text("Gunny Bag Weighing — Unit 1", 50, 42);

  let y = 90;

  // Status banner
  const status = payload.status ?? "OK";
  const statusBg =
    status === "OK" ? "#d1fae5" : status === "OVERWEIGHT" ? "#fee2e2" : "#fef3c7";
  const statusFg =
    status === "OK" ? "#065f46" : status === "OVERWEIGHT" ? "#991b1b" : "#92400e";
  doc.rect(50, y, pageW - 100, 50).fill(statusBg);
  doc
    .fillColor(statusFg)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(status, 60, y + 14);
  if (payload.actualWeight) {
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(`Measured: ${parseFloat(payload.actualWeight).toFixed(3)} kg`, 60, y + 38);
  }
  y += 70;

  // Two-column layout: details on left, QR on right
  const leftX = 50;
  const rightX = pageW - 200;
  const leftW = rightX - leftX - 20;

  // QR code
  const qrBuffer = await QRCode.toBuffer(payload.partNumber, {
    type: "png",
    margin: 1,
    width: 400,
    errorCorrectionLevel: "H",
  });
  doc.image(qrBuffer, rightX, y, { width: 150, height: 150 });
  doc
    .fontSize(8)
    .fillColor("#64748b")
    .font("Helvetica")
    .text(
      "Scan to view part details",
      rightX,
      y + 155,
      { width: 150, align: "center" }
    );

  // Details column
  const row = (label: string, value: string, opts?: { bold?: boolean; size?: number }) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#64748b")
      .text(label.toUpperCase(), leftX, y, { width: 100 });
    doc
      .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts?.size ?? 11)
      .fillColor("#1e293b")
      .text(value, leftX + 105, y, { width: leftW - 105 });
    y += opts?.size ? opts.size + 8 : 18;
  };

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text("PART SPECIFICATIONS", leftX, y);
  y += 22;

  row("Part Number", payload.partNumber, { bold: true, size: 13 });
  row("Description", payload.description);
  row(
    "Min Item Weight",
    `${parseFloat(payload.minWeight).toFixed(3)} kg`
  );
  row(
    "Max Item Weight",
    `${parseFloat(payload.maxWeight).toFixed(3)} kg`
  );
  row(
    "Max Bag Weight",
    `${(parseFloat(payload.maxWeight) * payload.quantity).toFixed(3)} kg`,
    { bold: true }
  );
  row("Quantity / Bag", `${payload.quantity} pcs`);

  y += 14;
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text("WEIGHING RECORD", leftX, y);
  y += 22;

  row("Record ID", `#${payload.id}`);
  row(
    "Recorded At",
    new Date(payload.recordedAt).toLocaleString("en-IN", {
      dateStyle: "long",
      timeStyle: "short",
    })
  );
  row("Operator", payload.operatorName ?? "—");
  row("Remarks", payload.remarks ?? "—");
  if (payload.recordActualWeight) {
    row(
      "Actual Weight",
      `${parseFloat(payload.recordActualWeight).toFixed(3)} kg`,
      { bold: true, size: 13 }
    );
  }

  // Footer
  const footerY = doc.page.height - 60;
  doc
    .moveTo(50, footerY)
    .lineTo(pageW - 50, footerY)
    .strokeColor("#cbd5e1")
    .lineWidth(0.5)
    .stroke();
  doc
    .fontSize(8)
    .fillColor("#64748b")
    .font("Helvetica")
    .text(
      `Generated ${new Date().toLocaleString("en-IN")}  •  United Rubber — Unit 1`,
      50,
      footerY + 10,
      { width: pageW - 100, align: "center" }
    );

  return docToBuffer(doc);
}
