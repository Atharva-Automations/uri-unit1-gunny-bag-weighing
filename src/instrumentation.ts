/**
 * Next.js instrumentation hook — runs once on server start.
 * Auto-creates the database tables if they don't exist so the user
 * does not have to run drizzle-kit migrations manually.
 *
 * Also boots the weighing-scale service so live weight readings
 * are immediately available from /api/scale.
 */
export async function register() {
  // Only run in the Node.js runtime, not the Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { runMigrations } = await import("@/db/migrate");
      await runMigrations();
    } catch (err) {
      console.error("[instrumentation] Auto-migration failed:", err);
    }

    try {
      const { startScaleService } = await import("@/services/scale");
      startScaleService();
    } catch (err) {
      console.error("[instrumentation] Scale service failed to start:", err);
    }
  }
}
