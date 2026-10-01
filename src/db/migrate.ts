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
        actual_weight NUMERIC(10, 3) NOT NULL DEFAULT '0',
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

      CREATE TABLE IF NOT EXISTS compound_inwards (
        id SERIAL PRIMARY KEY,
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        inward_number VARCHAR(60) NOT NULL UNIQUE,
        label_code VARCHAR(100) NOT NULL UNIQUE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        supplier VARCHAR(200),
        batch_number VARCHAR(100),
        operator_name VARCHAR(200),
        remarks TEXT,
        received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS compound_outwards (
        id SERIAL PRIMARY KEY,
        inward_id INTEGER REFERENCES compound_inwards(id) ON DELETE CASCADE,
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        outward_number VARCHAR(60) NOT NULL UNIQUE,
        label_code VARCHAR(100) NOT NULL UNIQUE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        destination VARCHAR(200),
        operator_name VARCHAR(200),
        remarks TEXT,
        dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      ALTER TABLE compound_outwards
        ALTER COLUMN label_code DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS compound_returns (
        id SERIAL PRIMARY KEY,
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        outward_id INTEGER REFERENCES compound_outwards(id) ON DELETE SET NULL,
        inward_id INTEGER REFERENCES compound_inwards(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        reason VARCHAR(500) NOT NULL,
        batch_number VARCHAR(100),
        supplier VARCHAR(200),
        inward_number VARCHAR(60),
        quality_grade VARCHAR(100),
        operator_name VARCHAR(200),
        remarks TEXT,
        add_to_inventory INTEGER NOT NULL DEFAULT 1,
        returned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_compound_inwards_part_id ON compound_inwards(part_id);
      CREATE INDEX IF NOT EXISTS idx_compound_outwards_part_id ON compound_outwards(part_id);
      CREATE INDEX IF NOT EXISTS idx_compound_returns_part_id ON compound_returns(part_id);
      -- idx_compound_outwards_inward_id is created at the end of
      -- migrateCompoundOutwardsToInwardLink, once the column exists.

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compound_returns' AND column_name = 'batch_number') THEN
          ALTER TABLE compound_returns ADD COLUMN batch_number VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compound_returns' AND column_name = 'supplier') THEN
          ALTER TABLE compound_returns ADD COLUMN supplier VARCHAR(200);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compound_returns' AND column_name = 'inward_number') THEN
          ALTER TABLE compound_returns ADD COLUMN inward_number VARCHAR(60);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compound_returns' AND column_name = 'quality_grade') THEN
          ALTER TABLE compound_returns ADD COLUMN quality_grade VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compound_returns' AND column_name = 'add_to_inventory') THEN
          ALTER TABLE compound_returns ADD COLUMN add_to_inventory INTEGER NOT NULL DEFAULT 1;
        END IF;
      END $$;
    `);

    // Migrate existing parts table: replace max_bag_weight with actual_weight
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'parts' AND column_name = 'max_bag_weight'
        ) THEN
          ALTER TABLE parts DROP COLUMN max_bag_weight;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'parts' AND column_name = 'actual_weight'
        ) THEN
          ALTER TABLE parts ADD COLUMN actual_weight NUMERIC(10, 3) NOT NULL DEFAULT '0';
        END IF;
      END $$;
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

    await migrateCompoundOutwardsToInwardLink(client);
  } finally {
    client.release();
  }
}

/**
 * CIS has been removed from the workflow: outwards now link straight to the
 * inward record. For databases created before this change we add
 * `compound_outwards.inward_id` / `compound_returns.inward_id`, backfill them
 * from the old `cis_id` link (through `compound_cis`), then drop the CIS
 * columns and finally the `compound_cis` table itself.
 */
async function migrateCompoundOutwardsToInwardLink(client: import("pg").PoolClient) {
  const hasTable = async (table: string) => {
    const { rows } = await client.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [table]
    );
    return Boolean(rows[0]?.exists);
  };
  const hasColumn = async (table: string, column: string) => {
    const { rows } = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2) AS exists",
      [table, column]
    );
    return Boolean(rows[0]?.exists);
  };

  if (!(await hasTable("compound_outwards"))) return;

  if (!(await hasColumn("compound_outwards", "inward_id"))) {
    await client.query(`ALTER TABLE compound_outwards ADD COLUMN inward_id INTEGER`);
  }
  if (!(await hasColumn("compound_returns", "inward_id"))) {
    await client.query(`ALTER TABLE compound_returns ADD COLUMN inward_id INTEGER`);
  }

  // Backfill the new direct inward links from the legacy CIS chain.
  if (await hasTable("compound_cis") && (await hasColumn("compound_outwards", "cis_id"))) {
    await client.query(`
      UPDATE compound_outwards o
      SET inward_id = c.inward_id
      FROM compound_cis c
      WHERE o.inward_id IS NULL AND o.cis_id = c.id;
    `);
    await client.query(`
      UPDATE compound_returns r
      SET inward_id = o.inward_id
      FROM compound_outwards o
      WHERE r.inward_id IS NULL AND r.outward_id = o.id AND o.inward_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE compound_returns r
      SET inward_id = c.inward_id
      FROM compound_cis c
      WHERE r.inward_id IS NULL AND r.cis_id = c.id;
    `);
  }

  // Attach the foreign keys only once every legacy row is populated.
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'compound_outwards_inward_id_fkey'
      ) THEN
        ALTER TABLE compound_outwards
          ADD CONSTRAINT compound_outwards_inward_id_fkey
          FOREIGN KEY (inward_id) REFERENCES compound_inwards(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'compound_returns_inward_id_fkey'
      ) THEN
        ALTER TABLE compound_returns
          ADD CONSTRAINT compound_returns_inward_id_fkey
          FOREIGN KEY (inward_id) REFERENCES compound_inwards(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  if (await hasColumn("compound_outwards", "cis_id")) {
    await client.query(`ALTER TABLE compound_outwards DROP COLUMN cis_id`);
  }
  if (await hasColumn("compound_returns", "cis_id")) {
    await client.query(`ALTER TABLE compound_returns DROP COLUMN cis_id`);
  }
  if (await hasTable("compound_cis")) {
    await client.query(`DROP TABLE IF EXISTS compound_cis`);
  }

  await client.query(`CREATE INDEX IF NOT EXISTS idx_compound_outwards_inward_id ON compound_outwards(inward_id)`);
  console.log("[db] Compound CIS removed; outwards now link directly to inwards");
}
