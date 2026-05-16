<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy RC Molina

This project runs as a Vite/React frontend served by an Express app on the Hostinger VPS.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](../.env.example) to `.env.local` and fill the server-only keys.
3. Run the app:
   `npm run dev`

## Deploy to Hostinger

Deploy to the Hostinger VPS with:

`npm run deploy:hostinger`

Production domain target:

- `rcmolinaseguros.resolveplanilhas.com.br`
- DNS record: `A` for `rcmolinaseguros` pointing to `187.77.55.45`
- HTTPS is enabled with Certbot for `rcmolinaseguros.resolveplanilhas.com.br`.

## Production data

The Hostinger VPS now hosts the application data locally:

- PostgreSQL database: `rcmolina`
- PostgreSQL role: `rcmolina`
- Schema: `RCMOLINASEGUROS`
- Shared environment file: `/var/www/rc-molina/shared/.env.local`
- Local uploads: `/var/www/rc-molina/shared/uploads`
- Backups: `/var/www/rc-molina/shared/backups`

Provision or repair the local database with:

`bash scripts/provision-hostinger-db.sh <db-password> <auth-secret> <admin-initial-password> [resend-api-key] [resend-from-email]`

For the Gmail/Webmail module in production:

- Keep `APP_URL=https://rcmolinaseguros.resolveplanilhas.com.br` in `/var/www/rc-molina/shared/.env.local`.
- Register `https://rcmolinaseguros.resolveplanilhas.com.br/api/gmail/callback` in Google Cloud as an authorized redirect URI.
- The provision script now rewrites `PUBLIC_BASE_URL`, `GMAIL_PUBLIC_BASE_URL`, `GOOGLE_REDIRECT_URI` and `GMAIL_GOOGLE_REDIRECT_URI` from `APP_URL`.
- Existing Gmail credentials in the shared `.env.local` are preserved during reprovisioning.

Create a production backup on the VPS with:

`bash scripts/backup-hostinger-db.sh`

Current state:

- The application is 100% standalone and does not depend on external BaaS (like Supabase).
- The production database is local PostgreSQL on the Hostinger VPS.
- A bootstrap admin user is created automatically if `ADMIN_INITIAL_PASSWORD` is configured.
- Runtime API endpoints are served by `server.ts`.
