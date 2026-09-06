import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parts, weighingHistory } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import {
  tscPrinterClient,
  generateGunnyBagTSPL,
  getPrinter,
  type GunnyBagLabelData,
} from "@/utils/printer";

export const runtime = "nodejs"; // need raw TCP via net.Socket

// POST /api/print
//   Single mode:   { partId, recordId? }   - prints one label
//   Batch mode:    { partIds: [..] }        - prints one per part (no recordId)
//
// When `recordId` is provided, the printed label also includes the
// actual measured weight and the OK / OVERWEIGHT / UNDERWEIGHT status
// so the operator can tell at a glance which bags are off-spec.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partId, partIds, recordId } = body;

    // ---- Batch mode ----
    if (Array.isArray(partIds) && partIds.length > 0) {
      const rows = await db.select().from(parts);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const missing: number[] = [];

      const printer = getPrinter();
      let printed = 0;

      for (const id of partIds) {
        const part = byId.get(id);
        if (!part) {
          missing.push(id);
          continue;
        }
        const label: GunnyBagLabelData = {
          partNumber: part.partNumber,
          description: part.description,
          minWeight: part.minWeight,
          maxWeight: part.maxWeight,
          quantity: part.quantity,
          actualWeight: part.actualWeight,
        };
        const tspl = generateGunnyBagTSPL(label);
        await tscPrinterClient.send(printer.ip, printer.port, tspl);
        printed += 1;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      return NextResponse.json({
        success: true,
        data: { printed, missing },
        message: `${printed} label(s) printed${
          missing.length ? `, ${missing.length} not found` : ""
        }`,
      });
    }

    // ---- Single mode ----
    if (!partId) {
      return NextResponse.json(
        { success: false, error: "partId is required" },
        { status: 400 }
      );
    }

    const [part] = await db.select().from(parts).where(eq(parts.id, partId));
    if (!part) {
      return NextResponse.json(
        { success: false, error: "Part not found" },
        { status: 404 }
      );
    }

    // Optional: enrich the label with the recorded weight + status
    let actualWeight: string | null = null;
    let status: string | null = null;
    if (recordId !== undefined && recordId !== null) {
      const [rec] = await db
        .select()
        .from(weighingHistory)
        .where(eq(weighingHistory.id, recordId));
      if (rec) {
        actualWeight = rec.actualWeight;
        status = rec.status;
      }
    } else {
      // If no explicit recordId was passed, use the most recent record
      // for this part (so the operator can simply hit "Print" right
      // after recording).
      const [rec] = await db
        .select()
        .from(weighingHistory)
        .where(eq(weighingHistory.partId, partId))
        .orderBy(desc(weighingHistory.recordedAt))
        .limit(1);
      if (rec) {
        actualWeight = rec.actualWeight;
        status = rec.status;
      }
    }

    const label: GunnyBagLabelData = {
      partNumber: part.partNumber,
      description: part.description,
      minWeight: part.minWeight,
      maxWeight: part.maxWeight,
      quantity: part.quantity,
      actualWeight: part.actualWeight,
      recordActualWeight: actualWeight,
      status,
    };

    const tspl = generateGunnyBagTSPL(label);
    const printer = getPrinter();
    await tscPrinterClient.send(printer.ip, printer.port, tspl);

    return NextResponse.json({
      success: true,
      message: `Label for ${part.partNumber} printed${
        status ? ` (${status})` : ""
      }`,
    });
  } catch (error) {
    console.error("Print error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to print label";
    return NextResponse.json(
      { success: false, error: `Print failed: ${message}` },
      { status: 500 }
    );
  }
}

// GET /api/print?test=1  - send a minimal test label to confirm reachability
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("test") !== "1") {
    return NextResponse.json(
      { success: false, error: "Use POST to print, or ?test=1 for a test print" },
      { status: 400 }
    );
  }

  try {
    const printer = getPrinter();
    const tspl = [
      "SIZE 100 mm, 50 mm",
      "GAP 3 mm, 0 mm",
      "DIRECTION 0",
      "CLS",
      'TEXT 200,180,"0",0,4,4,"PRINTER OK"',
      "PRINT 1,1",
      "",
    ].join("\r\n");
    await tscPrinterClient.send(printer.ip, printer.port, tspl);
    return NextResponse.json({
      success: true,
      message: `Test print sent to ${printer.ip}:${printer.port}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Print failed";
    return NextResponse.json(
      {
        success: false,
        error: `Printer unreachable at ${getPrinter().ip}:${getPrinter().port} - ${message}`,
      },
      { status: 500 }
    );
  }
}
