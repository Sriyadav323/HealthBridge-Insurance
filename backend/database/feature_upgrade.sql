ALTER TABLE members ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE members ADD COLUMN IF NOT EXISTS address VARCHAR(255);
CREATE TABLE IF NOT EXISTS prescriptions (
 id BIGSERIAL PRIMARY KEY,
 member_id VARCHAR(30) NOT NULL REFERENCES members(member_id),
 medication VARCHAR(150) NOT NULL,
 dosage VARCHAR(100) NOT NULL,
 pharmacy VARCHAR(150) NOT NULL,
 refill_status VARCHAR(40) NOT NULL,
 refills_remaining INTEGER NOT NULL DEFAULT 0 CHECK (refills_remaining >= 0),
 last_filled DATE
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_member ON prescriptions(member_id);
INSERT INTO prescriptions(member_id,medication,dosage,pharmacy,refill_status,refills_remaining,last_filled)
SELECT 'HB100245', 'Atorvastatin', '20 mg once daily', 'HealthBridge Pharmacy', 'Available', 2, DATE '2026-10-12'
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE member_id='HB100245' AND medication='Atorvastatin');
INSERT INTO prescriptions(member_id,medication,dosage,pharmacy,refill_status,refills_remaining,last_filled)
SELECT 'HB100245', 'Lisinopril', '10 mg once daily', 'Community Pharmacy', 'Not yet available', 0, DATE '2026-10-02'
WHERE NOT EXISTS (SELECT 1 FROM prescriptions WHERE member_id='HB100245' AND medication='Lisinopril');
