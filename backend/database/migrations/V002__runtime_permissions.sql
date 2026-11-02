-- psql script, additive data-safe grants. Set DB_USERNAME to the runtime role, run as schema owner.
\getenv app_user DB_USERNAME
SELECT current_database() AS db_name \gset
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT INSERT ON members, member_accounts TO :"app_user";
GRANT USAGE ON SEQUENCE members_id_seq TO :"app_user";
GRANT UPDATE (full_name,email,phone,address,plan_name,plan_type,coverage_status,version,benefits_review_required) ON members TO :"app_user";
GRANT UPDATE (email,password_hash,enabled,password_setup_required,session_version) ON member_accounts TO :"app_user";
GRANT INSERT, UPDATE ON account_password_setup TO :"app_user";
REVOKE INSERT, UPDATE, DELETE ON account_roles, roles FROM :"app_user";
GRANT EXECUTE ON FUNCTION public.enroll_member_role(VARCHAR) TO :"app_user";
