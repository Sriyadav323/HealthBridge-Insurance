-- Additive and repeatable. Run as schema owner in a transaction; never resets existing data.
CREATE TABLE IF NOT EXISTS roles (
    name VARCHAR(10) PRIMARY KEY CHECK (name IN ('ADMIN', 'MEMBER'))
);
INSERT INTO roles(name) VALUES ('ADMIN'), ('MEMBER') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS account_roles (
    member_id VARCHAR(30) NOT NULL REFERENCES member_accounts(member_id),
    role_name VARCHAR(10) NOT NULL REFERENCES roles(name),
    PRIMARY KEY(member_id, role_name)
);
INSERT INTO account_roles(member_id, role_name)
SELECT a.member_id, 'MEMBER' FROM member_accounts a
WHERE NOT EXISTS (SELECT 1 FROM account_roles r WHERE r.member_id = a.member_id)
ON CONFLICT DO NOTHING;
ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;
-- Preserve unknown historical registration dates as NULL; date only future registrations.
ALTER TABLE members ALTER COLUMN registered_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE members ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS benefits_review_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE members ALTER COLUMN email TYPE VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_accounts_email_lower ON member_accounts(lower(email));
CREATE INDEX IF NOT EXISTS idx_members_registered ON members(registered_at DESC);
CREATE TABLE IF NOT EXISTS account_password_setup (
    member_id VARCHAR(30) PRIMARY KEY REFERENCES member_accounts(member_id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
-- Runtime code may assign only MEMBER, never ADMIN. Admin provisioning requires the schema owner.
CREATE OR REPLACE FUNCTION public.enroll_member_role(p_member_id VARCHAR)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
    INSERT INTO public.account_roles(member_id, role_name)
    SELECT p_member_id, 'MEMBER'
    WHERE NOT EXISTS (SELECT 1 FROM public.account_roles WHERE member_id=p_member_id AND role_name='ADMIN')
    ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.enroll_member_role(VARCHAR) FROM PUBLIC;
