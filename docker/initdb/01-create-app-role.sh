#!/bin/bash
set -e

: "${APP_DB_USER:?APP_DB_USER must be set}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<-EOSQL

DO
\$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles
    WHERE rolname = '$APP_DB_USER'
  ) THEN

    CREATE ROLE "$APP_DB_USER"
      LOGIN
      PASSWORD '$APP_DB_PASSWORD'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS;

  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$APP_DB_USER";

GRANT USAGE ON SCHEMA public TO "$APP_DB_USER";

EOSQL

echo "app_user role ensured."