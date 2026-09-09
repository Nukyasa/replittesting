import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tendersTable = pgTable("tenders", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  contractingAuth: text("contracting_auth").notNull(),
  category: text("category").notNull(),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  estimatedValue: doublePrecision("estimated_value"),
  currency: text("currency").notNull().default("KM"),
  publicationDate: timestamp("publication_date").notNull(),
  deadline: timestamp("deadline"),
  questionsDeadline: timestamp("questions_deadline"),
  tenderType: text("tender_type").notNull(),
  entity: text("entity").notNull(),
  status: text("status").notNull().default("open"),
  statusName: text("status_name"),
  sourceUrl: text("source_url").notNull(),
  hasEAuction: boolean("has_e_auction").notNull().default(false),
  awardCriteria: text("award_criteria"),
  awardCriteriaDetails: text("award_criteria_details"),
  guaranteeAmount: doublePrecision("guarantee_amount"),
  guaranteeType: text("guarantee_type"),
  tenderPreparationCost: doublePrecision("tender_preparation_cost"),
  rawData: jsonb("raw_data"),
  winProbabilityPct: doublePrecision("win_probability_pct"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiAnalysisTable = pgTable("ai_analysis", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().unique().references(() => tendersTable.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  keyRequirements: jsonb("key_requirements").notNull().default([]),
  eligibilityCriteria: jsonb("eligibility_criteria").notNull().default([]),
  risks: jsonb("risks").notNull().default([]),
  opportunities: jsonb("opportunities").notNull().default([]),
  redFlags: jsonb("red_flags").notNull().default([]),
  estimatedWorkload: text("estimated_workload").notNull(),
  suggestedApproach: text("suggested_approach").notNull(),
  relevanceScore: doublePrecision("relevance_score").notNull().default(0),
  relevanceTags: text("relevance_tags").array().notNull().default([]),
  competitionLevel: text("competition_level").notNull(),
  successProbability: doublePrecision("success_probability").notNull().default(0),
  insuranceRelevance: text("insurance_relevance").notNull(),
  requiredDocs: jsonb("required_docs").notNull().default([]),
  participationConditions: jsonb("participation_conditions").default(null),
  requiredDeclarations: jsonb("required_declarations").default(null),
  awardAnalysis: text("award_analysis"),
  guaranteeInfo: text("guarantee_info"),
  estimatedPrepTime: text("estimated_prep_time"),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  analysisVersion: text("analysis_version").notNull().default("1"),
});

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  originalUrl: text("original_url").notNull(),
  localPath: text("local_path"),
  fileType: text("file_type").notNull(),
  mimeType: text("mime_type"),
  parsedText: text("parsed_text"),
  extractedTextPreview: text("extracted_text_preview"),
  keyData: jsonb("key_data"),
  textPages: jsonb("text_pages").notNull().default([]),
  extractionMetadata: jsonb("extraction_metadata").notNull().default({}),
  contentHash: text("content_hash"),
  logicalKey: text("logical_key"),
  version: integer("version").notNull().default(1),
  previousDocumentId: text("previous_document_id"),
  supersededBy: text("superseded_by"),
  relatedEjnBroj: text("related_ejn_broj"),
  fileSize: integer("file_size"),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
  companyTags: text("company_tags").array().notNull().default([]),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userTendersTable = pgTable("user_tenders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("watching"),
  assignedTo: text("assigned_to"),
  priority: text("priority").notNull().default("medium"),
  internalDeadline: timestamp("internal_deadline"),
  offerAmount: doublePrecision("offer_amount"),
  outcomeNote: text("outcome_note"),
  outcomeRecordedAt: timestamp("outcome_recorded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notesTable = pgTable("notes", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  tenderId: text("tender_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scraperLogsTable = pgTable("scraper_logs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  triggeredBy: text("triggered_by").notNull().default("cron"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  tendersFound: integer("tenders_found").notNull().default(0),
  tendersNew: integer("tenders_new").notNull().default(0),
  tendersUpdated: integer("tenders_updated").notNull().default(0),
  docsDownloaded: integer("docs_downloaded").notNull().default(0),
  errors: text("errors"),
  status: text("status").notNull().default("running"),
});

export const tenderParsedDataTable = pgTable("tender_parsed_data", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().unique().references(() => tendersTable.id, { onDelete: "cascade" }),
  rawJson: jsonb("raw_json").notNull().default({}),
  parsingStatus: text("parsing_status").notNull().default("PENDING"),
  parsingError: text("parsing_error"),
  parsedAt: timestamp("parsed_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenderChangesTable = pgTable("tender_changes", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  notified: boolean("notified").notNull().default(false),
});

export const tenderAlertsTable = pgTable("tender_alerts", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("info"),
  message: text("message").notNull(),
  details: jsonb("details"),
  isRead: boolean("is_read").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedBy: text("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pipelineRunsTable = pgTable("pipeline_runs", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").references(() => tendersTable.id, { onDelete: "cascade" }),
  batchId: text("batch_id"),
  status: text("status").notNull().default("running"),
  steps: jsonb("steps").notNull().default([]),
  errors: jsonb("errors").notNull().default([]),
  durationMs: integer("duration_ms"),
  triggeredBy: text("triggered_by").notNull().default("cron"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const historicalAwardsTable = pgTable("historical_awards", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").references(() => tendersTable.id, { onDelete: "set null" }),
  contractingAuthorityId: text("contracting_authority_id").references(() => contractingAuthorityProfilesTable.id, { onDelete: "cascade" }),
  contractingAuth: text("contracting_auth").notNull(),
  procedureName: text("procedure_name").notNull(),
  winnerName: text("winner_name").notNull(),
  winningBidAmount: doublePrecision("winning_bid_amount").notNull(),
  estimatedValue: doublePrecision("estimated_value"),
  discountPct: doublePrecision("discount_pct"),
  currency: text("currency").notNull().default("KM"),
  awardDate: timestamp("award_date").notNull(),
  competitorOffersCount: integer("competitor_offers_count"),
  cpvKod: text("cpv_kod"),
  ejnBroj: text("ejn_broj"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const urzDecisionsTable = pgTable("urz_decisions", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  contractingAuth: text("contracting_auth").notNull(),
  procedureName: text("procedure_name").notNull(),
  appellant: text("appellant").notNull(),
  outcome: text("outcome").notNull(), // USVOJENA_PONISTENJE, USVOJENA_IZMJENA_TD, ODBIJENA, ODBACENA
  outcomeLabel: text("outcome_label").notNull(),
  legalBasis: text("legal_basis").notNull(),
  sporniUslov: text("sporni_uslov").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull().default("Osiguranje"),
  decisionDate: timestamp("decision_date").notNull(),
  ejnBroj: text("ejn_broj"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const tenderCompetitorsTable = pgTable("tender_competitors", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  offeredPriceKM: doublePrecision("offered_price_km").notNull(),
  isWinner: boolean("is_winner").notNull().default(false),
  rank: integer("rank"),
  status: text("status"),
  rejectionReason: text("rejection_reason"),
  sourceUrl: text("source_url"),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenderRelatedTable = pgTable("tender_related", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  ejnBroj: text("ejn_broj").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  date: timestamp("date").notNull(),
  processed: boolean("processed").notNull().default(false),
  isNew: boolean("is_new").notNull().default(true),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenderNotificationsTable = pgTable("tender_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // NOVI_ANEKS | IZMJENA_ROKA | DODJELA_UGOVORA | POJASNJENJE
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenderCalculationsTable = pgTable("tender_calculations", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().unique().references(() => tendersTable.id, { onDelete: "cascade" }),
  guaranteeAmount: doublePrecision("guarantee_amount"),
  validityDays: integer("validity_days"),
  duration: text("duration"),
  subject: text("subject"),
  basePremium: doublePrecision("base_premium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contractingAuthorityProfilesTable = pgTable("contracting_authority_profiles", {
  id: text("id").primaryKey(),
  ejnId: text("ejn_id").notNull().unique(),
  name: text("name").notNull(),
  level: text("level"),
  municipality: text("municipality"),
  vrsta: text("vrsta"),
  lastScrapedAt: timestamp("last_scraped_at"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const digestSubscriptionsTable = pgTable("digest_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  cpvFilter: text("cpv_filter").array().notNull().default([]),
  minScore: integer("min_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenderWorkspacesTable = pgTable("tender_workspaces", {
  tenderId: text("tender_id").primaryKey().references(() => tendersTable.id, { onDelete: "cascade" }),
  decision: text("decision").notNull().default("pending"),
  reason: text("reason").notNull().default(""),
  ownerId: text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  internalDeadline: timestamp("internal_deadline"),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const tenderRequirementsTable = pgTable("tender_requirements", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  documentId: text("document_id").references(() => documentsTable.id, { onDelete: "set null" }),
  sourceQuote: text("source_quote").notNull().default(""),
  sourcePage: integer("source_page"),
  sourceKey: text("source_key"),
  proofDocumentId: text("proof_document_id").references(() => documentsTable.id, { onDelete: "set null" }),
  proofValidUntil: date("proof_valid_until"),
  ownerId: text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at"),
  status: text("status").notNull().default("todo"),
  proof: text("proof").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [uniqueIndex("tender_requirements_source_unique").on(table.tenderId, table.sourceKey)]);
export const tenderWorkEventsTable = pgTable("tender_work_events", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTenderSchema = createInsertSchema(tendersTable);
export const tenderFinalReviewsTable = pgTable("tender_final_reviews", {
  id: text("id").primaryKey(),
  tenderId: text("tender_id").notNull().references(() => tendersTable.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").references(() => usersTable.id, { onDelete: "set null" }),
  fingerprint: text("fingerprint").notNull(),
  note: text("note").notNull(),
  reviewedAt: timestamp("reviewed_at").notNull().defaultNow(),
});
export const ejnContractHistoryTable = pgTable("ejn_contract_history", {
  contractId: integer("contract_id").notNull(),
  sourceEntity: text("source_entity").notNull().default("LotContracts"),
  authorityId: integer("authority_id").notNull(),
  procedureId: integer("procedure_id"),
  procedureName: text("procedure_name").notNull(),
  procedureNumber: text("procedure_number"),
  winnerNames: jsonb("winner_names").notNull().default([]),
  amount: doublePrecision("amount"),
  contractDate: timestamp("contract_date"),
  rawData: jsonb("raw_data").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.contractId, table.sourceEntity] })]);
export const ejnHistorySyncTable = pgTable("ejn_history_sync", {
  authorityId: integer("authority_id").primaryKey(),
  status: text("status").notNull().default("pending"),
  beforeId: integer("before_id"),
  beforeAwardId: integer("before_award_id"),
  lotsMore: boolean("lots_more").notNull().default(true),
  awardsMore: boolean("awards_more").notNull().default(true),
  hasMore: boolean("has_more").notNull().default(true),
  lastRun: timestamp("last_run"),
  error: text("error"),
});
export const companyProfileTable = pgTable("company_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  registrationNumber: text("registration_number").notNull().default(""),
  capabilities: text("capabilities").array().notNull().default([]),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  excludedKeywords: text("excluded_keywords").array().notNull().default([]),
  updatedBy: text("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const companyEvidenceTable = pgTable("company_evidence", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  evidenceType: text("evidence_type").notNull().default("other"),
  issuer: text("issuer").notNull().default(""),
  validUntil: date("valid_until"),
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("draft"),
  localPath: text("local_path").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  parsedText: text("parsed_text"),
  textPages: jsonb("text_pages").notNull().default([]),
  extractionMetadata: jsonb("extraction_metadata").notNull().default({}),
  contentHash: text("content_hash").notNull(),
  uploadedBy: text("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const marketProfilesTable = pgTable("market_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cpvCodes: text("cpv_codes").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  authorityNames: text("authority_names").array().notNull().default([]),
  minValue: doublePrecision("min_value"),
  maxValue: doublePrecision("max_value"),
  openOnly: boolean("open_only").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });

export type Tender = typeof tendersTable.$inferSelect;
export type InsertTender = typeof tendersTable.$inferInsert;
export type AiAnalysis = typeof aiAnalysisTable.$inferSelect;
export type InsertAiAnalysis = typeof aiAnalysisTable.$inferInsert;
export type Document = typeof documentsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserTender = typeof userTendersTable.$inferSelect;
export type Note = typeof notesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type ScraperLog = typeof scraperLogsTable.$inferSelect;
export type TenderChange = typeof tenderChangesTable.$inferSelect;
export type TenderParsedData = typeof tenderParsedDataTable.$inferSelect;
export type HistoricalAward = typeof historicalAwardsTable.$inferSelect;
export type TenderCompetitor = typeof tenderCompetitorsTable.$inferSelect;
export type TenderRelated = typeof tenderRelatedTable.$inferSelect;
export type TenderCalculation = typeof tenderCalculationsTable.$inferSelect;
export type TenderNotification = typeof tenderNotificationsTable.$inferSelect;
export type ContractingAuthorityProfile = typeof contractingAuthorityProfilesTable.$inferSelect;
export type DigestSubscription = typeof digestSubscriptionsTable.$inferSelect;
export type UrzDecision = typeof urzDecisionsTable.$inferSelect;
