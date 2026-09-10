import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

async function generatePDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 65, right: 65 }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const L = 65;
    const W = PW - 130;
    const NAVY = "#17324d";
    const BLUE = "#1d4ed8";
    const TEXT = "#1e293b";

    // Helper to add a page only if not already at the top
    function smartAddPage() {
      if (doc.y > 100) doc.addPage();
    }

    // ── helpers ──────────────────────────────────────────────────────
    function h1(text: string) {
      smartAddPage();
      doc.y = 60;
      doc.rect(L, doc.y, 4, 28).fill(BLUE);
      doc.fontSize(18).font("Helvetica-Bold").fillColor(NAVY).text(text, L + 12, doc.y, { width: W - 12 });
      doc.moveTo(L, doc.y + 4).lineTo(L + W, doc.y + 4).lineWidth(1).strokeColor("#e2e8f0").stroke();
      doc.moveDown(2);
    }

    function h2(text: string) {
      if (doc.y > PH - 100) doc.addPage();
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica-Bold").fillColor(NAVY).text(text, L, doc.y);
      doc.moveTo(L, doc.y + 2).lineTo(L + 150, doc.y + 2).lineWidth(1.5).strokeColor(BLUE).stroke();
      doc.moveDown(1);
    }

    function body(text: string) {
      if (doc.y > PH - 80) doc.addPage();
      doc.fontSize(10).font("Helvetica").fillColor(TEXT).text(text, L, doc.y, { width: W, lineGap: 3 });
      doc.moveDown(0.5);
    }

    // ════════════════════════════════════════════════════════════════════
    // TITLE PAGE
    // ════════════════════════════════════════════════════════════════════
    doc.rect(0, 0, PW, 150).fill(NAVY);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("white").text("UNITED RUBBER INDUSTRIES — UNIT 1", 0, 50, { width: PW, align: "center" });
    doc.fontSize(28).font("Helvetica-Bold").fillColor("white").text("GUNNY BAG WEIGHING SYSTEM", 0, 80, { width: PW, align: "center" });
    doc.fontSize(14).font("Helvetica").fillColor("#cbd5e1").text("Project Documentation | 2026", 0, 120, { width: PW, align: "center" });

    // ════════════════════════════════════════════════════════════════════
    // CHAPTERS
    // ════════════════════════════════════════════════════════════════════
    h1("CHAPTER 1: INTRODUCTION");
    body("The Gunny Bag Weighing System is a web-based industrial application designed for United Rubber Industries (Unit 1) to manage the rubber compound bag weighing process.");

    h2("1.1 Background");
    body("Traditional manual weighing is prone to error and lacks traceability. This system automates weight validation, label printing, and record keeping.");

    h1("CHAPTER 2: SYSTEM ANALYSIS");
    body("The system follows an iterative development process focusing on hardware integration, core modules, and real-time validation.");

    doc.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const buffer = await generatePDF();
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Documentation.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
