import pg from 'pg';

const { Pool } = pg;

const schemaSql = `
create extension if not exists pgcrypto;

create table if not exists gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid,
  user_email text,
  google_user_id text,
  access_token_enc text,
  refresh_token_enc text,
  scope text,
  token_type text,
  status text not null default 'connected',
  disconnected_at timestamptz,
  expiry_date timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oauth_states (
  state text primary key,
  requested_email text,
  user_id uuid,
  user_email text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  account_email text not null references gmail_accounts(email) on delete cascade,
  to_recipients text[] not null default '{}',
  cc_recipients text[] not null default '{}',
  bcc_recipients text[] not null default '{}',
  subject text not null default '',
  body_text text,
  body_html text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  gmail_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists email_message_metadata (
  id uuid primary key default gen_random_uuid(),
  account_email text not null references gmail_accounts(email) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  label_ids text[] not null default '{}',
  from_address text,
  to_addresses text[] not null default '{}',
  subject text,
  snippet text,
  internal_date timestamptz,
  has_attachments boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_email, gmail_message_id)
);

create table if not exists email_attachments (
  id uuid primary key default gen_random_uuid(),
  account_email text not null references gmail_accounts(email) on delete cascade,
  gmail_message_id text not null,
  attachment_id text not null,
  filename text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  unique (account_email, gmail_message_id, attachment_id)
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  account_email text,
  user_id uuid,
  event_type text not null check (event_type in ('oauth', 'send', 'read', 'error', 'sync', 'draft', 'message_action', 'trash')),
  severity text not null default 'info' check (severity in ('info', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists email_outbox_attachments (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references email_outbox(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  content bytea not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_outbox_attachments_outbox_id on email_outbox_attachments(outbox_id);
create index if not exists idx_email_outbox_account_status on email_outbox(account_email, status);
create index if not exists idx_message_metadata_account_date on email_message_metadata(account_email, internal_date desc);
create index if not exists idx_email_logs_account_date on email_logs(account_email, created_at desc);
alter table gmail_accounts add column if not exists user_id uuid;
alter table gmail_accounts add column if not exists user_email text;
alter table gmail_accounts add column if not exists status text not null default 'connected';
alter table gmail_accounts add column if not exists disconnected_at timestamptz;
alter table oauth_states add column if not exists user_id uuid;
alter table oauth_states add column if not exists user_email text;
alter table email_logs add column if not exists user_id uuid;
create index if not exists idx_gmail_accounts_user_id on gmail_accounts(user_id, updated_at desc);
create unique index if not exists idx_gmail_accounts_user_email on gmail_accounts(user_id, email) where user_id is not null;
`;

let pool = null;
let initPromise = null;

function getPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL || '';

  return databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'rcmolina',
        user: process.env.PGUSER || 'rcmolina',
        password: process.env.PGPASSWORD || '',
      };
}

export function getGmailPool() {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }

  return pool;
}

export async function initGmailDatabase() {
  if (!initPromise) {
    initPromise = getGmailPool().query(schemaSql).then(() => undefined);
  }

  return initPromise;
}

export async function query(text, params = []) {
  await initGmailDatabase();
  return getGmailPool().query(text, params);
}

export async function withTransaction(callback) {
  await initGmailDatabase();
  const client = await getGmailPool().connect();

  try {
    await client.query('begin');
    const result = await callback(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function logEvent(accountEmail, eventType, message, metadata = {}, severity = 'info', userId = null) {
  await query(
    `insert into email_logs (account_email, user_id, event_type, severity, message, metadata)
     values ($1, $2, $3, $4, $5, $6)`,
    [accountEmail || null, userId, eventType, severity, message, metadata],
  );
}
