#!/usr/bin/env bash
set -euo pipefail

APP_PATH="/var/www/rc-molina"
BACKUP_PATH="$APP_PATH/shared/backups"
ENV_PATH="$APP_PATH/shared/.env.local"
STAMP="$(date +%Y%m%d%H%M%S)"

mkdir -p "$BACKUP_PATH"

DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ] && [ -f "$ENV_PATH" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_PATH" | cut -d= -f2-)"
fi

pg_dump "${DATABASE_URL:?DATABASE_URL is required}" \
  --format=custom \
  --file="$BACKUP_PATH/rcmolina-$STAMP.dump"

tar -czf "$BACKUP_PATH/uploads-$STAMP.tgz" -C "$APP_PATH/shared" uploads

echo "Database backup: $BACKUP_PATH/rcmolina-$STAMP.dump"
echo "Uploads backup: $BACKUP_PATH/uploads-$STAMP.tgz"
