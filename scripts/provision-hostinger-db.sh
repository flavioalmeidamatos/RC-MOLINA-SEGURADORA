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

read_env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_PATH" 2>/dev/null | head -n 1 | cut -d= -f2- || true
}

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

APP_URL="$(read_env_value APP_URL)"
GEMINI_API_KEY="$(read_env_value GEMINI_API_KEY)"
GMAIL_DATABASE_URL="$(read_env_value GMAIL_DATABASE_URL)"
GMAIL_GOOGLE_CLIENT_ID="$(read_env_value GMAIL_GOOGLE_CLIENT_ID)"
GMAIL_GOOGLE_CLIENT_SECRET="$(read_env_value GMAIL_GOOGLE_CLIENT_SECRET)"
GMAIL_ALLOWED_ACCOUNT="$(read_env_value GMAIL_ALLOWED_ACCOUNT)"
GMAIL_TOKEN_ENCRYPTION_KEY="$(read_env_value GMAIL_TOKEN_ENCRYPTION_KEY)"
GMAIL_SUPABASE_URL="$(read_env_value GMAIL_SUPABASE_URL)"
GMAIL_SUPABASE_SERVICE_ROLE_KEY="$(read_env_value GMAIL_SUPABASE_SERVICE_ROLE_KEY)"
GMAIL_SUPABASE_ANON_KEY="$(read_env_value GMAIL_SUPABASE_ANON_KEY)"
GOOGLE_CLIENT_ID="$(read_env_value GOOGLE_CLIENT_ID)"
GOOGLE_CLIENT_SECRET="$(read_env_value GOOGLE_CLIENT_SECRET)"
ALLOWED_GMAIL_ACCOUNT="$(read_env_value ALLOWED_GMAIL_ACCOUNT)"
TOKEN_ENCRYPTION_KEY="$(read_env_value TOKEN_ENCRYPTION_KEY)"
VITE_SUPABASE_URL="$(read_env_value VITE_SUPABASE_URL)"
VITE_SUPABASE_ANON_KEY="$(read_env_value VITE_SUPABASE_ANON_KEY)"

APP_URL_VALUE="${APP_URL:-https://rcmolinaseguros.resolveplanilhas.com.br}"
APP_URL_VALUE="${APP_URL_VALUE%/}"
DATABASE_URL_VALUE="postgresql://rcmolina:${DB_PASSWORD}@127.0.0.1:5432/rcmolina"
PUBLIC_BASE_URL_VALUE="$APP_URL_VALUE"
GMAIL_GOOGLE_REDIRECT_URI_VALUE="$APP_URL_VALUE/api/gmail/callback"

if [ -z "$GMAIL_DATABASE_URL" ]; then
  GMAIL_DATABASE_URL="$DATABASE_URL_VALUE"
fi

if [ -z "$GMAIL_GOOGLE_CLIENT_ID" ]; then
  GMAIL_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
fi

if [ -z "$GOOGLE_CLIENT_ID" ]; then
  GOOGLE_CLIENT_ID="$GMAIL_GOOGLE_CLIENT_ID"
fi

if [ -z "$GMAIL_GOOGLE_CLIENT_SECRET" ]; then
  GMAIL_GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  GOOGLE_CLIENT_SECRET="$GMAIL_GOOGLE_CLIENT_SECRET"
fi

if [ -z "$GMAIL_ALLOWED_ACCOUNT" ]; then
  GMAIL_ALLOWED_ACCOUNT="${ALLOWED_GMAIL_ACCOUNT:-rcmolina.invest.segurosaude@gmail.com}"
fi

if [ -z "$ALLOWED_GMAIL_ACCOUNT" ]; then
  ALLOWED_GMAIL_ACCOUNT="$GMAIL_ALLOWED_ACCOUNT"
fi

if [ -z "$GMAIL_TOKEN_ENCRYPTION_KEY" ]; then
  GMAIL_TOKEN_ENCRYPTION_KEY="$TOKEN_ENCRYPTION_KEY"
fi

if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
  TOKEN_ENCRYPTION_KEY="$GMAIL_TOKEN_ENCRYPTION_KEY"
fi

{
  printf '%s\n' "APP_URL=${APP_URL_VALUE}"
  printf '%s\n' "GEMINI_API_KEY=${GEMINI_API_KEY:-}"
  printf '%s\n' "DATABASE_URL=${DATABASE_URL_VALUE}"
  printf '%s\n' "UPLOAD_DIR=$SHARED_PATH/uploads"
  printf '%s\n' "ADMIN_EMAIL=admin@rcmolina.com.br"
  printf '%s\n' "ADMIN_INITIAL_PASSWORD=${ADMIN_INITIAL_PASSWORD}"
  printf '%s\n' "AUTH_SECRET=${AUTH_SECRET}"
  printf '%s\n' "RESEND_API_KEY=${RESEND_API_KEY}"
  printf '%s\n' "RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}"
  printf '%s\n' "PUBLIC_BASE_URL=${PUBLIC_BASE_URL_VALUE}"
  printf '%s\n' "GMAIL_PUBLIC_BASE_URL=${PUBLIC_BASE_URL_VALUE}"
  printf '%s\n' "GOOGLE_REDIRECT_URI=${GMAIL_GOOGLE_REDIRECT_URI_VALUE}"
  printf '%s\n' "GMAIL_GOOGLE_REDIRECT_URI=${GMAIL_GOOGLE_REDIRECT_URI_VALUE}"
  printf '%s\n' "GMAIL_DATABASE_URL=${GMAIL_DATABASE_URL}"
  printf '%s\n' "GMAIL_GOOGLE_CLIENT_ID=${GMAIL_GOOGLE_CLIENT_ID}"
  printf '%s\n' "GMAIL_GOOGLE_CLIENT_SECRET=${GMAIL_GOOGLE_CLIENT_SECRET}"
  printf '%s\n' "GMAIL_ALLOWED_ACCOUNT=${GMAIL_ALLOWED_ACCOUNT}"
  printf '%s\n' "GMAIL_TOKEN_ENCRYPTION_KEY=${GMAIL_TOKEN_ENCRYPTION_KEY}"
  printf '%s\n' "GMAIL_SUPABASE_URL=${GMAIL_SUPABASE_URL}"
  printf '%s\n' "GMAIL_SUPABASE_SERVICE_ROLE_KEY=${GMAIL_SUPABASE_SERVICE_ROLE_KEY}"
  printf '%s\n' "GMAIL_SUPABASE_ANON_KEY=${GMAIL_SUPABASE_ANON_KEY}"
  printf '%s\n' "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
  printf '%s\n' "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
  printf '%s\n' "ALLOWED_GMAIL_ACCOUNT=${ALLOWED_GMAIL_ACCOUNT}"
  printf '%s\n' "TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}"
  printf '%s\n' "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
  printf '%s\n' "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}"
} > "$ENV_PATH"

chmod 600 "$ENV_PATH"

echo "PostgreSQL local provisioned for RC Molina."
