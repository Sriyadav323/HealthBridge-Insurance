-- Additive, repeatable. Historical claims are preserved and are not counted again.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS allowed_amount NUMERIC(12,2) CHECK(allowed_amount>=0);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS deductible_applied INTEGER NOT NULL DEFAULT 0 CHECK(deductible_applied>=0);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS oop_applied INTEGER NOT NULL DEFAULT 0 CHECK(oop_applied>=0);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurance_plan_id BIGINT REFERENCES insurance_plans(id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS benefit_year INTEGER;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS coverage_snapshot JSONB;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS review_notes VARCHAR(2000);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(30) REFERENCES member_accounts(member_id);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_claims_admin_submitted ON claims(submitted_date DESC,id DESC);
\getenv app_user DB_USERNAME
GRANT SELECT,INSERT ON claims TO :"app_user";
GRANT USAGE ON SEQUENCE claims_id_seq TO :"app_user";
GRANT UPDATE(claim_status,allowed_amount,insurance_paid,member_responsibility,deductible_applied,oop_applied,review_notes,reviewed_at,reviewed_by,version) ON claims TO :"app_user";
