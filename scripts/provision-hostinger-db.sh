#!/usr/bin/env bash
set -euo pipefail

DB_PASSWORD="${1:?DB password is required}"
AUTH_SECRET="${2:?Auth secret is required}"
ADMIN_INITIAL_PASSWORD="${3:?Admin initial password is required}"
RESEND_API_KEY="${4:-}"
RESEND_FROM_EMAIL="${5:-RC Molina Seguradora <onboarding@resend.dev>}"

APP_PATH="/var/www/rc-molina"
SHARED_PATH="$APP_PATH/shared"
ENV_PATH="$SHARED_PATH/.env.local"

systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = 'rcmolina'" | grep -q 1; then
  sudo -u postgres psql -c "create role rcmolina with login password '$DB_PASSWORD'"
else
  sudo -u postgres psql -c "alter role rcmolina with login password '$DB_PASSWORD'"
fi

if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'rcmolina'" | grep -q 1; then
  sudo -u postgres createdb -O rcmolina rcmolina
fi

sudo -u postgres psql -d rcmolina -c 'create extension if not exists pgcrypto;'

mkdir -p "$SHARED_PATH/uploads/avatars" "$SHARED_PATH/backups"
chmod 750 "$SHARED_PATH/uploads"

if [ -f "$ENV_PATH" ]; then
  cp "$ENV_PATH" "$ENV_PATH.bak.$(date +%Y%m%d%H%M%S)"
fi

APP_URL="$(grep -E '^APP_URL=' "$ENV_PATH" 2>/dev/null | cut -d= -f2- || true)"
GEMINI_API_KEY="$(grep -E '^GEMINI_API_KEY=' "$ENV_PATH" 2>/dev/null | cut -d= -f2- || true)"

cat > "$ENV_PATH" <<ENV
APP_URL=${APP_URL:-https://rcmolinaseguros.resolveplanilhas.com.br}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
DATABASE_URL=postgresql://rcmolina:${DB_PASSWORD}@127.0.0.1:5432/rcmolina
UPLOAD_DIR=$SHARED_PATH/uploads
ADMIN_EMAIL=admin@rcmolina.com.br
ADMIN_INITIAL_PASSWORD=${ADMIN_INITIAL_PASSWORD}
AUTH_SECRET=${AUTH_SECRET}
RESEND_API_KEY=${RESEND_API_KEY}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}
ENV

chmod 600 "$ENV_PATH"

echo "PostgreSQL local provisioned for RC Molina."
