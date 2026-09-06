import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Runs the drizzle migrations against the database referenced by
 * DATABASE_URL. Called once at server startup from instrumentation.ts
 * so the user does not have to run drizzle-kit manually.
 *
 * If the migrations folder is missing (no migrations written yet) we
 * fall back to pushing the schema directly so the app still works.
 */
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    // First try the migrations folder (proper way)
    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("[db] Migrations applied successfully");
      return;
    } catch (migErr) {
      // Fall back to schema push if no migrations folder exists yet
      console.warn(
        "[db] Migrations folder not found, attempting raw SQL schema push..."
      );
      await pushSchemaRaw(pool);
      console.log("[db] Schema pushed via raw SQL");
    }
  } finally {
    await pool.end();
  }
}

async function pushSchemaRaw(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS parts (
        id SERIAL PRIMARY KEY,
        part_number VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(500) NOT NULL,
        min_weight NUMERIC(10, 3) NOT NULL,
        max_weight NUMERIC(10, 3) NOT NULL,
        quantity INTEGER NOT NULL,
        max_bag_weight NUMERIC(10, 3) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS weighing_history (
        id SERIAL PRIMARY KEY,
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        part_number VARCHAR(100) NOT NULL,
        description VARCHAR(500) NOT NULL,
        actual_weight NUMERIC(10, 3) NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL,
        operator_name VARCHAR(200),
        remarks TEXT,
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_weighing_history_part_id
        ON weighing_history(part_id);
      CREATE INDEX IF NOT EXISTS idx_weighing_history_recorded_at
        ON weighing_history(recorded_at);
    `);

    // Convert existing naive timestamp columns to TIMESTAMP WITH TIME ZONE.
    // The existing values were stored as naive timestamps representing server
    // local time (Asia/Kolkata / IST, UTC+5:30). We interpret them as IST and
    // convert to proper UTC instants so the pg driver returns correct UTC values.
    await client.query(`
      ALTER TABLE weighing_history
        ALTER COLUMN recorded_at TYPE TIMESTAMP WITH TIME ZONE
        USING (recorded_at AT TIME ZONE 'Asia/Kolkata');

      ALTER TABLE parts
        ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
        USING (created_at AT TIME ZONE 'Asia/Kolkata');

      ALTER TABLE parts
        ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE
        USING (updated_at AT TIME ZONE 'Asia/Kolkata');
    `);
    console.log("[db] Timestamp columns converted to WITH TIME ZONE");
  } finally {
    client.release();
  }
}
