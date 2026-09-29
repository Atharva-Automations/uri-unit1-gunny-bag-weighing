import { NextResponse } from "next/server";
import { getScaleStatus } from "@/services/scale";

export const runtime = "nodejs";

/** GET /api/scale/status — health/diagnostics for the scale service. */
export async function GET() {
  return NextResponse.json({ success: true, data: getScaleStatus() });
}
