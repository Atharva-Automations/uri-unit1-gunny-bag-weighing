import { NextResponse } from "next/server";
import { getCurrentReading, getScaleStatus } from "@/services/scale";

export const runtime = "nodejs";

/**
 * GET /api/scale
 * Returns the latest cached weight from the connected weighing
 * scale. If the scale is not connected and SCALE_MOCK is enabled,
 * returns a mock reading so the UI still works during development.
 */
export async function GET() {
  const status = getScaleStatus();
  const reading = getCurrentReading();
  if (!reading) {
    return NextResponse.json(
      {
        success: false,
        error: "Weighing scale not connected",
        status,
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ success: true, data: reading, status });
}
