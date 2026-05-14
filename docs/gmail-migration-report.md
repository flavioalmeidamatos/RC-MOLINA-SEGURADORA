# Relatorio de migracao do Webmail Gmail

Data: migracao realizada dentro da estrutura principal `RC-MOLINA-SEGURADORA`

## Regras atendidas

- A pasta `gmail-app-original/` foi usada somente como referencia tecnica.
- Nenhum arquivo dentro de `gmail-app-original/` foi alterado, apagado ou movido.
- Nenhuma credencial existente foi sobrescrita.
- A integracao final foi criada no app principal, em novas rotas/modulos do backend e novos componentes do frontend.

## Mapeamento da migracao

- Referencia backend Gmail:
  - `gmail-app-original/server/src/routes.js`
  - `gmail-app-original/server/src/gmail/*.js`
  - `gmail-app-original/server/src/security/tokenCrypto.js`
  - `gmail-app-original/server/src/textEncoding.js`
- Implementacao principal criada:
  - `api/_lib/gmail_routes.js`
  - `api/_lib/gmail_service.js`
  - `api/_lib/gmail_db.js`
  - `api/_lib/gmail_config.js`
  - `api/_lib/gmail_token_crypto.js`
  - `api/_lib/gmail_text_encoding.js`
  - `api/_lib/gmail_mime.js`
  - `api/_lib/gmail_message_parser.js`
  - `api/_lib/gmail_email_address.js`

- Referencia frontend Gmail:
  - `gmail-app-original/client/src/App.tsx`
  - `gmail-app-original/client/src/lib/api.ts`
  - `gmail-app-original/client/src/components/email/EmailRichTextEditor.tsx`
- Implementacao principal criada:
  - `src/components/webmail/rc_webmail.tsx`
  - `src/components/webmail/email_rich_text_editor.tsx`
  - `src/lib/gmail_api.ts`
  - Integracao no dashboard em `src/components/dashboard/rc_menu_principal.tsx`

## Dependencias adicionadas ao app principal

- `googleapis`
- `multer`
- `@tinymce/tinymce-react`
- `tinymce`

## Unificacao de rotas

- A superficie principal do modulo foi consolidada em `/api/gmail/*`.
- As rotas `/api/email/*` foram preservadas apenas como compatibilidade com o legado/matriz.
- O cliente principal `src/lib/gmail_api.ts` agora consome somente `/api/gmail/*`.

## Migracao do banco legado

- Script criado: `scripts/migrate-gmail-supabase-to-rcm.mjs`
- Comando: `npm run migrate:gmail-supabase`
- Dry-run executado nesta sessao: falhou por conectividade/DNS da origem Supabase configurada.
- Relatorio dessa tentativa: `_backup_pre_merge/gmail_db_migration/2026-05-13T21-18-32-960Z/MIGRATION_REPORT.md`

## Configuracao manual pendente

Preencher no ambiente principal:

- `GMAIL_DATABASE_URL` ou `DATABASE_URL`
- `GMAIL_GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_ID`
- `GMAIL_GOOGLE_CLIENT_SECRET` ou `GOOGLE_CLIENT_SECRET`
- `GMAIL_GOOGLE_REDIRECT_URI` ou `GOOGLE_REDIRECT_URI`
- `GMAIL_ALLOWED_ACCOUNT` ou `ALLOWED_GMAIL_ACCOUNT`
- `GMAIL_TOKEN_ENCRYPTION_KEY` ou `TOKEN_ENCRYPTION_KEY`
- `GMAIL_PUBLIC_BASE_URL` ou `PUBLIC_BASE_URL`
- `GMAIL_SUPABASE_URL`
- `GMAIL_SUPABASE_SERVICE_ROLE_KEY` ou `GMAIL_SUPABASE_ANON_KEY`

## Observacao operacional

O schema do Webmail Gmail passa a ser criado automaticamente pelo backend principal no primeiro acesso as rotas `/api/email/*`.
O callback OAuth retorna para `/email/inbox`, preservando o fluxo dentro do modulo integrado da RC Molina.
