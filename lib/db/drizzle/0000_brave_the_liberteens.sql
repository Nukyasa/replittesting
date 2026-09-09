CREATE TABLE "ai_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"tender_id" text NOT NULL,
	"summary" text NOT NULL,
	"key_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"eligibility_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_workload" text NOT NULL,
	"suggested_approach" text NOT NULL,
	"relevance_score" double precision DEFAULT 0 NOT NULL,
	"relevance_tags" text[] DEFAULT '{}' NOT NULL,
	"competition_level" text NOT NULL,
	"success_probability" double precision DEFAULT 0 NOT NULL,
	"insurance_relevance" text NOT NULL,
	"required_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participation_conditions" jsonb DEFAULT 'null'::jsonb,
	"required_declarations" jsonb DEFAULT 'null'::jsonb,
	"award_analysis" text,
	"guarantee_info" text,
	"estimated_prep_time" text,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	"analysis_version" text DEFAULT '1' NOT NULL,
	CONSTRAINT "ai_analysis_tender_id_unique" UNIQUE("tender_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tender_id" text NOT NULL,
	"name" text NOT NULL,
	"original_url" text NOT NULL,
	"local_path" text,
	"file_type" text NOT NULL,
	"mime_type" text,
	"parsed_text" text,
	"extracted_text_preview" text,
	"key_data" jsonb,
	"related_ejn_broj" text,
	"file_size" integer,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tender_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"tender_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"triggered_by" text DEFAULT 'cron' NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"tenders_found" integer DEFAULT 0 NOT NULL,
	"tenders_new" integer DEFAULT 0 NOT NULL,
	"tenders_updated" integer DEFAULT 0 NOT NULL,
	"docs_downloaded" integer DEFAULT 0 NOT NULL,
	"errors" text,
	"status" text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"tender_id" text NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"contracting_auth" text NOT NULL,
	"category" text NOT NULL,
	"cpv_codes" text[] DEFAULT '{}' NOT NULL,
	"estimated_value" double precision,
	"currency" text DEFAULT 'KM' NOT NULL,
	"publication_date" timestamp NOT NULL,
	"deadline" timestamp NOT NULL,
	"questions_deadline" timestamp,
	"tender_type" text NOT NULL,
	"entity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"status_name" text,
	"source_url" text NOT NULL,
	"has_e_auction" boolean DEFAULT false NOT NULL,
	"award_criteria" text,
	"award_criteria_details" text,
	"guarantee_amount" double precision,
	"guarantee_type" text,
	"tender_preparation_cost" double precision,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenders_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "user_tenders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tender_id" text NOT NULL,
	"status" text DEFAULT 'watching' NOT NULL,
	"assigned_to" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"internal_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"department" text,
	"company_tags" text[] DEFAULT '{}' NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_changes" ADD CONSTRAINT "tender_changes_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenders" ADD CONSTRAINT "user_tenders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tenders" ADD CONSTRAINT "user_tenders_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;