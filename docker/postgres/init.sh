#!/bin/sh
# Executed only by Postgres initialization on a NEW, empty Compose volume.
set -eu
if [ "$DB_USERNAME" = "$POSTGRES_USER" ]; then
    echo 'DB_USERNAME must differ from POSTGRES_USER.' >&2
    exit 1
fi
sql_dir=${HEALTHBRIDGE_SQL_DIR:-/opt/healthbridge/database}
for script in healthbridge.sql auth_setup.sql benefits_providers.sql claims_upgrade.sql feature_upgrade.sql portfolio_constraints.sql migrations/V001__admin_members.sql; do
    psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        --set ON_ERROR_STOP=1 --single-transaction --file "$sql_dir/$script"
done
psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv app_user DB_USERNAME
\getenv app_password DB_PASSWORD
\getenv db_name POSTGRES_DB
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
SQL
psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --single-transaction --file "$sql_dir/migrations/V002__runtime_permissions.sql"

psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --single-transaction --file "$sql_dir/migrations/V003__insurance_plans.sql"

psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --single-transaction --file "$sql_dir/migrations/V004__admin_claims.sql"

psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --single-transaction --file "$sql_dir/migrations/V005__claim_coverage_review.sql"
