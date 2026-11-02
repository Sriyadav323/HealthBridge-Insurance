CREATE TABLE IF NOT EXISTS members (
    id BIGSERIAL PRIMARY KEY,
    member_id VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    plan_name VARCHAR(150) NOT NULL,
    plan_type VARCHAR(30) NOT NULL,
    coverage_status VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id BIGSERIAL PRIMARY KEY,
    claim_number VARCHAR(40) UNIQUE NOT NULL,
    member_id VARCHAR(30) NOT NULL
        REFERENCES members(member_id),
    provider_name VARCHAR(150) NOT NULL,
    service_date DATE NOT NULL,
    claim_status VARCHAR(40) NOT NULL,
    billed_amount NUMERIC(12,2) NOT NULL,
    insurance_paid NUMERIC(12,2) NOT NULL,
    member_responsibility NUMERIC(12,2) NOT NULL
);

INSERT INTO members (
    member_id,
    full_name,
    email,
    plan_name,
    plan_type,
    coverage_status
)
VALUES (
    'HB100245',
    'John Smith',
    'john.smith@example.com',
    'HealthBridge Gold PPO',
    'PPO',
    'Active'
)
ON CONFLICT (member_id) DO NOTHING;

INSERT INTO claims (
    claim_number,
    member_id,
    provider_name,
    service_date,
    claim_status,
    billed_amount,
    insurance_paid,
    member_responsibility
)
VALUES
('CLM1001', 'HB100245', 'City Medical Center',
 '2026-09-12', 'Approved', 450.00, 350.00, 100.00),

('CLM1002', 'HB100245', 'Northside Family Clinic',
 '2026-08-21', 'Approved', 180.00, 155.00, 25.00),

('CLM1003', 'HB100245', 'Central Imaging Center',
 '2026-10-03', 'Pending', 1200.00, 0.00, 0.00),

('CLM1004', 'HB100245', 'Westside Urgent Care',
 '2026-07-16', 'Approved', 300.00, 225.00, 75.00),

('CLM1005', 'HB100245', 'Downtown Specialty Clinic',
 '2026-06-10', 'Denied', 250.00, 0.00, 250.00)
ON CONFLICT (claim_number) DO NOTHING;
