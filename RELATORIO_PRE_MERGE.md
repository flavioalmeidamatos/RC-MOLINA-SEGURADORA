# RELATORIO_PRE_MERGE

## Escopo auditado

- Aplicacao principal: `RC Molina Seguros`
- Aplicacao de referencia a incorporar: `gmail-app-original`
- Estado auditado: workspace encontrado nesta etapa antes dos ajustes finais de unificacao

## Estrutura inicial encontrada

### RC Molina Seguros

- Frontend: React + Vite + TypeScript
- Backend: Express servido por `server.ts`
- Autenticacao atual: login local proprio, sessao em `localStorage`, rotas em `api/_lib/local_auth_routes.ts`
- Banco atual: PostgreSQL local/remoto via `pg`, schema principal em `api/_lib/local_db.ts`
- Modulos principais encontrados:
  - dashboard
  - clientes
  - agenda
  - simuladores/proxies
  - autenticacao local

### Gmail original

- Estrutura: monorepo com `client/` e `server/`
- Frontend: React + Vite + TypeScript
- Backend: Express separado
- Banco: PostgreSQL com schema proprio em `gmail-app-original/server/db/schema.sql`
- Integracao Gmail: OAuth 2.0 + Gmail API + criptografia AES para tokens

## Dependencias encontradas

### RC Molina Seguros

- `react`, `react-dom`, `react-router-dom`
- `vite`, `typescript`, `tsx`
- `express`, `pg`, `dotenv`
- `lucide-react`, `motion`, `cheerio`

### Gmail original

- Backend: `express`, `googleapis`, `multer`, `pg`, `dotenv`, `helmet`, `cors`
- Frontend: `@tinymce/tinymce-react`, `tinymce`, `lucide-react`, `react`, `vite`

## Banco de dados encontrado

### RC Molina Seguros

- Schema principal: `RCMOLINASEGUROS`
- Tabelas identificadas no codigo:
  - `USUARIOS`
  - `AUDITORIA`
  - `CODIGOS_LOGIN`
  - `CLIENTES`
  - `CLIENTES_CONTATOS`
  - `CLIENTES_ANEXOS`

### Gmail original

- Tabelas identificadas no schema:
  - `gmail_accounts`
  - `oauth_states`
  - `email_outbox`
  - `email_outbox_attachments`
  - `email_message_metadata`
  - `email_attachments`
  - `email_logs`

## Variaveis de ambiente encontradas

### RC Molina Seguros

- `DATABASE_URL=********`
- `UPLOAD_DIR=********`
- `ADMIN_EMAIL=********`
- `ADMIN_INITIAL_PASSWORD=********`
- `AUTH_SECRET=********`
- `RESEND_API_KEY=********`
- `RESEND_FROM_EMAIL=********`

### Gmail original

- `DATABASE_URL=********`
- `GOOGLE_CLIENT_ID=********`
- `GOOGLE_CLIENT_SECRET=********`
- `GOOGLE_REDIRECT_URI=********`
- `ALLOWED_GMAIL_ACCOUNT=********`
- `TOKEN_ENCRYPTION_KEY=********`
- `CLIENT_ORIGIN=********`
- `PORT=********`
- `VITE_API_BASE_URL=********`

## Conflitos e riscos identificados

- Conflito conceitual de backend: a RC Molina ja possuia backend unico, enquanto o Gmail original possuia backend separado.
- Conflito conceitual de autenticacao: a RC Molina usa autenticacao local; o Gmail original operava por conta Gmail sem vinculo nativo ao usuario local.
- Conflito potencial de ambiente: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e `TOKEN_ENCRYPTION_KEY` existem no dominio Gmail e precisavam ser incorporadas sem sobrescrever `.env.local`.
- Risco de exposicao de segredos: mitigado com relatorios mascarados e sem leitura bruta de arquivos sensiveis no terminal.
- Risco de regressao visual: o Gmail original tinha UI propria, exigindo adequacao ao shell visual da RC Molina.
- Risco de bundle grande: `tinymce` aumenta o tamanho do modulo de webmail; mitigado com lazy-load.

## Backup criado

- Pasta criada: `_backup_pre_merge/`
- Conteudo salvo:
  - snapshot relevante da RC Molina
  - snapshot relevante da aplicacao Gmail
  - snapshots mascarados de configuracao em `_backup_pre_merge/snapshots/`

## Diretriz adotada

- Preservar a RC Molina Seguros como shell principal.
- Incorporar o Gmail como modulo interno.
- Nao alterar `gmail-app-original/`.
- Nao sobrescrever credenciais existentes.
