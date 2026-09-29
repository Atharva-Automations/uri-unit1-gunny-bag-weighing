import PDFDocument from "pdfkit";

type InventoryPDFData = {
  partNumber: string;
  description: string;
  avlQuantity: number;
  baseQuantity: number;
  totalInwards: number;
  totalOutwards: number;
  totalReturns: number;
};

export async function generateInventoryPDF(data: InventoryPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        autoFirstPage: true,
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100;
      const leftMargin = 50;

      // === HEADER SECTION ===
      const headerHeight = 100;
      const headerY = 40;

      // Dark blue rounded background
      doc.roundedRect(leftMargin, headerY, pageWidth, headerHeight, 15)
        .fillColor("#17324d")
        .fill();

      // Package icon box
      doc.roundedRect(leftMargin + 20, headerY + 20, 60, 60, 10)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      // Icon lines inside (package box icon)
      doc.strokeColor("white").lineWidth(2.5);
      doc.moveTo(leftMargin + 32, headerY + 40).lineTo(leftMargin + 62, headerY + 40).stroke();
      doc.moveTo(leftMargin + 47, headerY + 25).lineTo(leftMargin + 47, headerY + 55).stroke();
      doc.moveTo(leftMargin + 32, headerY + 55).lineTo(leftMargin + 62, headerY + 55).stroke();
      doc.moveTo(leftMargin + 32, headerY + 25).lineTo(leftMargin + 62, headerY + 25).stroke();

      // Title
      doc.fillColor("white")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("INVENTORY REPORT", leftMargin + 100, headerY + 25, { width: pageWidth - 120, lineBreak: false });

      doc.fillColor("white")
        .fontSize(18)
        .font("Helvetica")
        .text("Available Quantity Summary", leftMargin + 100, headerY + 58, { width: pageWidth - 120, lineBreak: false });

      // Timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      doc.fontSize(10)
        .font("Helvetica")
        .fillColor("#cbd5e1")
        .text(`Generated on: ${dateStr} | ${timeStr}`, leftMargin + 100, headerY + 85, { width: pageWidth - 120, lineBreak: false });

      // === PART INFORMATION SECTION ===
      let yPos = headerY + headerHeight + 50;

      // Section header
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("PART INFORMATION", leftMargin + 50, yPos, { lineBreak: false });

      // Blue underline
      doc.moveTo(leftMargin + 50, yPos + 25)
        .lineTo(leftMargin + 220, yPos + 25)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      yPos += 50;

      // Info box
      const boxHeight = 130;
      doc.roundedRect(leftMargin + 10, yPos, pageWidth - 20, boxHeight, 10)
        .fillColor("#f8fafc")
        .fill();

      // Part Number
      doc.fillColor("#64748b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Part Number", leftMargin + 30, yPos + 25, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(12)
        .text(":", leftMargin + 200, yPos + 25, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(data.partNumber, leftMargin + 230, yPos + 24, { lineBreak: false });

      // Description
      doc.fillColor("#64748b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Description", leftMargin + 30, yPos + 65, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(12)
        .text(":", leftMargin + 200, yPos + 65, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(12)
        .font("Helvetica")
        .text(data.description, leftMargin + 230, yPos + 64, { width: pageWidth - 250, lineBreak: false });

      // Available Quantity (Large display)
      doc.fillColor("#64748b")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Available Quantity", leftMargin + 30, yPos + 105, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(12)
        .text(":", leftMargin + 200, yPos + 105, { lineBreak: false });

      doc.fillColor("#10b981")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text(data.avlQuantity.toLocaleString(), leftMargin + 230, yPos + 100, { lineBreak: false });

      doc.fillColor("#10b981")
        .fontSize(12)
        .font("Helvetica")
        .text("pcs", leftMargin + 230 + doc.widthOfString(data.avlQuantity.toLocaleString()) + 5, yPos + 105, { lineBreak: false });

      yPos += boxHeight + 50;

      // === MOVEMENT BREAKDOWN SECTION ===
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("MOVEMENT BREAKDOWN", leftMargin + 50, yPos, { lineBreak: false });

      doc.moveTo(leftMargin + 50, yPos + 25)
        .lineTo(leftMargin + 250, yPos + 25)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      yPos += 50;

      // Table
      const tableWidth = pageWidth - 20;
      const tableStartY = yPos;

      // Table border
      doc.roundedRect(leftMargin + 10, tableStartY, tableWidth, 200, 10)
        .lineWidth(1)
        .strokeColor("#e2e8f0")
        .stroke();

      // Table header
      const headerRowHeight = 40;
      doc.roundedRect(leftMargin + 10, tableStartY, tableWidth, headerRowHeight, 10)
        .fillColor("#17324d")
        .fill();

      doc.fillColor("white")
        .fontSize(13)
        .font("Helvetica-Bold");
      doc.text("Transaction Type", leftMargin + 30, tableStartY + 14, { lineBreak: false });
      doc.text("Quantity", leftMargin + 280, tableStartY + 14, { width: 100, align: "center", lineBreak: false });
      doc.text("Effect on Stock", leftMargin + 400, tableStartY + 14, { width: 120, align: "center", lineBreak: false });

      yPos = tableStartY + headerRowHeight + 5;

      // Transaction rows
      const rowHeight = 35;
      const transactions = [
        { label: "Base Quantity (Master)", qty: data.baseQuantity, effect: "Base", color: "#64748b" },
        { label: "Inwards (Received)", qty: data.totalInwards, effect: "+ Added", color: "#3b82f6" },
        { label: "Outwards (Dispatched)", qty: data.totalOutwards, effect: "- Deducted", color: "#ef4444" },
        { label: "Returns (Added Back)", qty: data.totalReturns, effect: "+ Added", color: "#10b981" },
      ];

      transactions.forEach((txn, idx) => {
        if (idx % 2 === 1) {
          doc.rect(leftMargin + 10, yPos - 3, tableWidth, rowHeight)
            .fillColor("#fafafa")
            .fill();
        }

        doc.fillColor("#0f172a")
          .fontSize(12)
          .font("Helvetica");
        doc.text(txn.label, leftMargin + 30, yPos + 8, { lineBreak: false });

        doc.fillColor("#0f172a")
          .fontSize(13)
          .font("Helvetica-Bold");
        doc.text(String(txn.qty), leftMargin + 280, yPos + 8, { width: 100, align: "center", lineBreak: false });

        doc.fillColor(txn.color)
          .fontSize(12)
          .font("Helvetica-Bold");
        doc.text(txn.effect, leftMargin + 400, yPos + 8, { width: 120, align: "center", lineBreak: false });

        yPos += rowHeight;
      });

      // Divider
      doc.moveTo(leftMargin + 30, yPos + 5)
        .lineTo(leftMargin + tableWidth - 10, yPos + 5)
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .dash(4, { space: 4 })
        .stroke();

      yPos += 20;

      // Final Available Quantity row
      doc.rect(leftMargin + 10, yPos - 3, tableWidth, rowHeight + 5)
        .fillColor("#f0fdf4")
        .fill();

      doc.fillColor("#0f172a")
        .fontSize(13)
        .font("Helvetica-Bold");
      doc.text("FINAL AVAILABLE QUANTITY", leftMargin + 30, yPos + 8, { lineBreak: false });

      doc.fillColor("#10b981")
        .fontSize(20)
        .font("Helvetica-Bold");
      doc.text(data.avlQuantity.toLocaleString() + " pcs", leftMargin + 400, yPos + 5, { width: 120, align: "center", lineBreak: false });

      // Note
      yPos += rowHeight + 30;
      doc.save();
      doc.circle(leftMargin + 25, yPos + 5, 11)
        .fillColor("#dbeafe")
        .fill();
      doc.fillColor("#3b82f6")
        .fontSize(9)
        .font("Helvetica-Bold");
      doc.text("i", leftMargin + 22, yPos + 1, { lineBreak: false });
      doc.restore();

      doc.fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica-Bold");
      doc.text("Note:", leftMargin + 50, yPos + 2, { lineBreak: false });

      doc.fillColor("#94a3b8")
        .fontSize(10)
        .font("Helvetica-Oblique");
      doc.text("Available Quantity = Base Quantity + Inwards - Outwards + Returns. All quantities in pieces (pcs).", leftMargin + 90, yPos + 2, { lineBreak: false });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}