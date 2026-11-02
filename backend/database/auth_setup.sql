CREATE TABLE IF NOT EXISTS member_accounts (
    member_id VARCHAR(30) PRIMARY KEY REFERENCES members(member_id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);
