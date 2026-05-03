<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy RC Molina

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](../.env.example) to `.env.local` and fill the server-only keys.
3. Run the app:
   `npm run dev`

## Deploy

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

Create a production backup on the VPS with:

`bash scripts/backup-hostinger-db.sh`

Current migration status:

- The application no longer uses Supabase SDK/configuration.
- The production database schema is local on the Hostinger VPS.
- A bootstrap admin user is created automatically if `ADMIN_INITIAL_PASSWORD` is configured and the admin e-mail does not exist.
- Historical Supabase `USUARIOS`, `CODIGOS_LOGIN` and avatar files were migrated to the Hostinger VPS on 2026-05-03.
- Supabase `AUDITORIA` had no rows at migration time.
