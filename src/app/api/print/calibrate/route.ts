import { NextResponse } from "next/server";
import { tscPrinterClient, getPrinter } from "@/utils/printer";

export const runtime = "nodejs";

/**
 * POST /api/print/calibrate
 * Sends a TSPL calibration sequence to the printer so the gap sensor
 * re-learns the physical label size. Use this when the printer feeds
 * 3-4 blank labels before printing — typically the first time after
 * loading a new roll, or after power-cycling.
 */
export async function POST() {
  try {
    const printer = getPrinter();
    // The TSPL calibration sequence:
    //   1) SIZE with the expected label dimensions
    //   2) GAP with the gap distance
    //   3) FORM tells the printer to feed and re-measure the gap
    const tspl = ["SIZE 100 mm, 50 mm", "GAP 3 mm, 0 mm", "FORM", ""].join(
      "\r\n"
    );
    await tscPrinterClient.send(printer.ip, printer.port, tspl);
    return NextResponse.json({
      success: true,
      message:
        "Printer calibrated to 100×50mm. The next label should align correctly.",
    });
  } catch (error) {
    console.error("Calibrate error:", error);
    const message =
      error instanceof Error ? error.message : "Calibration failed";
    return NextResponse.json(
      {
        success: false,
        error: `Calibration failed: ${message}. Check the printer's Ethernet connection and that the roll is loaded correctly.`,
      },
      { status: 500 }
    );
  }
}
