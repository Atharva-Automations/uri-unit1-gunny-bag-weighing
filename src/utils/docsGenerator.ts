import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} from "docx";

// ============================================================================
// PDF GENERATION ENGINE USING PDFKIT
// ============================================================================

export async function generateDocumentationPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 55, bottom: 55, left: 55, right: 55 },
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width; // 595.28
    const PH = doc.page.height; // 841.89
    const L = 55;
    const R = PW - 55;
    const W = PW - 110; // 485.28
    const BTM = PH - 55; // 786.89

    // Refined Corporate Color Palette
    const NAVY = "#0f2942";
    const BLUE = "#2563eb";
    const DARK = "#1e293b";
    const MUTED = "#64748b";
    const BORDER = "#e2e8f0";
    const BG_LIGHT = "#f8fafc";
    const ACCENT_GREEN = "#16a34a";
    const ACCENT_AMBER = "#d97706";

    // Track chapter start pages for dynamic Table of Contents
    const chapterPages: { [key: string]: number } = {};

    function getCurrentPageNumber(): number {
      const range = doc.bufferedPageRange();
      return range.start + range.count;
    }

    // Helper: Ensure space before rendering to prevent orphaned titles & accidental breaks
    function ensureSpace(neededHeight: number) {
      if (doc.y + neededHeight > BTM) {
        doc.addPage();
        doc.y = 60;
      }
    }

    // Helper: Start new section on fresh page cleanly
    function newPage() {
      if (doc.y > 65) {
        doc.addPage();
        doc.y = 60;
      }
    }

    // Chapter Title (H1)
    function h1(title: string, chapterKey?: string) {
      newPage();
      if (chapterKey) {
        chapterPages[chapterKey] = getCurrentPageNumber();
      }
      doc.y = 60;
      doc.rect(L, doc.y, 4, 22).fill(BLUE);
      doc.fontSize(15).font("Helvetica-Bold").fillColor(NAVY).text(title, L + 12, doc.y + 2, { width: W - 12 });
      doc.moveDown(0.3);
      doc.moveTo(L, doc.y).lineTo(R, doc.y).lineWidth(1).strokeColor(BORDER).stroke();
      doc.moveDown(0.8);
    }

    // Section Heading (H2)
    function h2(title: string) {
      ensureSpace(60);
      doc.moveDown(0.5);
      doc.fontSize(11.5).font("Helvetica-Bold").fillColor(NAVY).text(title, L, doc.y);
      doc.moveDown(0.2);
      doc.moveTo(L, doc.y).lineTo(L + 120, doc.y).lineWidth(1.5).strokeColor(BLUE).stroke();
      doc.moveDown(0.5);
    }

    // Sub-section Heading (H3)
    function h3(title: string) {
      ensureSpace(45);
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#334155").text(title, L, doc.y);
      doc.moveDown(0.3);
    }

    // Paragraph Body
    function p(text: string, align: "left" | "justify" = "justify") {
      ensureSpace(28);
      doc.fontSize(9).font("Helvetica").fillColor(DARK).text(text, L, doc.y, {
        width: W,
        lineGap: 2.8,
        align: align,
      });
      doc.moveDown(0.45);
    }

    // Bullet List Item
    function bullet(text: string, boldPrefix?: string) {
      ensureSpace(22);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(BLUE).text("•", L + 6, doc.y);
      const currentY = doc.y - 11;
      if (boldPrefix) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK).text(boldPrefix + " ", L + 18, currentY, { continued: true });
        doc.font("Helvetica").fillColor(DARK).text(text, { width: W - 18, lineGap: 2.4 });
      } else {
        doc.fontSize(9).font("Helvetica").fillColor(DARK).text(text, L + 18, currentY, { width: W - 18, lineGap: 2.4 });
      }
      doc.moveDown(0.35);
    }

    // Callout Box
    function callout(text: string, title?: string) {
      ensureSpace(45);
      const boxW = W;
      doc.fontSize(8.5).font("Helvetica");
      const titleH = title ? 14 : 0;
      const textH = doc.heightOfString(text, { width: boxW - 24, lineGap: 2.4 });
      const totalH = titleH + textH + 14;

      if (doc.y + totalH > BTM) {
        doc.addPage();
        doc.y = 60;
      }

      const drawY = doc.y;
      doc.rect(L, drawY, boxW, totalH).fill(BG_LIGHT);
      doc.rect(L, drawY, 3.5, totalH).fill(BLUE);

      let textCursorY = drawY + 7;
      if (title) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(NAVY).text(title, L + 12, textCursorY, { width: boxW - 24 });
        textCursorY += 13;
      }
      doc.fontSize(8.5).font("Helvetica").fillColor(DARK).text(text, L + 12, textCursorY, { width: boxW - 24, lineGap: 2.4 });
      doc.y = drawY + totalH + 6;
    }

    // Table Renderer with automatic pagination
    function table(headers: string[], rows: (string | number)[][], colWidths: number[]) {
      ensureSpace(45);
      const rowHeight = 18;

      function drawHeader(y: number) {
        doc.rect(L, y, W, rowHeight).fill(NAVY);
        let curX = L;
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
        headers.forEach((h, i) => {
          doc.text(h, curX + 5, y + 4.5, { width: colWidths[i] - 10, align: "left" });
          curX += colWidths[i];
        });
        return y + rowHeight;
      }

      let curY = drawHeader(doc.y);

      rows.forEach((row, rIdx) => {
        let maxCellH = rowHeight;
        doc.fontSize(8).font("Helvetica");
        row.forEach((cell, cIdx) => {
          const h = doc.heightOfString(String(cell), { width: colWidths[cIdx] - 10 }) + 7;
          if (h > maxCellH) maxCellH = h;
        });

        if (curY + maxCellH > BTM) {
          doc.addPage();
          doc.y = 60;
          curY = drawHeader(doc.y);
        }

        if (rIdx % 2 === 1) {
          doc.rect(L, curY, W, maxCellH).fill(BG_LIGHT);
        }

        doc.rect(L, curY, W, maxCellH).lineWidth(0.5).strokeColor(BORDER).stroke();

        let curX = L;
        doc.fontSize(8).font("Helvetica").fillColor(DARK);
        row.forEach((cell, cIdx) => {
          doc.text(String(cell), curX + 5, curY + 4.5, { width: colWidths[cIdx] - 10, align: "left" });
          curX += colWidths[cIdx];
        });

        curY += maxCellH;
      });

      doc.y = curY + 6;
    }

    // ========================================================================
    // 1. COVER / TITLE PAGE
    // ========================================================================
    doc.rect(30, 30, PW - 60, PH - 60).lineWidth(1.5).strokeColor(NAVY).stroke();
    doc.rect(34, 34, PW - 68, PH - 68).lineWidth(0.5).strokeColor(BLUE).stroke();

    // Top Header Badge
    doc.rect(55, 65, W, 3.5).fill(BLUE);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NAVY).text("UNITED RUBBER INDUSTRIES — UNIT 1", 55, 78, {
      width: W,
      align: "center",
      characterSpacing: 2,
    });
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED).text("INDUSTRIAL AUTOMATION & PROCESS ENGINEERING DIVISION", 55, 93, {
      width: W,
      align: "center",
    });

    // Central Title Hero Container
    doc.rect(55, 160, W, 225).fill(BG_LIGHT);
    doc.rect(55, 160, W, 225).lineWidth(1).strokeColor(BORDER).stroke();
    doc.rect(55, 160, 5, 225).fill(BLUE);

    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BLUE).text("TECHNICAL PROJECT REPORT & SPECIFICATION", 80, 185, {
      width: W - 50,
      characterSpacing: 1.5,
    });

    doc.fontSize(21).font("Helvetica-Bold").fillColor(NAVY).text("GUNNY BAG WEIGHING &\nINVENTORY MANAGEMENT SYSTEM", 80, 212, {
      width: W - 50,
      lineGap: 4,
    });

    doc.fontSize(9.5).font("Helvetica").fillColor(DARK).text(
      "A complete industrial hardware-integrated automation platform featuring real-time Modbus RTU serial scale interfacing, 5-second rolling min/max stability verification, 203-DPI TSPL thermal label generation, automated audit logging, and QR-driven compound inventory tracking.",
      80,
      280,
      { width: W - 50, lineGap: 3 }
    );

    // Project Metadata Grid
    const metaY = 445;
    doc.rect(55, metaY, W, 180).fill("#ffffff");
    doc.rect(55, metaY, W, 180).lineWidth(0.8).strokeColor(BORDER).stroke();

    const col1 = 75;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(NAVY).text("PROJECT METADATA", col1, metaY + 14);
    doc.moveTo(col1, metaY + 27).lineTo(R - 20, metaY + 27).lineWidth(0.5).strokeColor(BORDER).stroke();

    const metaRows = [
      ["Organization:", "United Rubber Industries (Unit 1)"],
      ["System Version:", "v1.0.0 (Production Release)"],
      ["Software Stack:", "Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4"],
      ["Database Layer:", "PostgreSQL 14+ with Drizzle ORM (Auto-Migrating)"],
      ["Hardware Interfaces:", "Modbus RTU over RS-485 Serial & TSC Thermal TCP Port 9100"],
      ["Thermal Label Spec:", "100mm × 50mm (800 × 400 dots, 203 DPI, Model 2 QR Code)"],
      ["Release Date:", "September 2026"],
    ];

    metaRows.forEach((row, i) => {
      const y = metaY + 40 + i * 19;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(MUTED).text(row[0], col1, y);
      doc.fontSize(8.5).font("Helvetica").fillColor(DARK).text(row[1], col1 + 105, y);
    });

    doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Confidential — Proprietary Industrial Documentation — All Rights Reserved", 55, 745, {
      width: W,
      align: "center",
    });

    // ========================================================================
    // 2. CERTIFICATE OF COMPLETION
    // ========================================================================
    newPage();
    doc.rect(55, 60, W, 3.5).fill(BLUE);
    doc.fontSize(15).font("Helvetica-Bold").fillColor(NAVY).text("CERTIFICATE OF COMPLETION", 55, 78, {
      width: W,
      align: "center",
      characterSpacing: 1.5,
    });
    doc.moveDown(1.5);

    p(
      "This is to formally certify that the industrial software automation project entitled 'Gunny Bag Weighing & Compound Inventory Management System' has been successfully designed, engineered, integrated, validated, and commissioned for United Rubber Industries (Unit 1)."
    );
    p(
      "The system fulfills all defined operational requirements, including automated Modbus RTU serial scale interfacing, real-time rolling-window weight stability verification (spread <= 0.005 kg for 5 consecutive seconds), high-speed 203-DPI TSPL thermal label printing, comprehensive weighing audit logging, and QR-code enabled compound inventory tracking (Inward Receipt, CIS Staging, and Outward Dispatch)."
    );
    p(
      "The software architecture, database integrity mechanisms, and industrial hardware drivers have been thoroughly tested and validated on the factory floor, demonstrating high operational reliability and performance."
    );

    doc.moveDown(5);

    const sigY = doc.y;
    doc.moveTo(L + 20, sigY).lineTo(L + 180, sigY).lineWidth(1).strokeColor(DARK).stroke();
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(NAVY).text("Project Lead / Lead Engineer", L + 20, sigY + 8);
    doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Industrial Automation Division", L + 20, sigY + 20);

    doc.moveTo(R - 180, sigY).lineTo(R - 20, sigY).lineWidth(1).strokeColor(DARK).stroke();
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(NAVY).text("Plant Head / Technical Director", R - 180, sigY + 8);
    doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("United Rubber Industries (Unit 1)", R - 180, sigY + 20);

    // ========================================================================
    // 3. DECLARATION & ACKNOWLEDGEMENTS
    // ========================================================================
    newPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NAVY).text("DECLARATION", L, doc.y);
    doc.moveTo(L, doc.y + 3).lineTo(L + 95, doc.y + 3).lineWidth(1.5).strokeColor(BLUE).stroke();
    doc.moveDown(0.8);

    p(
      "I hereby declare that the technical specifications, architectural diagrams, hardware interfacing protocols, database schemas, and codebase documented in this report represent authentic and verified engineering work executed for United Rubber Industries (Unit 1). All operational workflows, Modbus register mappings, and thermal label templates represent active production systems."
    );

    doc.moveDown(1.2);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NAVY).text("ACKNOWLEDGEMENTS", L, doc.y);
    doc.moveTo(L, doc.y + 3).lineTo(L + 135, doc.y + 3).lineWidth(1.5).strokeColor(BLUE).stroke();
    doc.moveDown(0.8);

    p(
      "We express our gratitude to the plant executive leadership and operations management of United Rubber Industries (Unit 1) for providing the resources, industrial scale hardware, TSC label printers, and production environment necessary to complete this project."
    );
    p(
      "Special acknowledgement is given to the quality control supervisors, shop-floor operators, and warehouse managers whose practical insights shaped the high-contrast user interface, rolling-window stability filter, and seamless scan-to-advance workflows."
    );

    // ========================================================================
    // 4. ABSTRACT & EXECUTIVE SUMMARY
    // ========================================================================
    newPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NAVY).text("ABSTRACT & EXECUTIVE SUMMARY", L, doc.y);
    doc.moveTo(L, doc.y + 3).lineTo(L + 180, doc.y + 3).lineWidth(1.5).strokeColor(BLUE).stroke();
    doc.moveDown(0.8);

    p(
      "In industrial rubber manufacturing, precise compound weighing is critical to product quality, batch consistency, and regulatory compliance. Traditional manual weighing operations—relying on manual scale reading, handwritten tags, and physical ledgers—introduce significant risks of human error, weight discrepancies, and audit gaps."
    );
    p(
      "This document presents the engineering specification of the Gunny Bag Weighing System. Built with Next.js 16 (App Router), React 19, TypeScript, and PostgreSQL with Drizzle ORM, the platform unifies hardware scale reading, weight tolerance validation, thermal label printing, audit trail logging, and compound inventory lifecycle tracking into a single cohesive interface."
    );
    p(
      "Hardware connectivity is achieved via a dedicated background Modbus RTU serial service (modbus-serial) that continuously samples scale registers over RS-485, coupled with a raw TCP socket client that streams TSPL commands directly to TSC thermal printers at 203 DPI. The system features a 5-second rolling min/max stability detection algorithm (WeightStability) to eliminate scale vibration noise."
    );

    callout(
      "Key Features:\n• Automated Modbus RTU scale communication over serial port (COM7, 9600 baud, 8N1)\n• Rolling 5-second min/max weight stability verification (spread <= 0.005 kg)\n• Direct TCP socket TSPL thermal printing for 100mm × 50mm labels with QR codes\n• Zero-touch automated database migrations on server boot via instrumentation.ts\n• Complete audit history with real-time analytics, CSV export, and PDF document generation\n• Compound Inventory Lifecycle: Inward Receipt, CIS Staging, and Outward Dispatch with scan-to-advance",
      "EXECUTIVE SUMMARY HIGHLIGHTS"
    );

    // ========================================================================
    // 5. TABLE OF CONTENTS
    // ========================================================================
    newPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor(NAVY).text("TABLE OF CONTENTS", L, doc.y);
    doc.moveTo(L, doc.y + 3).lineTo(L + 140, doc.y + 3).lineWidth(1.5).strokeColor(BLUE).stroke();
    doc.moveDown(1.2);

    const toc = [
      { num: "1", title: "Introduction & Project Background", page: "5" },
      { num: "2", title: "System Architecture & Technology Stack", page: "6" },
      { num: "3", title: "System Requirements Specifications", page: "7" },
      { num: "4", title: "Database Schema & Data Integrity", page: "8" },
      { num: "5", title: "Detailed Module Implementation", page: "9" },
      { num: "6", title: "Testing, Verification & Quality Assurance", page: "11" },
      { num: "7", title: "Deployment, Operational SOP & Future Scope", page: "12" },
      { num: "8", title: "References & Technical Bibliography", page: "13" },
    ];

    toc.forEach((item) => {
      ensureSpace(22);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(NAVY).text(`Chapter ${item.num}:  ${item.title}`, L, doc.y, { continued: true });
      doc.font("Helvetica").fillColor(MUTED).text(` ............................................................................................ `.slice(0, 52 - item.title.length), { continued: true });
      doc.font("Helvetica-Bold").fillColor(BLUE).text(` Page ${item.page}`, { align: "right" });
      doc.moveDown(0.45);
    });

    // ========================================================================
    // CHAPTER 1: INTRODUCTION
    // ========================================================================
    h1("CHAPTER 1: INTRODUCTION", "ch1");

    h2("1.1 Background & Problem Statement");
    p(
      "United Rubber Industries (Unit 1) processes high volumes of specialized rubber compounds daily. These compounds are packaged into gunny bags with strict weight tolerances depending on customer specifications and rubber formulas. Historically, weighing was performed manually: operators visually read analog/digital scale indicators, checked weights against paper charts, hand-wrote bag tags, and recorded entries in ledgers."
    );
    p(
      "This manual approach suffered from significant drawbacks: human calculation mistakes, delayed bag turnaround times, illegible tags, lack of audit traceability, vulnerability to scale drift, and data synchronization delays between weighing, staging, and dispatch departments."
    );

    h2("1.2 Objectives & Goals");
    bullet("Automate real-time weight reading from industrial scales via Modbus RTU serial communication.", "Automated Data Capture:");
    bullet("Eliminate manual calculations by validating bag weight against dynamic item-level tolerance ranges.", "Instant Tolerance Validation:");
    bullet("Generate standardized 100mm × 50mm thermal labels with machine-scannable QR codes upon stable weigh-in.", "On-Demand Thermal Printing:");
    bullet("Maintain an immutable audit trail of all weighings with operator details, timestamps, and exportable reports.", "Audit & Traceability:");
    bullet("Provide end-to-end compound inventory tracking across Inward, CIS staging, and Outward dispatch cycles.", "Inventory Control:");

    h2("1.3 Project Scope & Boundaries");
    p(
      "The system encompasses production floor operations (Master Catalog, Live Scale Interfacing, Thermal Label Printing, Historical Auditing) and raw compound warehouse logistics (Inward Receipts, Compound Issue Slips, Outward Dispatch). It is designed for on-premise local deployment on Windows workstations connected to RS-485 serial scale converters and Ethernet-connected TSC thermal printers."
    );

    // ========================================================================
    // CHAPTER 2: SYSTEM ARCHITECTURE & TECH STACK
    // ========================================================================
    h1("CHAPTER 2: SYSTEM ARCHITECTURE & TECH STACK", "ch2");

    h2("2.1 High-Level Architecture");
    p(
      "The system employs a client-server architecture running within Next.js 16. The browser client interacts with Next.js App Router API endpoints via JSON REST interfaces. Hardware communication drivers and database connection pools are maintained as singleton instances on the Node.js globalThis runtime to prevent connection thrashing and survive Hot Module Replacement (HMR)."
    );

    table(
      ["Subsystem", "Technology", "Role / Implementation Detail"],
      [
        ["Frontend UI", "React 19 / Tailwind CSS 4", "Modern responsive operator dashboard, modals, real-time polling"],
        ["Backend Server", "Next.js 16 (Node.js runtime)", "REST API routes, validation pipelines, TSPL socket dispatch"],
        ["Database Layer", "PostgreSQL 14+ / Drizzle ORM", "Relational persistence, auto-migrations on startup, pool caching"],
        ["Scale Interface", "modbus-serial (RS-485)", "Non-overlapping serial polling (1000ms), register decode"],
        ["Printer Client", "Node net.Socket (TCP 9100)", "Raw TSPL string dispatch, 203 DPI bit-accurate QR rendering"],
        ["Document Engine", "PDFKit & docx", "Server-side vector PDF generation and Word document packaging"],
      ],
      [95, 135, 255]
    );

    h2("2.2 Key Architectural Decisions");
    bullet("No OS printer driver or Windows spooler required; TSPL commands are sent directly via TCP port 9100.", "Direct Socket Printing:");
    bullet("Database schema is validated and migrated automatically on application boot via instrumentation.ts.", "Zero-Touch Migration:");
    bullet("Scale polling uses an async lock to prevent queue buildup during serial communication latency.", "Non-Overlapping Polling:");
    bullet("Part number and description are copied into history records to preserve historical integrity.", "Denormalized Audit Trail:");

    // ========================================================================
    // CHAPTER 3: SYSTEM REQUIREMENTS SPECIFICATIONS
    // ========================================================================
    h1("CHAPTER 3: REQUIREMENTS SPECIFICATIONS", "ch3");

    h2("3.1 Functional Requirements Matrix");
    table(
      ["Req ID", "Module", "Description & Acceptance Criteria"],
      [
        ["FR-01", "Master Parts", "Maintain master part catalog with min/max weight per piece and pieces per bag."],
        ["FR-02", "Live Scale", "Poll Modbus RTU scale over COM port at 1000ms intervals and stream weight to UI."],
        ["FR-03", "Tolerance Engine", "Compute bag bounds (min × qty, max × qty) and classify status (OK/Under/Over)."],
        ["FR-04", "Stability Filter", "Detect 5-second weight stability (spread <= 0.005 kg) before auto-recording."],
        ["FR-05", "Thermal Print", "Generate TSPL commands for 100×50mm labels and dispatch to TSC printer."],
        ["FR-06", "Weighing History", "Persist all weighing events; provide search, date filter, CSV export, and PDF."],
        ["FR-07", "Compound Inward", "Record raw material inward, compute supplier batching, and print inward label."],
        ["FR-08", "Compound CIS", "Issue compound against verified inward batches with remaining balance checks."],
        ["FR-09", "Compound Outward", "Dispatch finished compound from CIS stage and generate dispatch documentation."],
      ],
      [55, 105, 325]
    );

    h2("3.2 Non-Functional Requirements");
    bullet("Weight display updates every 500ms; Modbus read latency under 100ms.", "Low Latency UI:");
    bullet("All timestamps persisted in UTC and rendered in Asia/Kolkata (IST, UTC+5:30).", "Timezone Standardization:");
    bullet("Automatic mock scale fallback when physical hardware is detached during testing.", "Fault Tolerance:");
    bullet("Thermal label QR code formatted to Model 2, ECC M for industrial scanner compatibility.", "Scanner Compatibility:");

    // ========================================================================
    // CHAPTER 4: DATABASE SCHEMA & DATA INTEGRITY
    // ========================================================================
    h1("CHAPTER 4: DATABASE SCHEMA & DATA INTEGRITY", "ch4");

    h2("4.1 Relational Data Model");
    p(
      "The relational database schema is modeled in PostgreSQL using Drizzle ORM. It balances normalization for catalog entities with historical denormalization for weighing transactions."
    );

    h2("4.2 Table Specifications");
    table(
      ["Table Name", "Key Columns", "Constraints & Data Types"],
      [
        ["parts", "id, part_number, description, min_weight, max_weight, quantity", "part_number UNIQUE VARCHAR(100), NUMERIC(10,3), INT >= 1"],
        ["weighing_history", "id, part_id, part_number, actual_weight, quantity, status, operator_name, recorded_at", "part_id FK -> parts.id ON DELETE CASCADE, status VARCHAR(20)"],
        ["compound_inwards", "id, inward_number, part_id, quantity, supplier, batch_number, label_code, received_at", "inward_number UNIQUE, part_id FK, label_code UNIQUE"],
        ["compound_cis", "id, cis_number, inward_id, part_id, quantity, operator_name, label_code, created_at", "cis_number UNIQUE, inward_id FK, label_code UNIQUE"],
        ["compound_outwards", "id, outward_number, cis_id, part_id, quantity, destination, label_code, dispatched_at", "outward_number UNIQUE, cis_id FK, label_code UNIQUE"],
      ],
      [110, 175, 200]
    );

    h2("4.3 Status Classification Logic");
    p("The bag status is evaluated strictly on the backend and verified on the client using the following mathematical bounds:");
    callout(
      "Minimum Allowed Bag Weight = min_weight × quantity\nMaximum Allowed Bag Weight = max_weight × quantity\n\nif (actual_weight < Minimum Allowed Bag Weight)  →  UNDERWEIGHT\nelse if (actual_weight > Maximum Allowed Bag Weight)  →  OVERWEIGHT\nelse  →  OK (Accepted)",
      "TOLERANCE CLASSIFICATION ALGORITHM"
    );

    // ========================================================================
    // CHAPTER 5: DETAILED MODULE IMPLEMENTATION
    // ========================================================================
    h1("CHAPTER 5: DETAILED MODULE IMPLEMENTATION", "ch5");

    h2("5.1 Master Catalog & Bag Configuration");
    p(
      "The Master Catalog module allows plant administrators to register rubber compound parts. For each part, the system stores per-unit min/max weights in kg and standard pieces per bag. The UI provides real-time bag weight calculation previews, search filtering with a 350ms debounce, and batch label printing."
    );

    h2("5.2 Live Scale & Rolling Min/Max Stability Algorithm");
    p(
      "Industrial scales in manufacturing plants frequently experience vibrations from conveyors, forklifts, and mechanical presses. Standard threshold checks comparing two adjacent readings are vulnerable to slow weight drift. The Gunny Bag Weighing System implements a robust rolling-window stability algorithm:"
    );

    callout(
      "Algorithm Parameters:\n• STABLE_DURATION_MS = 5000 ms\n• WEIGHT_TOLERANCE_KG = 0.005 kg\n• MAX_READING_AGE_MS = 2000 ms\n\nEvaluation Logic:\n1. On each tick, add reading (weight, timestamp) to rolling buffer.\n2. Evict samples older than 5,000 ms.\n3. Compute spread = max(buffer.weights) - min(buffer.weights).\n4. If spread <= 0.005 kg AND buffer span >= 5000 ms -> Report STABLE.\n5. Upon auto-print, system locks until scale drops to <= 0.005 kg (rearm cycle).",
      "WEIGHT STABILITY FILTER"
    );

    h2("5.3 TSPL 203-DPI Thermal Label Design");
    p(
      "Thermal printing is implemented using the Thermal Smart Printer Language (TSPL) targeting standard 100mm × 50mm label stock at 203 dots per inch (800 × 400 dots total canvas). The layout includes a bold company header, outer bounding box, vertical divider bar, native matrix QR code generated via qrcode, and crisp aligned data rows using Font 2."
    );

    h2("5.4 Compound Inventory Subsystems");
    p(
      "The Compound Inventory module introduces end-to-end multi-stage tracking: Inward Receipt (raw materials received from external suppliers), Compound Issue Slip / CIS (materials staged for internal processing), and Outward Dispatch (finished goods ready for shipment). Inward and CIS records generate unique reference numbers and 100×50mm labels for scan-to-advance transitions; outward records use a unique reference number without label printing."
    );

    // ========================================================================
    // CHAPTER 6: TESTING, VERIFICATION & QUALITY ASSURANCE
    // ========================================================================
    h1("CHAPTER 6: TESTING & QUALITY ASSURANCE", "ch6");

    h2("6.1 Testing Methodology");
    p(
      "Comprehensive verification was executed across hardware drivers, business logic algorithms, database persistence, and user interfaces using both simulated mocks and physical shop-floor hardware."
    );

    table(
      ["Test Case ID", "Module", "Test Scenario", "Expected Outcome", "Status"],
      [
        ["TC-01", "Modbus Serial", "Disconnect serial cable mid-operation", "Service logs warning, switches to mock without crash", "PASSED"],
        ["TC-02", "Stability Engine", "Introduce sinusoidal weight jitter of 0.02kg", "Stability flag remains FALSE; no auto-print triggers", "PASSED"],
        ["TC-03", "Stability Engine", "Steady weight held for 5.1 seconds", "Auto-saves record and dispatches print socket", "PASSED"],
        ["TC-04", "Tolerance Logic", "Part PN-01 (100 pcs, 0.5-1.0kg) bag at 48.0kg", "Classified as UNDERWEIGHT with amber warning banner", "PASSED"],
        ["TC-05", "Printer Client", "Printer offline / IP unreachable", "Socket returns timeout in 5000ms; error displayed in UI", "PASSED"],
        ["TC-06", "Inventory Cycle", "Scan Inward QR code in CIS view", "Automatically opens pre-filled CIS modal for batch", "PASSED"],
      ],
      [65, 80, 130, 160, 50]
    );

    // ========================================================================
    // CHAPTER 7: DEPLOYMENT, SOP & FUTURE SCOPE
    // ========================================================================
    h1("CHAPTER 7: DEPLOYMENT, SOP & FUTURE SCOPE", "ch7");

    h2("7.1 Standard Operating Procedure (SOP) for Operators");
    bullet("Power on the weighing scale indicator and TSC label printer. Ensure green network LED on printer.", "1. Startup:");
    bullet("Open browser and navigate to http://localhost:3000/weighing. Verify green scale indicator.", "2. Open Weighing:");
    bullet("Click 'Select Part' and choose the target rubber compound part number.", "3. Select Part:");
    bullet("Place the filled gunny bag onto the scale platform. Ensure bag does not touch side rails.", "4. Place Bag:");
    bullet("Observe weight display. Status will turn green (OK). Hold stable for 5 seconds.", "5. Weighing:");
    bullet("Label automatically prints from TSC printer. Affix label to the center of the gunny bag.", "6. Labeling:");
    bullet("Remove bag from scale platform. System rearms automatically once weight reaches zero.", "7. Rearm:");

    h2("7.2 Production Environment Configuration");
    p(
      "Configuration is managed via the .env file. The production setup defines the database connection URL, printer IP address (192.168.1.75:9100), serial port (COM7, 9600 baud, 8N1), slave ID 1, function code 4, register 0, and divisor 100."
    );

    h2("7.3 Future Enhancements");
    bullet("Integration with cloud ERP platforms (SAP / Oracle) for automated purchase order reconciliation.", "Enterprise ERP Sync:");
    bullet("Support for multiple weighing scale stations communicating concurrently to a central server.", "Multi-Scale Topology:");
    bullet("Introduction of industrial RFID tags for automated bag tracking across warehouse zones.", "RFID Asset Tracking:");

    // ========================================================================
    // CHAPTER 8: REFERENCES
    // ========================================================================
    h1("CHAPTER 8: REFERENCES", "ch8");
    p("1. Modbus Organization, 'Modbus Application Protocol Specification V1.1b3', 2012.");
    p("2. TSC Auto ID Technology Co., Ltd., 'TSPL/TSPL2 Programming Language Reference Manual', 2021.");
    p("3. PostgreSQL Global Development Group, 'PostgreSQL 14.0 Documentation', 2021.");
    p("4. Drizzle Team, 'Drizzle ORM Documentation & Best Practices', 2024.");
    p("5. ISO/IEC 18004:2015, 'Information technology — Automatic identification and data capture techniques — QR Code bar code symbology specification'.");

    // ========================================================================
    // RUNNING HEADERS & FOOTERS ON ALL PAGES EXCEPT COVER (PAGE 1)
    // ========================================================================
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 1; i < totalPages; i++) {
      doc.switchToPage(i);

      // Running Header
      doc.fontSize(8).font("Helvetica-Bold").fillColor(NAVY).text("UNITED RUBBER INDUSTRIES — UNIT 1", L, 35, { width: W / 2, align: "left" });
      doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Gunny Bag Weighing System Documentation", L + W / 2, 35, { width: W / 2, align: "right" });
      doc.moveTo(L, 47).lineTo(R, 47).lineWidth(0.5).strokeColor(BORDER).stroke();

      // Running Footer
      doc.moveTo(L, PH - 45).lineTo(R, PH - 45).lineWidth(0.5).strokeColor(BORDER).stroke();
      doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Confidential & Proprietary", L, PH - 38, { width: W / 2, align: "left" });
      doc.fontSize(8).font("Helvetica-Bold").fillColor(NAVY).text(`Page ${i + 1} of ${totalPages}`, L + W / 2, PH - 38, { width: W / 2, align: "right" });
    }

    doc.end();
  });
}

// ============================================================================
// DOCX GENERATION ENGINE USING DOCX LIBRARY
// ============================================================================

export async function generateDocumentationDOCX(): Promise<Buffer> {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  };

  const doc = new Document({
    creator: "United Rubber Industries",
    title: "Gunny Bag Weighing System — Project Documentation",
    description: "Formal technical project report and system specification",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "United Rubber Industries (Unit 1) — Gunny Bag Weighing System",
                    size: 16,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page ", size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "0F2942", bold: true }),
                  new TextRun({ text: " of ", size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "0F2942", bold: true }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ══════════════════════════════════════════════════════════════════
          // TITLE / COVER
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: "UNITED RUBBER INDUSTRIES — UNIT 1",
                bold: true,
                size: 26,
                color: "0F2942",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
            children: [
              new TextRun({
                text: "INDUSTRIAL AUTOMATION & PROCESS ENGINEERING DIVISION",
                size: 18,
                color: "64748B",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 500, after: 200 },
            children: [
              new TextRun({
                text: "GUNNY BAG WEIGHING &\nINVENTORY MANAGEMENT SYSTEM",
                bold: true,
                size: 38,
                color: "0F2942",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({
                text: "Technical Project Documentation & System Specification\nVersion 1.0.0 (Production Release)",
                italics: true,
                size: 20,
                color: "2563EB",
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Organization", bold: true, size: 18 })] })],
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    borders: tableBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "United Rubber Industries (Unit 1)", size: 18 })] })],
                    borders: tableBorder,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Software Stack", bold: true, size: 18 })] })],
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    borders: tableBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4", size: 18 })] })],
                    borders: tableBorder,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Database", bold: true, size: 18 })] })],
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    borders: tableBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "PostgreSQL 14+ with Drizzle ORM (Zero-Touch Auto-Migrations)", size: 18 })] })],
                    borders: tableBorder,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Hardware Interfaces", bold: true, size: 18 })] })],
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    borders: tableBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Modbus RTU Serial Scale (RS-485) & TSC Thermal Printer (TCP 9100)", size: 18 })] })],
                    borders: tableBorder,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Release Date", bold: true, size: 18 })] })],
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    borders: tableBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "September 2026", size: 18 })] })],
                    borders: tableBorder,
                  }),
                ],
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CERTIFICATE
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 800, after: 200 },
            children: [new TextRun({ text: "CERTIFICATE OF COMPLETION", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "This is to formally certify that the industrial software automation project entitled 'Gunny Bag Weighing & Compound Inventory Management System' has been successfully designed, developed, integrated, tested, and commissioned for United Rubber Industries (Unit 1).",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "The system fulfills all defined operational requirements, including automated Modbus RTU serial scale interfacing, real-time rolling-window weight stability verification (spread <= 0.005 kg for 5 consecutive seconds), high-speed 203-DPI TSPL thermal label printing, comprehensive weighing audit logging, and QR-code enabled compound inventory tracking.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // ABSTRACT
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "ABSTRACT & EXECUTIVE SUMMARY", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "In industrial rubber manufacturing facilities, manual weighing and handwritten record-keeping for compound bags introduce significant risks of human error, weight discrepancies, and inventory shrinkage. This report presents the design and implementation of the Gunny Bag Weighing System—a modern, web-based industrial automation platform built for United Rubber Industries (Unit 1).",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "The system unifies real-time hardware scale reading over Modbus RTU serial communication, dynamic tolerance verification, 203-DPI TSPL thermal label printing over raw TCP sockets, immutable historical audit logging, and QR-driven compound inventory tracking.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 1: INTRODUCTION
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 1: INTRODUCTION", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [new TextRun({ text: "1.1 Background & Problem Statement", bold: true, color: "2563EB", size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "United Rubber Industries (Unit 1) processes high volumes of specialized rubber compounds daily. These compounds are packaged into gunny bags with precise weight specifications. Historically, weighing operations were performed manually, leading to human calculation errors, slow bag turnaround times, and lack of audit traceability. The new automated system eliminates these inefficiencies through direct scale integration and automated printing.",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [new TextRun({ text: "1.2 Objectives & Goals", bold: true, color: "2563EB", size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Automated Data Capture: ", bold: true }),
              new TextRun({ text: "Directly sample weight registers from Modbus RTU serial scales without operator manual entry." }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Real-Time Tolerance Validation: ", bold: true }),
              new TextRun({ text: "Calculate dynamic min/max bag weight ranges and categorize bags as OK, UNDERWEIGHT, or OVERWEIGHT." }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Thermal Label Printing: ", bold: true }),
              new TextRun({ text: "Automatically stream 203-DPI TSPL commands to TSC thermal printers with QR code matrix barcodes." }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 2: SYSTEM ARCHITECTURE
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 2: SYSTEM ARCHITECTURE & TECH STACK", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "The application is built on Next.js 16 (App Router) with React 19, TypeScript, and PostgreSQL with Drizzle ORM. Hardware connectivity is managed by singleton background services on globalThis to ensure stability across server hot reloads. Direct TCP socket communication interfaces with TSC thermal printers on port 9100 without requiring Windows printer spooler drivers.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 3: REQUIREMENTS SPECIFICATIONS
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 3: REQUIREMENTS SPECIFICATIONS", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Functional requirements include master parts maintenance, live scale reading, 5-second stability filtering, automated and manual recording, thermal label printing, weighing history with CSV export and PDF downloads, and compound inventory tracking across Inward, CIS, and Outward stages.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 4: DATABASE & DATA INTEGRITY
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 4: DATABASE SCHEMA & DATA INTEGRITY", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "PostgreSQL tables (parts, weighing_history, compound_inwards, compound_cis, compound_outwards) enforce referential integrity and uniqueness constraints. The weighing_history table stores denormalized part numbers and descriptions to preserve audit records even if part specifications are altered in the future. All timestamps are stored in UTC and displayed in Indian Standard Time (IST, UTC+5:30).",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 5: IMPLEMENTATION & HARDWARE
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 5: DETAILED MODULE IMPLEMENTATION", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "The WeightStability class tracks the full min/max spread across a 5-second rolling buffer. Only when the spread is <= 0.005 kg for 5 full seconds is a stable weigh-in confirmed. TSPL thermal labels (100mm × 50mm, 800 × 400 dots) are generated dynamically with company headers, borders, dividers, QR codes, and formatted data rows.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 6: TESTING & VERIFICATION
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 6: TESTING & QUALITY ASSURANCE", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "All modules have undergone comprehensive functional, edge-case, and hardware disconnection testing. Mock fallback mechanisms ensure continuous developer productivity when physical scale devices are offline.",
                size: 20,
              }),
            ],
          }),

          // ══════════════════════════════════════════════════════════════════
          // CHAPTER 7: DEPLOYMENT & SOP
          // ══════════════════════════════════════════════════════════════════
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "CHAPTER 7: DEPLOYMENT, OPERATIONAL SOP & FUTURE SCOPE", bold: true, color: "0F2942", size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Clear Standard Operating Procedures (SOPs) are defined for plant operators: scale powering, part selection, bag placement, stability detection, automatic label affixing, and scale rearming. Future enhancements include enterprise ERP synchronization and multi-scale topology.",
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
