-- Fresh Compose database only. Review before applying to an existing database.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_accounts_email_lower ON member_accounts (lower(email));
CREATE INDEX IF NOT EXISTS idx_claims_member ON claims (member_id);
CREATE INDEX IF NOT EXISTS idx_coverage_member ON coverage_items (member_id, display_order);
ALTER TABLE member_benefits ADD CONSTRAINT benefits_nonnegative CHECK (
    deductible_total >= 0 AND deductible_met >= 0 AND oop_maximum >= 0 AND oop_spent >= 0
    AND copay_primary_care >= 0 AND copay_specialist >= 0 AND copay_urgent_care >= 0
);
