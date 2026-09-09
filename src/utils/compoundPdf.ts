import PDFDocument from "pdfkit";

type CompoundInventoryData = {
  partNumber: string;
  description: string;
  totalInwards: number;
  totalIssued: number;
  totalOutwards: number;
  totalReturns: number;
};

export async function generateCompoundInventoryPDF(data: CompoundInventoryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100;
      const leftMargin = 50;
      const inwardBal = data.totalInwards - data.totalIssued;
      const cisBal = data.totalIssued - data.totalOutwards + data.totalReturns;

      // === HEADER SECTION ===
      const headerHeight = 120;
      const headerY = 40;

      // Dark blue rounded background
      doc.roundedRect(leftMargin, headerY, pageWidth, headerHeight, 15)
        .fillColor("#17324d")
        .fill();

      // Clipboard icon box
      doc.roundedRect(leftMargin + 20, headerY + 30, 60, 60, 10)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      // Icon lines inside
      doc.strokeColor("white")
        .lineWidth(2.5);
      for (let i = 0; i < 3; i++) {
        const y = headerY + 50 + (i * 12);
        const width = i === 2 ? 25 : 35;
        doc.moveTo(leftMargin + 32, y).lineTo(leftMargin + 32 + width, y).stroke();
      }

      // Title
      doc.fillColor("white")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("COMPOUND INVENTORY", leftMargin + 100, headerY + 30, { width: pageWidth - 120 });

      doc.fillColor("white")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("REPORT", leftMargin + 100, headerY + 60, { width: pageWidth - 120 });

      // Timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      doc.fontSize(10)
        .font("Helvetica")
        .fillColor("#cbd5e1")
        .text(`Generated on: ${dateStr} | ${timeStr}`, leftMargin + 100, headerY + 95, { width: pageWidth - 120 });

      // === PART INFORMATION SECTION ===
      let yPos = headerY + headerHeight + 50;

      // Section header with icon
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("PART INFORMATION", leftMargin + 50, yPos);

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
        .text("Part Number", leftMargin + 30, yPos + 25);

      doc.fillColor("#0f172a")
        .fontSize(11)
        .text(":", leftMargin + 200, yPos + 25);

      doc.fillColor("#0f172a")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(data.partNumber, leftMargin + 230, yPos + 24);

      // Description
      doc.fillColor("#64748b")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Description", leftMargin + 30, yPos + 65);

      doc.fillColor("#0f172a")
        .fontSize(11)
        .text(":", leftMargin + 200, yPos + 65);

      doc.fillColor("#0f172a")
        .fontSize(11)
        .font("Helvetica")
        .text(data.description, leftMargin + 230, yPos + 64, { width: 250 });

      yPos += boxHeight + 50;

      // === MOVEMENT SUMMARY SECTION ===
      doc.save();
      doc.circle(leftMargin + 20, yPos + 8, 16)
        .fillColor("#f1f5f9")
        .fill();
      doc.restore();

      doc.fillColor("#17324d")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("MOVEMENT SUMMARY", leftMargin + 50, yPos);

      doc.moveTo(leftMargin + 50, yPos + 22)
        .lineTo(leftMargin + 230, yPos + 22)
        .lineWidth(3)
        .strokeColor("#3b82f6")
        .stroke();

      yPos += 45;

      // Table
      const tableWidth = pageWidth - 20;
      const tableStartY = yPos;

      // Table border
      doc.roundedRect(leftMargin + 10, tableStartY, tableWidth, 295, 10)
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
        .font("Helvetica-Bold")
        .text("Transaction Type", leftMargin + 30, tableStartY + 13)
        .text("Quantity", leftMargin + 280, tableStartY + 13, { width: 80, align: "center" })
        .text("Balance", leftMargin + 400, tableStartY + 13, { width: 80, align: "center" });

      yPos = tableStartY + headerRowHeight + 5;

      // Transaction rows
      const rowHeight = 38;
      const transactions = [
        { label: "Total Inwards", qty: data.totalInwards, balance: "—" },
        { label: "Total Issued (CIS)", qty: data.totalIssued, balance: "—" },
        { label: "Total Outwards", qty: data.totalOutwards, balance: "—" },
        { label: "Total Returns", qty: data.totalReturns, balance: "—" },
      ];

      transactions.forEach((txn, idx) => {
        if (idx % 2 === 1) {
          doc.rect(leftMargin + 10, yPos - 3, tableWidth, rowHeight)
            .fillColor("#fafafa")
            .fill();
        }

        doc.fillColor("#0f172a")
          .fontSize(11)
          .font("Helvetica")
          .text(txn.label, leftMargin + 30, yPos + 10);

        doc.fillColor("#0f172a")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(String(txn.qty), leftMargin + 280, yPos + 10, { width: 80, align: "center" });

        doc.fillColor("#64748b")
          .fontSize(11)
          .font("Helvetica")
          .text(txn.balance, leftMargin + 400, yPos + 10, { width: 80, align: "center" });

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

      // Balance rows
      const balances = [
        { label: "Inward Balance", balance: inwardBal, color: "#3b82f6" },
        { label: "CIS Balance", balance: cisBal, color: "#10b981" },
      ];

      balances.forEach((bal) => {
        doc.rect(leftMargin + 10, yPos - 3, tableWidth, rowHeight)
          .fillColor("#f8fafc")
          .fill();

        doc.fillColor("#0f172a")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(bal.label, leftMargin + 30, yPos + 10);

        doc.fillColor("#64748b")
          .fontSize(11)
          .font("Helvetica")
          .text("—", leftMargin + 280, yPos + 10, { width: 80, align: "center" });

        doc.fillColor(bal.color)
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(String(bal.balance), leftMargin + 400, yPos + 8, { width: 80, align: "center" });

        yPos += rowHeight;
      });

      // Note
      yPos += 30;
      doc.save();
      doc.circle(leftMargin + 25, yPos + 5, 11)
        .fillColor("#dbeafe")
        .fill();
      doc.fillColor("#3b82f6")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("i", leftMargin + 22, yPos + 1);
      doc.restore();

      doc.fillColor("#64748b")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Note:", leftMargin + 50, yPos + 2);

      doc.fillColor("#94a3b8")
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text("All quantities are presented in unit count.", leftMargin + 90, yPos + 2);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
