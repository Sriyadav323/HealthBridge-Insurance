ALTER TABLE claims
ADD COLUMN IF NOT EXISTS service VARCHAR(150),
ADD COLUMN IF NOT EXISTS submitted_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE claims SET
    service = CASE claim_number
        WHEN 'CLM1001' THEN 'Primary Care Visit'
        WHEN 'CLM1002' THEN 'Specialist Consultation'
        WHEN 'CLM1003' THEN 'Diagnostic Imaging'
        WHEN 'CLM1004' THEN 'Urgent Care Visit'
        WHEN 'CLM1005' THEN 'Blood Test'
    END,
    submitted_date = service_date + 2,
    notes = CASE claim_status
        WHEN 'Approved' THEN 'Claim processed successfully.'
        WHEN 'Pending' THEN 'Claim is under review.'
        WHEN 'Denied' THEN 'Coverage review required. Check your EOB.'
    END
WHERE member_id = 'HB100245';
