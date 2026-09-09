// Additive and idempotent for both local PGlite and PostgreSQL.
export const workspaceMigration = `
CREATE TABLE IF NOT EXISTS tender_workspaces (
  tender_id text PRIMARY KEY REFERENCES tenders(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','go','no_go')),
  reason text NOT NULL DEFAULT '',
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  internal_deadline timestamp,
  version integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tender_requirements (
  id text PRIMARY KEY,
  tender_id text NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_id text REFERENCES documents(id) ON DELETE SET NULL,
  source_quote text NOT NULL DEFAULT '',
  source_key text,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  due_at timestamp,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  proof text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(tender_id, source_key)
);
CREATE INDEX IF NOT EXISTS tender_requirements_tender_idx ON tender_requirements(tender_id);
CREATE INDEX IF NOT EXISTS tender_requirements_owner_idx ON tender_requirements(owner_id, due_at);
CREATE TABLE IF NOT EXISTS tender_work_events (
  id text PRIMARY KEY,
  tender_id text NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tender_work_events_tender_idx ON tender_work_events(tender_id, created_at);
ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS proof_document_id text REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS proof_valid_until date;
ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS source_page integer;
ALTER TABLE user_tenders ADD COLUMN IF NOT EXISTS offer_amount double precision;
ALTER TABLE tender_workspaces ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'decision';
ALTER TABLE tender_workspaces ADD COLUMN IF NOT EXISTS offer_amount double precision;
ALTER TABLE tender_workspaces ADD COLUMN IF NOT EXISTS walkaway_price double precision;
ALTER TABLE tender_workspaces ADD COLUMN IF NOT EXISTS pricing_strategy text;
ALTER TABLE tender_workspaces ADD COLUMN IF NOT EXISTS margin_percent double precision;
ALTER TABLE user_tenders ADD COLUMN IF NOT EXISTS outcome_note text;
ALTER TABLE user_tenders ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamp;
CREATE TABLE IF NOT EXISTS tender_final_reviews (
  id text PRIMARY KEY,
  tender_id text NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  reviewer_id text REFERENCES users(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  note text NOT NULL,
  reviewed_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ejn_contract_history (
  contract_id integer PRIMARY KEY,
  authority_id integer NOT NULL,
  procedure_id integer,
  procedure_name text NOT NULL,
  procedure_number text,
  winner_names jsonb NOT NULL DEFAULT '[]',
  amount double precision,
  contract_date timestamp,
  raw_data jsonb NOT NULL,
  fetched_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ejn_contract_history_authority_idx ON ejn_contract_history(authority_id,contract_date);
CREATE TABLE IF NOT EXISTS ejn_history_sync (
  authority_id integer PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  before_id integer,
  has_more boolean NOT NULL DEFAULT true,
  last_run timestamp,
  error text
);
ALTER TABLE ejn_contract_history ADD COLUMN IF NOT EXISTS source_entity text NOT NULL DEFAULT 'LotContracts';
ALTER TABLE ejn_contract_history DROP CONSTRAINT IF EXISTS ejn_contract_history_pkey;
ALTER TABLE ejn_contract_history ADD PRIMARY KEY(contract_id,source_entity);
ALTER TABLE ejn_history_sync ADD COLUMN IF NOT EXISTS before_award_id integer;
ALTER TABLE ejn_history_sync ADD COLUMN IF NOT EXISTS lots_more boolean NOT NULL DEFAULT true;
ALTER TABLE ejn_history_sync ADD COLUMN IF NOT EXISTS awards_more boolean NOT NULL DEFAULT true;
UPDATE ejn_history_sync SET has_more=lots_more OR awards_more;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_pages jsonb NOT NULL DEFAULT '[]';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS logical_key text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS previous_document_id text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS superseded_by text;
CREATE INDEX IF NOT EXISTS documents_tender_logical_key_idx ON documents(tender_id,logical_key);
CREATE TABLE IF NOT EXISTS company_profile (
  id text PRIMARY KEY, name text NOT NULL DEFAULT '', registration_number text NOT NULL DEFAULT '',
  capabilities text[] NOT NULL DEFAULT '{}', cpv_codes text[] NOT NULL DEFAULT '{}', keywords text[] NOT NULL DEFAULT '{}', excluded_keywords text[] NOT NULL DEFAULT '{}',
  updated_by text REFERENCES users(id) ON DELETE SET NULL, updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_evidence (
  id text PRIMARY KEY, title text NOT NULL, evidence_type text NOT NULL DEFAULT 'other', issuer text NOT NULL DEFAULT '', valid_until date,
  tags text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'draft', local_path text NOT NULL, mime_type text, file_size integer,
  parsed_text text, text_pages jsonb NOT NULL DEFAULT '[]', extraction_metadata jsonb NOT NULL DEFAULT '{}', content_hash text NOT NULL,
  uploaded_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS company_evidence_hash_idx ON company_evidence(content_hash);
CREATE TABLE IF NOT EXISTS market_profiles (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL,
  cpv_codes text[] NOT NULL DEFAULT '{}', keywords text[] NOT NULL DEFAULT '{}', authority_names text[] NOT NULL DEFAULT '{}',
  min_value double precision, max_value double precision, open_only boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_profiles_user_idx ON market_profiles(user_id,updated_at);
ALTER TABLE historical_awards ADD COLUMN IF NOT EXISTS estimated_value double precision;
ALTER TABLE historical_awards ADD COLUMN IF NOT EXISTS discount_pct double precision;
CREATE TABLE IF NOT EXISTS urz_decisions (
  id text PRIMARY KEY,
  case_number text NOT NULL UNIQUE,
  decision_date timestamp NOT NULL,
  contracting_auth text NOT NULL,
  procedure_name text NOT NULL,
  appellant text NOT NULL,
  outcome text NOT NULL,
  outcome_label text NOT NULL,
  sporni_uslov text NOT NULL,
  legal_basis text NOT NULL,
  summary text NOT NULL,
  ejn_broj text,
  category text NOT NULL DEFAULT 'Osiguranje',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS urz_decisions_auth_idx ON urz_decisions(contracting_auth);
CREATE INDEX IF NOT EXISTS urz_decisions_outcome_idx ON urz_decisions(outcome);
`;
