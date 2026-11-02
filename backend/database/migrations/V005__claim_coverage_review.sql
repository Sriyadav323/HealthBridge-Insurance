-- Narrow permission extension for an explicit historical-claim coverage review.
-- No coverage is inferred and no existing claim or spending value is changed.
\getenv app_user DB_USERNAME
GRANT UPDATE(coverage_snapshot,insurance_plan_id,benefit_year) ON claims TO :"app_user";
