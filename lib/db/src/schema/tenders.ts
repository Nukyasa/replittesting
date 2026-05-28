import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  boolean,
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
  deadline: timestamp("deadline").notNull(),
  tenderType: text("tender_type").notNull(),
  entity: text("entity").notNull(),
  status: text("status").notNull().default("open"),
  sourceUrl: text("source_url").notNull(),
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
  parsedText: text("parsed_text"),
  fileSize: integer("file_size"),
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

export const insertTenderSchema = createInsertSchema(tendersTable);
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
