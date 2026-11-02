CREATE TABLE IF NOT EXISTS member_benefits (
    member_id VARCHAR(30) PRIMARY KEY
        REFERENCES members(member_id),
    deductible_total INTEGER NOT NULL,
    deductible_met INTEGER NOT NULL,
    oop_maximum INTEGER NOT NULL,
    oop_spent INTEGER NOT NULL,
    copay_primary_care INTEGER NOT NULL,
    copay_specialist INTEGER NOT NULL,
    copay_urgent_care INTEGER NOT NULL
);

INSERT INTO member_benefits VALUES
('HB100245', 1500, 900, 5000, 1200, 25, 50, 75)
ON CONFLICT (member_id) DO UPDATE SET
    deductible_total = EXCLUDED.deductible_total,
    deductible_met = EXCLUDED.deductible_met,
    oop_maximum = EXCLUDED.oop_maximum,
    oop_spent = EXCLUDED.oop_spent,
    copay_primary_care = EXCLUDED.copay_primary_care,
    copay_specialist = EXCLUDED.copay_specialist,
    copay_urgent_care = EXCLUDED.copay_urgent_care;

CREATE TABLE IF NOT EXISTS coverage_items (
    id VARCHAR(20) PRIMARY KEY,
    member_id VARCHAR(30) NOT NULL
        REFERENCES members(member_id),
    category VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL,
    cost VARCHAR(100) NOT NULL,
    notes TEXT,
    display_order INTEGER NOT NULL
);

INSERT INTO coverage_items
(id, member_id, category, name, status, cost, notes, display_order)
VALUES
('MC001','HB100245','Medical','Preventive Care','Covered',
 '$0 in-network','Eligible preventive services',1),
('MC002','HB100245','Medical','Specialist Visit','Covered',
 '$50 copay','In-network specialist',2),
('MC003','HB100245','Medical','Emergency Room','Covered',
 '$250 copay','Subject to plan rules',3),
('MC004','HB100245','Medical','Hospital Inpatient Stay','Covered',
 '20% after deductible','Authorization may be required',4),
('RX001','HB100245','Pharmacy','Generic Prescriptions','Covered',
 '$10 copay','Preferred network pharmacy',5),
('RX002','HB100245','Pharmacy','Preferred Brand Drugs','Covered',
 '$40 copay','Formulary restrictions may apply',6),
('RX003','HB100245','Pharmacy','Non-Formulary Drugs','Not Covered',
 'Not applicable','Coverage exception may be available',7)
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    cost = EXCLUDED.cost,
    notes = EXCLUDED.notes,
    display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS providers (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    facility VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(10) NOT NULL,
    network_status VARCHAR(40) NOT NULL,
    accepting_patients BOOLEAN NOT NULL,
    phone VARCHAR(30),
    address VARCHAR(200)
);

INSERT INTO providers
(id,name,specialty,facility,city,state,
 network_status,accepting_patients,phone,address)
VALUES
('PR001','Dr. Emily Carter','Primary Care',
 'HealthBridge Family Clinic','Charlotte','NC',
 'In Network',true,'555-0101','100 Wellness Drive'),
('PR002','Dr. Michael Johnson','Cardiology',
 'Carolina Heart Center','Raleigh','NC',
 'In Network',true,'555-0102','200 Heart Avenue'),
('PR003','Dr. Sarah Williams','Dermatology',
 'Skin Care Associates','Charlotte','NC',
 'In Network',false,'555-0103','300 Medical Plaza'),
('PR004','Dr. David Brown','Orthopedics',
 'Regional Orthopedic Center','Greensboro','NC',
 'Out of Network',true,'555-0104','400 Joint Street'),
('PR005','Dr. Olivia Davis','Primary Care',
 'Downtown Medical Group','Raleigh','NC',
 'In Network',true,'555-0105','500 Health Lane'),
('PR006','Dr. James Wilson','Cardiology',
 'Metro Cardiology','Charlotte','NC',
 'In Network',false,'555-0106','600 Cardiac Boulevard')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    specialty = EXCLUDED.specialty,
    facility = EXCLUDED.facility,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    network_status = EXCLUDED.network_status,
    accepting_patients = EXCLUDED.accepting_patients,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address;
