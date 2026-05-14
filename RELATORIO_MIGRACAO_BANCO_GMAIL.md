# RELATORIO_MIGRACAO_BANCO_GMAIL

## Objetivo

Preparar e executar a migracao do banco legado `gmailapprcmolina` (Supabase) para o ambiente principal da RC Molina, sem sobrescrever dados existentes e sem expor segredos.

## O que foi preparado

- Script de migracao: `scripts/migrate-gmail-supabase-to-rcm.mjs`
- Comando npm: `npm run migrate:gmail-supabase`
- Backup tecnico desta fase: `_backup_pre_merge/gmail_db_phase2_20260513_181315/README.md`
- Relatorio de dry-run mais recente: `_backup_pre_merge/gmail_db_migration/2026-05-13T21-18-32-960Z/MIGRATION_REPORT.md`

## Estrategia da migracao

- Origem: Supabase REST usando `GMAIL_SUPABASE_URL` + `GMAIL_SUPABASE_SERVICE_ROLE_KEY` ou chave anon equivalente.
- Destino: banco principal RC Molina usando `GMAIL_DATABASE_URL` ou `DATABASE_URL`.
- Tabelas cobertas:
  - `gmail_accounts`
  - `oauth_states`
  - `email_outbox`
  - `email_message_metadata`
  - `email_attachments`
  - `email_logs`
  - `email_outbox_attachments`
- Modo de escrita: `insert ... on conflict` com merge conservador ou `do nothing`, para evitar sobrescrita destrutiva.

## Resultado do dry-run

- Status: bloqueado na leitura da origem.
- Motivo tecnico: a URL Supabase atual nao respondeu por conectividade/DNS neste ambiente.
- Erro resumido: falha de conectividade ao acessar `gmail_accounts` na origem configurada.

## O que falta para concluir a migracao real

- Restaurar a conectividade da origem Supabase ou fornecer uma URL/credencial valida.
- Disponibilizar `GMAIL_DATABASE_URL` ou `DATABASE_URL` do ambiente RC Molina onde os dados devem ser importados.
- Executar:
  - `npm run migrate:gmail-supabase -- --dry-run`
  - `npm run migrate:gmail-supabase`

## Observacao

Mesmo sem acesso ao banco legado nesta sessao, o pipeline de importacao ficou pronto e a API principal foi revisada para usar `/api/gmail/*` como superficie unificada.
