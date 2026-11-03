-- Add the two locally entered providers without overwriting existing records.
-- Apply with psql -X -v ON_ERROR_STOP=1 --single-transaction -f this-file.sql.
INSERT INTO providers (
    id, name, specialty, facility, city, state,
    network_status, accepting_patients, phone, address
)
VALUES
    ('PR007', 'Dr. Alex Smith', 'Cardiology', 'Example Heart Clinic',
     'Charlotte', 'NC', 'In Network', true, '555-0107', '700 Trail End Street'),
    ('PR008', 'Dr. Khadr Shaik', 'Cardiology', 'Example Heart Clinic',
     'Minnesota', 'MN', 'In Network', true, '555-0107', '700 Trail End Street')
ON CONFLICT (id) DO NOTHING;
