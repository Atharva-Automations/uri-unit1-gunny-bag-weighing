import PDFDocument from "pdfkit";

type InventoryPDFData = {
  partNumber: string;
  description: string;
  avlQuantity: number;
  baseQuantity: number;
  weighedQuantity: number;
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
      const headerHeight = 110;
      const headerY = 40;

      // Dark blue rounded background
      doc.roundedRect(leftMargin, headerY, pageWidth, headerHeight, 15)
        .fillColor("#17324d")
        .fill();

      // Package icon box
      doc.roundedRect(leftMargin + 20, headerY + 25, 60, 60, 10)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      // Icon lines inside (package box icon)
      doc.strokeColor("white").lineWidth(2.5);
      doc.moveTo(leftMargin + 32, headerY + 43).lineTo(leftMargin + 62, headerY + 43).stroke();
      doc.moveTo(leftMargin + 47, headerY + 30).lineTo(leftMargin + 47, headerY + 58).stroke();
      doc.moveTo(leftMargin + 32, headerY + 58).lineTo(leftMargin + 62, headerY + 58).stroke();
      doc.moveTo(leftMargin + 32, headerY + 30).lineTo(leftMargin + 62, headerY + 30).stroke();

      // Title
      doc.fillColor("white")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("INVENTORY REPORT", leftMargin + 100, headerY + 28, { width: pageWidth - 120, lineBreak: false });

      doc.fillColor("white")
        .fontSize(16)
        .font("Helvetica")
        .text("Available Quantity Summary", leftMargin + 100, headerY + 62, { width: pageWidth - 120, lineBreak: false });

      // Timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      doc.fontSize(10)
        .font("Helvetica")
        .fillColor("#cbd5e1")
        .text(`Generated on: ${dateStr} | ${timeStr}`, leftMargin + 100, headerY + 90, { width: pageWidth - 120, lineBreak: false });

      // === PART INFORMATION SECTION ===
      let yPos = headerY + headerHeight + 40;

      // Section header with icon
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("PART INFORMATION", leftMargin + 50, yPos, { lineBreak: false });

      // Blue underline
      doc.moveTo(leftMargin + 50, yPos + 22)
        .lineTo(leftMargin + 210, yPos + 22)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      yPos += 45;

      // Info box
      const boxHeight = 110;
      doc.roundedRect(leftMargin + 10, yPos, pageWidth - 20, boxHeight, 10)
        .fillColor("#f8fafc")
        .fill();

      // Part Number
      doc.fillColor("#64748b")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Part Number", leftMargin + 30, yPos + 25, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(11)
        .text(":", leftMargin + 200, yPos + 25, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(data.partNumber, leftMargin + 230, yPos + 24, { lineBreak: false });

      // Description
      doc.fillColor("#64748b")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Description", leftMargin + 30, yPos + 60, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(11)
        .text(":", leftMargin + 200, yPos + 60, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(11)
        .font("Helvetica")
        .text(data.description, leftMargin + 230, yPos + 59, { width: pageWidth - 260, lineBreak: false });

      // Available Quantity (Large display)
      doc.fillColor("#64748b")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Available Quantity", leftMargin + 30, yPos + 88, { lineBreak: false });

      doc.fillColor("#0f172a")
        .fontSize(11)
        .text(":", leftMargin + 200, yPos + 88, { lineBreak: false });

      const qtyStr = data.avlQuantity.toLocaleString() + " pcs";
      doc.fillColor("#10b981")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(qtyStr, leftMargin + 230, yPos + 84, { lineBreak: false });

      yPos += boxHeight + 45;

      // === MOVEMENT BREAKDOWN SECTION ===
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("MOVEMENT BREAKDOWN", leftMargin + 50, yPos, { lineBreak: false });

      doc.moveTo(leftMargin + 50, yPos + 22)
        .lineTo(leftMargin + 250, yPos + 22)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      yPos += 45;

      // Table
      const tableWidth = pageWidth - 20;
      const tableStartY = yPos;

      // Table border
      doc.roundedRect(leftMargin + 10, tableStartY, tableWidth, 230, 10)
        .lineWidth(1)
        .strokeColor("#e2e8f0")
        .stroke();

      // Table header
      const headerRowHeight = 38;
      doc.roundedRect(leftMargin + 10, tableStartY, tableWidth, headerRowHeight, 10)
        .fillColor("#17324d")
        .fill();

      doc.fillColor("white")
        .fontSize(12)
        .font("Helvetica-Bold");
      doc.text("Transaction Type", leftMargin + 30, tableStartY + 13, { lineBreak: false });
      doc.text("Quantity", leftMargin + 280, tableStartY + 13, { width: 90, align: "center", lineBreak: false });
      doc.text("Effect on Stock", leftMargin + 390, tableStartY + 13, { width: 120, align: "center", lineBreak: false });

      yPos = tableStartY + headerRowHeight + 5;

      // Transaction rows
      const rowHeight = 36;
      const transactions = [
        { label: "Weighed (Status: OK)", qty: data.weighedQuantity, effect: "+ Added", color: "#3b82f6" },
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
          .fontSize(11)
          .font("Helvetica");
        doc.text(txn.label, leftMargin + 30, yPos + 9, { lineBreak: false });

        doc.fillColor("#0f172a")
          .fontSize(12)
          .font("Helvetica-Bold");
        doc.text(String(txn.qty), leftMargin + 280, yPos + 9, { width: 90, align: "center", lineBreak: false });

        doc.fillColor(txn.color)
          .fontSize(11)
          .font("Helvetica-Bold");
        doc.text(txn.effect, leftMargin + 390, yPos + 9, { width: 120, align: "center", lineBreak: false });

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
      doc.rect(leftMargin + 10, yPos - 3, tableWidth, rowHeight + 4)
        .fillColor("#f0fdf4")
        .fill();

      doc.fillColor("#0f172a")
        .fontSize(12)
        .font("Helvetica-Bold");
      doc.text("FINAL AVAILABLE QUANTITY", leftMargin + 30, yPos + 8, { lineBreak: false });

      doc.fillColor("#10b981")
        .fontSize(18)
        .font("Helvetica-Bold");
      doc.text(qtyStr, leftMargin + 390, yPos + 6, { width: 120, align: "center", lineBreak: false });

      // Formula note
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
      doc.text("Formula:", leftMargin + 50, yPos + 2, { lineBreak: false });

      doc.fillColor("#94a3b8")
        .fontSize(10)
        .font("Helvetica-Oblique");
      doc.text(
        "Available = Weighed (Status: OK) + Inwards - Outwards + Returns",
        leftMargin + 110, yPos + 2, { lineBreak: false }
      );

      // Calculation display
      yPos += 22;
      doc.fillColor("#64748b")
        .fontSize(9)
        .font("Helvetica");
      const calcStr = `${data.weighedQuantity.toLocaleString()} + ${data.totalInwards.toLocaleString()} - ${data.totalOutwards.toLocaleString()} + ${data.totalReturns.toLocaleString()} = ${data.avlQuantity.toLocaleString()} pcs`;
      doc.text(calcStr, leftMargin + 50, yPos, { lineBreak: false });

      // Validation note
      yPos += 16;
      doc.fillColor("#94a3b8")
        .fontSize(8)
        .font("Helvetica-Oblique");
      doc.text("Only weighings with status OK are added to inventory. Overweight / underweight transactions are recorded for audit only.", leftMargin + 50, yPos, { lineBreak: false });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}