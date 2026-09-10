import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Initialize the database with schema and full snapshot during the build, which has more RAM.
const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const { PGlite } = require("@electric-sql/pglite");
const dataDir = process.env.PGLITE_DATA_DIR || fileURLToPath(new URL("../.pglite-db", import.meta.url));

if (!process.env.DATABASE_URL) {
  console.log("Initializing Render database at:", dataDir);
  const client = new PGlite(dataDir, { initialMemory: 128 * 1024 * 1024 });
  try {
    await client.waitReady;

    // 1. Run migrations if tables don't exist
    const checkRes = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'tenders' LIMIT 1;").catch(() => ({ rows: [] }));
    if (!checkRes.rows || checkRes.rows.length === 0) {
      console.log("Executing initial SQL migrations...");
      const sqlMigrationPath = fileURLToPath(new URL("../lib/db/drizzle/0000_brave_the_liberteens.sql", import.meta.url));
      if (fs.existsSync(sqlMigrationPath)) {
        const sqlContent = fs.readFileSync(sqlMigrationPath, "utf-8");
        await client.exec(sqlContent);
      }
    }

    // 2. Run feature alterations
    await client.exec(`
      ALTER TABLE "tenders" ALTER COLUMN "deadline" DROP NOT NULL;
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
        "contracting_authority_id" text REFERENCES "contracting_authority_profiles"("id") ON DELETE CASCADE,
        "contracting_auth" text NOT NULL,
        "procedure_name" text NOT NULL,
        "winner_name" text NOT NULL,
        "winning_bid_amount" double precision NOT NULL,
        "estimated_value" double precision,
        "discount_pct" double precision,
        "currency" text DEFAULT 'KM' NOT NULL,
        "award_date" timestamp NOT NULL,
        "competitor_offers_count" integer,
        "cpv_kod" text,
        "ejn_broj" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "urz_decisions" (
        "id" text PRIMARY KEY NOT NULL,
        "case_number" text UNIQUE NOT NULL,
        "decision_date" timestamp NOT NULL,
        "contracting_auth" text NOT NULL,
        "procedure_name" text NOT NULL,
        "appellant" text NOT NULL,
        "outcome" text NOT NULL,
        "outcome_label" text NOT NULL,
        "sporni_uslov" text NOT NULL,
        "legal_basis" text NOT NULL,
        "summary" text NOT NULL,
        "ejn_broj" text,
        "category" text DEFAULT 'Osiguranje' NOT NULL,
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
    `);

    // 3. Populate snapshot if tenders count is low
    const countRes = await client.query("SELECT count(*) FROM tenders");
    const currentCount = parseInt(countRes.rows[0]?.count || "0", 10);
    console.log(`Current tenders in database: ${currentCount}`);

    const snapshotFile = fileURLToPath(new URL("../artifacts/api-server/src/seed-data/snapshot.json.gz", import.meta.url));
    if (currentCount < 100 && fs.existsSync(snapshotFile)) {
      console.log("Loading snapshot from:", snapshotFile);
      const buffer = fs.readFileSync(snapshotFile);
      const decompressed = zlib.gunzipSync(buffer);
      const data = JSON.parse(decompressed.toString("utf-8"));

      // Authorities
      if (Array.isArray(data.authorities) && data.authorities.length > 0) {
        console.log(`Importing ${data.authorities.length} authority profiles...`);
        for (const a of data.authorities) {
          await client.query(
            `INSERT INTO contracting_authority_profiles (id, ejn_id, name, level, municipality, vrsta, last_scraped_at, last_updated, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (ejn_id) DO NOTHING`,
            [a.id, a.ejnId || a.ejn_id, a.name, a.level || null, a.municipality || null, a.vrsta || null, a.lastScrapedAt || a.last_scraped_at ? new Date(a.lastScrapedAt || a.last_scraped_at) : null, a.lastUpdated || a.last_updated ? new Date(a.lastUpdated || a.last_updated) : new Date(), a.createdAt || a.created_at ? new Date(a.createdAt || a.created_at) : new Date()]
          );
        }
      }

      // Tenders
      if (Array.isArray(data.tenders) && data.tenders.length > 0) {
        console.log(`Importing ${data.tenders.length} tenders in batches...`);
        const batchSize = 100;
        for (let i = 0; i < data.tenders.length; i += batchSize) {
          const chunk = data.tenders.slice(i, i + batchSize);
          for (const t of chunk) {
            await client.query(
              `INSERT INTO tenders (id, external_id, source, title, description, contracting_auth, category, cpv_codes, estimated_value, currency, publication_date, deadline, tender_type, entity, status, source_url, raw_data)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
               ON CONFLICT (id) DO NOTHING`,
              [
                t.id,
                t.externalId || t.external_id,
                t.source,
                t.title,
                t.description,
                t.contractingAuth || t.contracting_auth,
                t.category,
                t.cpvCodes || t.cpv_codes || [],
                t.estimatedValue || t.estimated_value,
                t.currency || "KM",
                t.publicationDate || t.publication_date ? new Date(t.publicationDate || t.publication_date) : new Date(),
                t.deadline ? new Date(t.deadline) : null,
                t.tenderType || t.tender_type || "open",
                t.entity || "FBiH",
                t.status || "open",
                t.sourceUrl || t.source_url || "https://open.ejn.gov.ba",
                JSON.stringify(t.rawData || t.raw_data || {}),
              ]
            );
          }
        }
      }

      // AI Analyses
      if (Array.isArray(data.analyses) && data.analyses.length > 0) {
        console.log(`Importing ${data.analyses.length} AI analyses...`);
        for (const a of data.analyses) {
          await client.query(
            `INSERT INTO ai_analysis (id, tender_id, summary, key_requirements, eligibility_criteria, risks, opportunities, red_flags, estimated_workload, suggested_approach, relevance_score, relevance_tags, competition_level, success_probability, insurance_relevance, required_docs, participation_conditions, required_declarations, award_analysis, guarantee_info, estimated_prep_time, analyzed_at, analysis_version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
             ON CONFLICT (tender_id) DO NOTHING`,
            [
              a.id, a.tenderId || a.tender_id, a.summary,
              JSON.stringify(a.keyRequirements || a.key_requirements || []),
              JSON.stringify(a.eligibilityCriteria || a.eligibility_criteria || []),
              JSON.stringify(a.risks || []),
              JSON.stringify(a.opportunities || []),
              JSON.stringify(a.redFlags || a.red_flags || []),
              a.estimatedWorkload || a.estimated_workload || "",
              a.suggestedApproach || a.suggested_approach || "",
              a.relevanceScore || a.relevance_score || 0,
              a.relevanceTags || a.relevance_tags || [],
              a.competitionLevel || a.competition_level || "medium",
              a.successProbability || a.success_probability || 0,
              a.insuranceRelevance || a.insurance_relevance || "",
              JSON.stringify(a.requiredDocs || a.required_docs || []),
              a.participationConditions || a.participation_conditions ? JSON.stringify(a.participationConditions || a.participation_conditions) : null,
              a.requiredDeclarations || a.required_declarations ? JSON.stringify(a.requiredDeclarations || a.required_declarations) : null,
              a.awardAnalysis || a.award_analysis || null,
              a.guaranteeInfo || a.guarantee_info || null,
              a.estimatedPrepTime || a.estimated_prep_time || null,
              a.analyzedAt || a.analyzed_at ? new Date(a.analyzedAt || a.analyzed_at) : new Date(),
              a.analysisVersion || a.analysis_version || "1",
            ]
          );
        }
      }

      // Awards
      if (Array.isArray(data.awards) && data.awards.length > 0) {
        console.log(`Importing ${data.awards.length} historical awards...`);
        for (const aw of data.awards) {
          await client.query(
            `INSERT INTO historical_awards (id, tender_id, contracting_authority_id, contracting_auth, procedure_name, winner_name, winning_bid_amount, estimated_value, discount_pct, currency, award_date, competitor_offers_count, cpv_kod, ejn_broj, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO NOTHING`,
            [
              aw.id, aw.tenderId || aw.tender_id || null, aw.contractingAuthorityId || aw.contracting_authority_id || null,
              aw.contractingAuth || aw.contracting_auth, aw.procedureName || aw.procedure_name,
              aw.winnerName || aw.winner_name, aw.winningBidAmount || aw.winning_bid_amount,
              aw.estimatedValue || aw.estimated_value || null, aw.discountPct || aw.discount_pct || null,
              aw.currency || "KM", aw.awardDate || aw.award_date ? new Date(aw.awardDate || aw.award_date) : new Date(),
              aw.competitorOffersCount || aw.competitor_offers_count || null,
              aw.cpvKod || aw.cpv_kod || null, aw.ejnBroj || aw.ejn_broj || null,
              aw.createdAt || aw.created_at ? new Date(aw.createdAt || aw.created_at) : new Date(),
            ]
          );
        }
      }

      // Decisions
      if (Array.isArray(data.decisions) && data.decisions.length > 0) {
        console.log(`Importing ${data.decisions.length} URŽ decisions...`);
        for (const d of data.decisions) {
          await client.query(
            `INSERT INTO urz_decisions (id, case_number, decision_date, contracting_auth, procedure_name, appellant, outcome, outcome_label, sporni_uslov, legal_basis, summary, ejn_broj, category, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (case_number) DO NOTHING`,
            [
              d.id, d.caseNumber || d.case_number, d.decisionDate || d.decision_date ? new Date(d.decisionDate || d.decision_date) : new Date(),
              d.contractingAuth || d.contracting_auth, d.procedureName || d.procedure_name,
              d.appellant, d.outcome, d.outcomeLabel || d.outcome_label,
              d.sporniUslov || d.sporni_uslov, d.legalBasis || d.legal_basis,
              d.summary, d.ejnBroj || d.ejn_broj || null, d.category || "Osiguranje",
              d.createdAt || d.created_at ? new Date(d.createdAt || d.created_at) : new Date(),
            ]
          );
        }
      }

      const finalCount = await client.query("SELECT count(*) FROM tenders");
      console.log(`Snapshot imported successfully! Total tenders in Render database: ${finalCount.rows[0]?.count}`);
    }
  } finally {
    await client.close();
  }
}
