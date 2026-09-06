import { NextResponse } from "next/server";
import { db } from "@/db";
import { parts, weighingHistory } from "@/db/schema";
import { sql, eq, gte, desc } from "drizzle-orm";

export async function GET() {
  try {
    const [totalParts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(parts);

    const [totalWeighings] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(weighingHistory);

    const [okCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(weighingHistory)
      .where(eq(weighingHistory.status, "OK"));

    const [overCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(weighingHistory)
      .where(eq(weighingHistory.status, "OVERWEIGHT"));

    const [underCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(weighingHistory)
      .where(eq(weighingHistory.status, "UNDERWEIGHT"));

    // Today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(weighingHistory)
      .where(gte(weighingHistory.recordedAt, today));

    // Recent 5 records
    const recentRecordsRaw = await db
      .select()
      .from(weighingHistory)
      .orderBy(desc(weighingHistory.recordedAt))
      .limit(5);

    // recordedAt is TIMESTAMP WITH TIME ZONE — format in IST directly.
    const formatIST = (raw: unknown) => {
      return new Date(raw).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    };

    const recentRecords = recentRecordsRaw.map((r) => ({
      ...r,
      recordedAt: formatIST(r.recordedAt),
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalParts: totalParts.count,
        totalWeighings: totalWeighings.count,
        okCount: okCount.count,
        overweightCount: overCount.count,
        underweightCount: underCount.count,
        todayCount: todayCount.count,
        recentRecords,
      },
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
