import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";
import { workspaceMigration } from "./workspaceMigration";

const { Pool } = pg;

const hasDatabaseUrl = process.env.DATABASE_URL && 
  process.env.DATABASE_URL !== "" && 
  !process.env.DATABASE_URL.includes("your_password_here") &&
  !process.env.DATABASE_URL.startsWith("postgresql://...");

let pool: any = null;
let db: any = null;
let client: PGlite | null = null;
let tablesExist = false;

function findWorkspaceRoot(startPath: string): string | null {
  let current = startPath;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml")) || fs.existsSync(path.join(current, "package.json"))) {
      if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
        return current;
      }
    }
    current = path.dirname(current);
  }
  return null;
}

if (hasDatabaseUrl) {
  console.log("[DATABASE] Connecting to remote/local PostgreSQL database...");
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.log("\n=========================================================");
  console.log("[DATABASE] DATABASE_URL is not set or has placeholders.");
  console.log("[DATABASE] SPINNING UP IN-MEMORY POSTGRESQL (PGLITE) DATABASE...");
  console.log("=========================================================\n");

  const dbPath = process.env.PGLITE_DATA_DIR || path.join(findWorkspaceRoot(process.cwd()) || process.cwd(), ".pglite-db");
  const pidFile = path.join(dbPath, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log("[DATABASE] Removed stale postmaster.pid lock file");
    } catch {
      // Ignored
    }
  }
  const configuredInitialMemoryMb = Number(process.env.PGLITE_INITIAL_MEMORY_MB || "128");
  const initialMemoryMb = Number.isFinite(configuredInitialMemoryMb)
    ? Math.max(128, Math.min(256, configuredInitialMemoryMb))
    : 128;
  client = new PGlite(dbPath, {
    initialMemory: initialMemoryMb * 1024 * 1024,
  });
  db = drizzlePglite(client, { schema });

  tablesExist = false;
  // Read and execute schema migration to create tables
  try {
    try {
      await client.waitReady;
      const checkRes = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'tenders' LIMIT 1;");
      if (checkRes.rows && checkRes.rows.length > 0) {
        tablesExist = true;
      }
    } catch (e) {
      if (fs.existsSync(path.join(dbPath, "global")) || fs.existsSync(path.join(dbPath, "base"))) {
        tablesExist = true;
      }
    }

    let sqlPath = "";
    
    // 1. Try finding workspace root first
    const wsRoot = findWorkspaceRoot(process.cwd());
    if (wsRoot) {
      const p = path.join(wsRoot, "lib/db/drizzle/0000_brave_the_liberteens.sql");
      if (fs.existsSync(p)) {
        sqlPath = p;
      }
    }
    
    // 2. Fallbacks
    if (!sqlPath) {
      const pathsToTry = [
        path.join(process.cwd(), "../../lib/db/drizzle/0000_brave_the_liberteens.sql"),
        path.join(process.cwd(), "../lib/db/drizzle/0000_brave_the_liberteens.sql"),
        path.join(process.cwd(), "./lib/db/drizzle/0000_brave_the_liberteens.sql"),
        path.join(process.cwd(), "./drizzle/0000_brave_the_liberteens.sql"),
        typeof __dirname !== "undefined"
          ? path.join(__dirname, "../drizzle/0000_brave_the_liberteens.sql")
          : path.join(path.dirname(fileURLToPath(import.meta.url)), "../drizzle/0000_brave_the_liberteens.sql")
      ];

      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          sqlPath = p;
          break;
        }
      }
    }

    if (tablesExist) {
      console.log("[DATABASE] Database tables already initialized, skipping migration execution.");
    } else if (sqlPath) {
      console.log(`[DATABASE] Found schema migration at: ${sqlPath}. Executing migration...`);
        let sqlContent = fs.readFileSync(sqlPath, "utf-8");
        sqlContent = sqlContent.replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ");
        await client.exec(sqlContent);
        
        // Ensure the new historical_awards table is created
        await client.exec(`
          CREATE TABLE IF NOT EXISTS "historical_awards" (
            "id" text PRIMARY KEY NOT NULL,
            "tender_id" text,
            "contracting_auth" text NOT NULL,
            "procedure_name" text NOT NULL,
            "winner_name" text NOT NULL,
            "winning_bid_amount" double precision NOT NULL,
            "currency" text DEFAULT 'KM' NOT NULL,
            "award_date" timestamp NOT NULL,
            "competitor_offers_count" integer,
            "created_at" timestamp DEFAULT now() NOT NULL
          );
        `);
        console.log("[DATABASE] In-memory PostgreSQL schema initialized successfully!");

        // Ensure new columns and profile table exist for high-value features safely
        try {
          await client.exec(`
          ALTER TABLE "tenders" ALTER COLUMN "deadline" DROP NOT NULL;
          UPDATE "tenders" SET "category" = 'Drugo', "updated_at" = now()
            WHERE "source" IN ('ejn', 'ejn_openapi') AND "category" = 'Osiguranje'
            AND "raw_data"->'announcement'->>'ContractType' IN ('Goods', 'Works');
          ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "win_probability_pct" double precision;
        
        CREATE TABLE IF NOT EXISTS "contracting_authority_profiles" (
          "id" text PRIMARY KEY NOT NULL,
          "ejn_id" text UNIQUE NOT NULL,
          "name" text NOT NULL,
          "level" text,
          "municipality" text,
          "vrsta" text,
          "last_scraped_at" timestamp,
          "last_updated" timestamp DEFAULT now() NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "historical_awards" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text,
          "contracting_auth" text NOT NULL,
          "procedure_name" text NOT NULL,
          "winner_name" text NOT NULL,
          "winning_bid_amount" double precision NOT NULL,
          "currency" text DEFAULT 'KM' NOT NULL,
          "award_date" timestamp NOT NULL,
          "competitor_offers_count" integer,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "tender_competitors" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text NOT NULL REFERENCES "tenders"("id") ON DELETE CASCADE,
          "company_name" text NOT NULL,
          "offered_price_km" double precision NOT NULL,
          "is_winner" boolean DEFAULT false NOT NULL,
          "rank" integer,
          "status" text,
          "rejection_reason" text,
          "source_url" text,
          "scraped_at" timestamp DEFAULT now() NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "tender_related" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text NOT NULL REFERENCES "tenders"("id") ON DELETE CASCADE,
          "ejn_broj" text NOT NULL,
          "type" text NOT NULL,
          "title" text NOT NULL,
          "date" timestamp NOT NULL,
          "processed" boolean DEFAULT false NOT NULL,
          "is_new" boolean DEFAULT true NOT NULL,
          "detected_at" timestamp DEFAULT now() NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "tender_calculations" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text NOT NULL REFERENCES "tenders"("id") ON DELETE CASCADE,
          "guarantee_amount" double precision,
          "validity_days" integer,
          "duration" text,
          "subject" text,
          "base_premium" double precision,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "tender_calculations_tender_id_unique" UNIQUE("tender_id")
        );

        CREATE TABLE IF NOT EXISTS "tender_notifications" (
          "id" text PRIMARY KEY NOT NULL,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "tender_id" text NOT NULL REFERENCES "tenders"("id") ON DELETE CASCADE,
          "type" text NOT NULL,
          "message" text NOT NULL,
          "is_read" boolean DEFAULT false NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "tender_alerts" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text NOT NULL REFERENCES "tenders"("id") ON DELETE CASCADE,
          "type" text NOT NULL,
          "severity" text DEFAULT 'info' NOT NULL,
          "message" text NOT NULL,
          "details" jsonb,
          "is_read" boolean DEFAULT false NOT NULL,
          "is_resolved" boolean DEFAULT false NOT NULL,
          "resolved_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "resolved_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "tender_parsed_data" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text NOT NULL UNIQUE REFERENCES "tenders"("id") ON DELETE CASCADE,
          "raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
          "parsing_status" text DEFAULT 'PENDING' NOT NULL,
          "parsing_error" text,
          "parsed_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "pipeline_runs" (
          "id" text PRIMARY KEY NOT NULL,
          "tender_id" text REFERENCES "tenders"("id") ON DELETE CASCADE,
          "batch_id" text,
          "status" text DEFAULT 'running' NOT NULL,
          "steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
          "duration_ms" integer,
          "triggered_by" text DEFAULT 'cron' NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "completed_at" timestamp
        );

        ALTER TABLE "contracting_authority_profiles" ADD COLUMN IF NOT EXISTS "vrsta" text;
        ALTER TABLE "contracting_authority_profiles" ADD COLUMN IF NOT EXISTS "last_scraped_at" timestamp;

        ALTER TABLE "historical_awards" ADD COLUMN IF NOT EXISTS "contracting_authority_id" text REFERENCES "contracting_authority_profiles"("id") ON DELETE CASCADE;
        ALTER TABLE "historical_awards" ADD COLUMN IF NOT EXISTS "cpv_kod" text;
        ALTER TABLE "historical_awards" ADD COLUMN IF NOT EXISTS "ejn_broj" text;
        ALTER TABLE "historical_awards" ADD COLUMN IF NOT EXISTS "estimated_value" double precision;
        ALTER TABLE "historical_awards" ADD COLUMN IF NOT EXISTS "discount_pct" double precision;

        CREATE TABLE IF NOT EXISTS "urz_decisions" (
          "id" text PRIMARY KEY NOT NULL,
          "case_number" text UNIQUE NOT NULL,
          "contracting_auth" text NOT NULL,
          "procedure_name" text NOT NULL,
          "appellant" text NOT NULL,
          "outcome" text NOT NULL,
          "outcome_label" text NOT NULL,
          "legal_basis" text NOT NULL,
          "sporni_uslov" text NOT NULL,
          "summary" text NOT NULL,
          "category" text DEFAULT 'Osiguranje' NOT NULL,
          "decision_date" timestamp NOT NULL,
          "ejn_broj" text,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `);
      console.log("[DATABASE] Applied custom high-value feature migrations!");
      } catch (featureErr) {
        console.warn("[DATABASE] Custom feature migrations notice:", featureErr);
      }
    } else {
      console.error("[DATABASE] Could not locate the SQL migration file. Tables were not created.");
    }
  } catch (err) {
    console.error("[DATABASE] Failed to initialize in-memory database schema:", err);
  }
}

// Additive migrations must also run when a packaged PGlite database already
// contains the base tables. That is the normal Render snapshot path.
if (pool || client) {
  try {
    for (const statement of workspaceMigration.split(";").filter(part => part.trim())) {
      try {
        if (pool) {
          await db.execute(sql.raw(statement));
        } else if (client) {
          await client.exec(statement);
        }
      } catch {
        // Ignore idempotent DDL warnings (table/index/column already exists)
      }
    }
  } catch (migErr) {
    console.warn("[DATABASE] Note on workspace migrations:", migErr);
  }
}

try {
  const docAlterations = [
    `CREATE TABLE IF NOT EXISTS "pipeline_runs" (
      "id" text PRIMARY KEY NOT NULL,
      "tender_id" text REFERENCES "tenders"("id") ON DELETE CASCADE,
      "batch_id" text,
      "status" text NOT NULL DEFAULT 'running',
      "steps" jsonb NOT NULL DEFAULT '[]',
      "errors" jsonb NOT NULL DEFAULT '[]',
      "duration_ms" integer,
      "triggered_by" text NOT NULL DEFAULT 'cron',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "completed_at" timestamp
    );`,
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "text_pages" jsonb NOT NULL DEFAULT \'[]\';',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_metadata" jsonb NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_hash" text;',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "logical_key" text;',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "previous_document_id" text;',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "superseded_by" text;',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "batch_id" text;',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT \'running\';',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT \'[]\';',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "errors" jsonb NOT NULL DEFAULT \'[]\';',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "triggered_by" text NOT NULL DEFAULT \'cron\';',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();',
    'ALTER TABLE "pipeline_runs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;'
  ];
  for (const stmt of docAlterations) {
    try {
      if (pool) {
        await db.execute(sql.raw(stmt));
      } else if (client) {
        await client.exec(stmt);
      }
    } catch {}
  }
} catch {}

export { pool, db, sql };
export * from "./schema";
