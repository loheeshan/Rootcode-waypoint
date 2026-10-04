#!/bin/sh
# API container start. Only APP_ENV=demo (set by docker-compose.yml) migrates, seeds demo data
# and may generate a signing key; any other APP_ENV starts the API exactly as before.
set -eu

if [ "${APP_ENV:-}" = "demo" ]; then
  if [ -z "${JWT_SECRET_KEY:-}" ]; then
    key_file=/var/lib/waypoint/jwt_secret_key
    if [ ! -s "$key_file" ]; then
      umask 077
      python -c "import secrets; print(secrets.token_urlsafe(48))" > "$key_file"
      echo "[demo] Generated a JWT signing key in the api_secrets volume (never printed)"
    fi
    JWT_SECRET_KEY=$(cat "$key_file")
    export JWT_SECRET_KEY
  fi
  echo "[demo] Applying database migrations"
  alembic upgrade head
  echo "[demo] Seeding demo accounts, resources and today's operations"
  python -m app.demo.bootstrap || echo "[demo] Demo seeding incomplete; see the messages above"
fi

exec "$@"
