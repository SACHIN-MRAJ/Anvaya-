#!/bin/sh
# Applies database migrations (as the owner role) before starting the API, when asked to.
set -e
if [ "${ANUMATI_RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying database migrations..."
  alembic upgrade head
fi
exec "$@"
