# RELATORIO_MERGE

## Resumo tecnico

O modulo Gmail foi incorporado dentro da estrutura principal da RC Molina Seguros, preservando a aplicacao principal como shell unico. A pasta `gmail-app-original/` permaneceu apenas como referencia tecnica.

## Arquivos criados

- `api/_lib/gmail_config.js`
- `api/_lib/gmail_db.js`
- `api/_lib/gmail_email_address.js`
- `api/_lib/gmail_message_parser.js`
- `api/_lib/gmail_mime.js`
- `api/_lib/gmail_routes.js`
- `api/_lib/gmail_service.js`
- `api/_lib/gmail_text_encoding.js`
- `api/_lib/gmail_token_crypto.js`
- `src/lib/gmail_api.ts`
- `src/components/webmail/email_rich_text_editor.tsx`
- `src/components/webmail/rc_webmail.tsx`
- `scripts/migrate-gmail-supabase-to-rcm.mjs`
- `docs/gmail-migration-report.md`
- `RELATORIO_PRE_MERGE.md`
- `RELATORIO_MERGE.md`
- `RELATORIO_TESTES.md`
- `RELATORIO_MIGRACAO_BANCO_GMAIL.md`

## Arquivos alterados

- `server.ts`
- `package.json`
- `package-lock.json`
- `.env.example`
- `tsconfig.json`
- `src/app.tsx`
- `src/components/dashboard/rc_menu_principal.tsx`

## Dependencias adicionadas

- `googleapis`
- `multer`
- `@tinymce/tinymce-react`
- `tinymce`

## Decisoes tecnicas

- Backend Gmail unificado no backend principal da RC Molina em vez de manter um segundo servidor.
- Credenciais existentes nao foram sobrescritas; apenas placeholders foram adicionados em `.env.example`.
- O fluxo Gmail foi vinculado ao usuario autenticado da RC Molina por `user_id` e `user_email` enviados do frontend e persistidos no backend Gmail.
- O modulo de Webmail foi carregado via `React.lazy` para reduzir impacto no carregamento inicial do dashboard.
- Foram mantidas rotas legadas `/api/email/*` para compatibilidade e adicionadas rotas finais `/api/gmail/*`.
- O callback OAuth passou a retornar diretamente para `/email/inbox`, mantendo o usuario dentro do modulo integrado apos a conexao.
- O frontend do Webmail passou a sincronizar estado e navegacao com `/email/inbox`, `/email/sent`, `/email/drafts`, `/email/trash`, `/email/thread/:id`, `/email/compose` e `/email/settings`.
- Foi criado um script dedicado para migrar o legado Supabase `gmailapprcmolina` para o banco principal da RC Molina, com modo `dry-run`, backup em `_backup_pre_merge` e merge nao-destrutivo.
- A superficie funcional principal foi consolidada em `/api/gmail/*`; as rotas `/api/email/*` foram mantidas apenas como alias de compatibilidade.

## Rotas adicionadas

### Backend Gmail

- `GET /api/gmail/status`
- `GET /api/gmail/auth/url`
- `GET /api/gmail/callback`
- `GET /api/gmail/accounts`
- `POST /api/gmail/disconnect`
- `GET /api/gmail/messages`
- `GET /api/gmail/messages/:id`
- `POST /api/gmail/messages/:id/read`
- `POST /api/gmail/messages/:id/unread`
- `GET /api/gmail/messages/:messageId/attachments`
- `GET /api/gmail/messages/:messageId/attachments/:attachmentId`
- `POST /api/gmail/send`
- `POST /api/gmail/draft`
- `GET /api/gmail/drafts`
- `POST /api/gmail/drafts/:id/send`
- `DELETE /api/gmail/drafts/:id`
- `GET /api/gmail/outbox`
- `POST /api/gmail/outbox`
- `POST /api/gmail/outbox/:id/send`
- `DELETE /api/gmail/outbox/:id`
- `GET /api/gmail/logs`
- `POST /api/gmail/trash/empty`
- `DELETE /api/gmail/messages/:id`
- `POST /api/gmail/messages/:id/archive`
- `POST /api/gmail/messages/:id/trash`
- `POST /api/gmail/messages/:id/restore`

### Frontend

- `/email`
- `/email/inbox`
- `/email/sent`
- `/email/trash`
- `/email/drafts`
- `/email/compose`
- `/email/thread/:id`
- `/email/settings`

## Banco de dados / schema

- Nenhuma tabela antiga da RC Molina foi removida.
- Nenhuma migration antiga foi apagada.
- O schema Gmail foi incorporado com criacao idempotente em `api/_lib/gmail_db.js`.
- Campos adicionados sem destrutividade:
  - `gmail_accounts.user_id`
  - `gmail_accounts.user_email`
  - `gmail_accounts.status`
  - `gmail_accounts.disconnected_at`
  - `oauth_states.user_id`
  - `oauth_states.user_email`
  - `email_logs.user_id`

## Integracao visual

- O Gmail foi exposto como modulo do menu principal `Webmail`.
- O modulo usa o header, menu lateral e shell visual da RC Molina.
- A UI do webmail foi ajustada para parecer interna ao sistema principal.
- Foram adicionadas tela de configuracoes/status OAuth e lista real de rascunhos do Gmail.
- O cliente frontend principal passou a consumir apenas `/api/gmail/*`.

## Preservacao de dados e credenciais

- `.env.local` nao foi sobrescrito.
- `gmail-app-original/` nao foi alterada.
- Nao houve remocao de tabelas, arquivos ou credenciais.
- Segredos nao foram impressos em relatorios nem logs.

## Pendencias tecnicas

- O fluxo OAuth real depende do preenchimento manual das variaveis. O modulo aceita aliases dedicados e aliases legados:
  - `GMAIL_DATABASE_URL` ou `DATABASE_URL`
  - `GMAIL_GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_ID`
  - `GMAIL_GOOGLE_CLIENT_SECRET` ou `GOOGLE_CLIENT_SECRET`
  - `GMAIL_GOOGLE_REDIRECT_URI` ou `GOOGLE_REDIRECT_URI`
  - `GMAIL_ALLOWED_ACCOUNT` ou `ALLOWED_GMAIL_ACCOUNT`
  - `GMAIL_TOKEN_ENCRYPTION_KEY` ou `TOKEN_ENCRYPTION_KEY`
  - `GMAIL_PUBLIC_BASE_URL` ou `PUBLIC_BASE_URL`
- A migracao real do Supabase nao foi concluida nesta sessao porque a origem configurada nao respondeu por conectividade/DNS no dry-run.
- O importador tambem exige o banco-alvo RC Molina configurado via `GMAIL_DATABASE_URL` ou `DATABASE_URL` no ambiente que executar a carga.
- Como o projeto usa uma conta Gmail corporativa fixa por configuracao, a associacao por usuario da RC Molina fica dependente da politica operacional dessa conta.
