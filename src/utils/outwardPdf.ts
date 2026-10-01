import PDFDocument from "pdfkit";

export type OutwardPdfInward = {
  inwardNumber: string;
  labelCode: string;
  quantity: number;
  supplier: string | null;
  batchNumber: string | null;
  operatorName: string | null;
  remarks: string | null;
  receivedAt: Date | string;
};

export type OutwardPdfSibling = {
  outwardNumber: string;
  quantity: number;
  destination: string | null;
  dispatchedAt: Date | string;
};

export type OutwardPdfReturn = {
  quantity: number;
  reason: string;
  addToInventory: number;
  returnedAt: Date | string;
};

export type OutwardPdfData = {
  outwardNumber: string;
  labelCode: string | null;
  partNumber: string;
  description: string;
  quantity: number;
  destination: string | null;
  operatorName: string | null;
  remarks: string | null;
  dispatchedAt: Date | string;
  inward: OutwardPdfInward | null;
  returns: OutwardPdfReturn[];
  totalOutward: number;
  remainingInward: number;
  inwardQuantity: number;
  outwardCount: number;
  siblingOutwards: OutwardPdfSibling[];
};

const NAVY = "#17324d";
const SLATE = "#64748b";
const INK = "#0f172a";
const LINE = "#e2e8f0";

function fmtDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })} ${date.toLocaleTimeString(
    "en-IN",
    { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }
  )}`;
}

function sectionTitle(doc: PDFKit.PDFDocument, left: number, y: number, title: string, text: string) {
  doc.fillColor(NAVY).fontSize(13).font("Helvetica-Bold").text(title, left, y, { lineBreak: false });
  doc
    .moveTo(left, y + 20)
    .lineTo(left + text.length * 7 + 10, y + 20)
    .lineWidth(2.5)
    .strokeColor("#3b82f6")
    .stroke();
  return y + 40;
}

function detailRow(
  doc: PDFKit.PDFDocument,
  left: number,
  y: number,
  label: string,
  value: string,
  labelWidth = 150,
  valueWidth = 260
) {
  doc.fillColor(SLATE).fontSize(10).font("Helvetica-Bold").text(label, left, y, { lineBreak: false });
  doc.fillColor(INK).fontSize(10).font("Helvetica").text(value || "—", left + labelWidth, y, {
    width: valueWidth,
    lineBreak: false,
  });
  return y + 18;
}

export async function generateOutwardPDF(data: OutwardPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 45, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 45;
      const pageWidth = doc.page.width - 90;

      // ── Header ──
      doc.roundedRect(left, 40, pageWidth, 78, 12).fillColor(NAVY).fill();
      doc
        .fillColor("white")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("OUTWARD TRANSACTION DETAILS", left + 20, 58, { lineBreak: false });
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#cbd5e1")
        .text(
          `UNITED RUBBER INDUSTRIES (I) PVT. LTD.  |  ${fmtDateTime(new Date())}`,
          left + 20,
          90,
          { lineBreak: false }
        );

      let y = 145;

      // ── Outward details ──
      y = sectionTitle(doc, left, y, "OUTWARD DETAILS", "OUTWARD DETAILS");
      doc.roundedRect(left, y, pageWidth, 158, 8).fillColor("#f8fafc").fill();
      let rowY = y + 16;
      rowY = detailRow(doc, left + 18, rowY, "Outward No.", data.outwardNumber);
      rowY = detailRow(doc, left + 18, rowY, "Label Code", data.labelCode || "—");
      rowY = detailRow(doc, left + 18, rowY, "Part Number", data.partNumber);
      rowY = detailRow(doc, left + 18, rowY, "Description", data.description, 150, pageWidth - 200);
      rowY = detailRow(doc, left + 18, rowY, "Quantity", `${data.quantity} pcs`);
      detailRow(doc, left + 18, rowY, "Dispatched At", fmtDateTime(data.dispatchedAt));

      // second column
      let col2 = y + 16;
      col2 = detailRow(doc, left + pageWidth / 2, col2, "Destination", data.destination || "—", 110, pageWidth / 2 - 140);
      col2 = detailRow(doc, left + pageWidth / 2, col2, "Operator", data.operatorName || "—", 110, pageWidth / 2 - 140);
      col2 = detailRow(doc, left + pageWidth / 2, col2, "Inward Ref.", data.inward?.inwardNumber || "—", 110, pageWidth / 2 - 140);
      detailRow(doc, left + pageWidth / 2, col2, "Remarks", data.remarks || "—", 110, pageWidth / 2 - 140);

      y += 158 + 32;

      // ── Related inward ──
      y = sectionTitle(doc, left, y, "RELATED INWARD RECORD", "RELATED INWARD RECORD");
      if (!data.inward) {
        doc.roundedRect(left, y, pageWidth, 40, 8).fillColor("#fff7ed").fill();
        doc.fillColor("#9a3412").fontSize(10).font("Helvetica").text("This outward is not linked to an inward record.", left + 18, y + 14, {
          lineBreak: false,
        });
        y += 60;
      } else {
        const inwardHeight = 122;
        doc.roundedRect(left, y, pageWidth, inwardHeight, 8).fillColor("#f8fafc").fill();
        let iY = y + 16;
        iY = detailRow(doc, left + 18, iY, "Inward No.", data.inward.inwardNumber);
        iY = detailRow(doc, left + 18, iY, "Label Code", data.inward.labelCode);
        iY = detailRow(doc, left + 18, iY, "Inward Qty", `${data.inward.quantity} pcs`);
        detailRow(doc, left + 18, iY, "Received At", fmtDateTime(data.inward.receivedAt));

        let i2 = y + 16;
        i2 = detailRow(doc, left + pageWidth / 2, i2, "Supplier", data.inward.supplier || "—", 110, pageWidth / 2 - 140);
        i2 = detailRow(doc, left + pageWidth / 2, i2, "Batch No.", data.inward.batchNumber || "—", 110, pageWidth / 2 - 140);
        detailRow(doc, left + pageWidth / 2, i2, "Operator", data.inward.operatorName || "—", 110, pageWidth / 2 - 140);

        y += inwardHeight + 32;
      }

      // ── Quantity summary ──
      y = sectionTitle(doc, left, y, "QUANTITY SUMMARY", "QUANTITY SUMMARY");
      const summaryHeight = 34 * 4 + 8;
      doc.roundedRect(left, y, pageWidth, summaryHeight, 8).lineWidth(1).strokeColor(LINE).stroke();
      doc.roundedRect(left, y, pageWidth, 32, 8).fillColor(NAVY).fill();
      doc.fillColor("white").fontSize(10).font("Helvetica-Bold");
      doc.text("Description", left + 18, y + 11, { lineBreak: false });
      doc.text("Quantity", left + pageWidth - 160, y + 11, { width: 140, align: "right", lineBreak: false });

      const summaryRows = [
        { label: "Inward Quantity", value: `${data.inwardQuantity} pcs`, color: INK },
        { label: "Outward Quantity (this transaction)", value: `${data.quantity} pcs`, color: "#ef4444" },
        { label: `Total Outwarded (${data.outwardCount} transaction${data.outwardCount === 1 ? "" : "s"})`, value: `${data.totalOutward} pcs`, color: "#ef4444" },
        { label: "Remaining / Available Quantity", value: `${data.remainingInward} pcs`, color: "#10b981" },
      ];
      let sY = y + 34;
      summaryRows.forEach((row, index) => {
        if (index % 2 === 1) {
          doc.rect(left + 2, sY - 4, pageWidth - 4, 32).fillColor("#fafafa").fill();
        }
        doc.fillColor(INK).fontSize(10).font("Helvetica").text(row.label, left + 18, sY + 8, { lineBreak: false });
        doc
          .fillColor(row.color)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(row.value, left + pageWidth - 160, sY + 8, { width: 140, align: "right", lineBreak: false });
        sY += 32;
      });
      y += summaryHeight + 30;

      // ── All outwards against the inward ──
      if (data.siblingOutwards.length > 1) {
        if (y > doc.page.height - 220) doc.addPage();
        y = sectionTitle(doc, left, y, "ALL OUTWARDS AGAINST THIS INWARD", "ALL OUTWARDS AGAINST THIS INWARD");
        const rowH = 24;
        const tableH = 30 + data.siblingOutwards.length * rowH + 6;
        doc.roundedRect(left, y, pageWidth, tableH, 8).lineWidth(1).strokeColor(LINE).stroke();
        doc.roundedRect(left, y, pageWidth, 28, 8).fillColor(NAVY).fill();
        doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
        doc.text("Outward No.", left + 18, y + 10, { lineBreak: false });
        doc.text("Destination", left + 190, y + 10, { lineBreak: false });
        doc.text("Qty", left + pageWidth - 140, y + 10, { width: 120, align: "right", lineBreak: false });
        let oY = y + 30;
        data.siblingOutwards.forEach((row, index) => {
          if (index % 2 === 1) {
            doc.rect(left + 2, oY, pageWidth - 4, rowH).fillColor("#fafafa").fill();
          }
          doc.fillColor(INK).fontSize(9).font("Helvetica");
          doc.text(row.outwardNumber, left + 18, oY + 8, { lineBreak: false });
          doc.text(row.destination || "—", left + 190, oY + 8, { lineBreak: false });
          doc.text(`${row.quantity} pcs`, left + pageWidth - 140, oY + 8, { width: 120, align: "right", lineBreak: false });
          oY += rowH;
        });
        y += tableH + 30;
      }

      // ── Returns ──
      if (data.returns.length > 0) {
        if (y > doc.page.height - 200) doc.addPage();
        y = sectionTitle(doc, left, y, "LINKED RETURNS", "LINKED RETURNS");
        const rowH = 24;
        const tableH = 30 + data.returns.length * rowH + 6;
        doc.roundedRect(left, y, pageWidth, tableH, 8).lineWidth(1).strokeColor(LINE).stroke();
        doc.roundedRect(left, y, pageWidth, 28, 8).fillColor(NAVY).fill();
        doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
        doc.text("Reason", left + 18, y + 10, { lineBreak: false });
        doc.text("Returned At", left + 280, y + 10, { lineBreak: false });
        doc.text("Qty", left + pageWidth - 140, y + 10, { width: 120, align: "right", lineBreak: false });
        let rY = y + 30;
        data.returns.forEach((row, index) => {
          if (index % 2 === 1) {
            doc.rect(left + 2, rY, pageWidth - 4, rowH).fillColor("#fafafa").fill();
          }
          doc.fillColor(INK).fontSize(9).font("Helvetica");
          doc.text(row.reason, left + 18, rY + 8, { width: 250, lineBreak: false });
          doc.text(fmtDateTime(row.returnedAt), left + 280, rY + 8, { lineBreak: false });
          doc.text(`${row.quantity} pcs`, left + pageWidth - 140, rY + 8, { width: 120, align: "right", lineBreak: false });
          rY += rowH;
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
