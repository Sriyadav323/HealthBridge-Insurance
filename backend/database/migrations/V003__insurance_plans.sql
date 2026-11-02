-- Additive, repeatable. Run as schema owner before starting the updated backend.
CREATE TABLE IF NOT EXISTS insurance_plans (
 id BIGSERIAL PRIMARY KEY,
 plan_name VARCHAR(150) NOT NULL CHECK(length(trim(plan_name))>0),
 plan_type VARCHAR(3) NOT NULL CHECK(plan_type IN ('PPO','HMO','EPO')),
 effective_from DATE NOT NULL,
 effective_to DATE NOT NULL CHECK(effective_to>=effective_from),
 retired BOOLEAN NOT NULL DEFAULT false,
 deductible_total INTEGER NOT NULL CHECK(deductible_total>=0),
 oop_maximum INTEGER NOT NULL CHECK(oop_maximum>=deductible_total),
 copay_primary_care INTEGER NOT NULL CHECK(copay_primary_care>=0),
 copay_specialist INTEGER NOT NULL CHECK(copay_specialist>=0),
 copay_urgent_care INTEGER NOT NULL CHECK(copay_urgent_care>=0),
 coverage JSONB NOT NULL CHECK(jsonb_typeof(coverage)='array'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(plan_name,plan_type,effective_from)
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS insurance_plan_id BIGINT REFERENCES insurance_plans(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS coverage_effective_from DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS coverage_effective_to DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS benefit_year INTEGER;
-- Do not infer shared plan terms from individual member records or overwrite historical benefits.
\getenv app_user DB_USERNAME
GRANT SELECT,INSERT ON insurance_plans TO :"app_user";
GRANT UPDATE(retired) ON insurance_plans TO :"app_user";
GRANT USAGE ON SEQUENCE insurance_plans_id_seq TO :"app_user";
GRANT UPDATE(insurance_plan_id,coverage_effective_from,coverage_effective_to,benefit_year,benefits_review_required) ON members TO :"app_user";
GRANT SELECT,INSERT,UPDATE ON member_benefits TO :"app_user";
GRANT SELECT,INSERT,DELETE ON coverage_items TO :"app_user";
