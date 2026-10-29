#!/bin/sh
# Runs once, when the database volume is first created. The schema itself comes from Alembic migrations.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE anumati_app LOGIN PASSWORD '${ANUMATI_APP_DB_PASSWORD}';
  CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
  CREATE DATABASE keycloak OWNER keycloak;
EOSQL
