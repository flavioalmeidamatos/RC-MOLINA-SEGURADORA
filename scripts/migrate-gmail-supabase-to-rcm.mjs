import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { initGmailDatabase } from '../api/_lib/gmail_db.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const TABLE_CONFIGS = [
  {
    name: 'gmail_accounts',
    query: `
      insert into gmail_accounts (
        id, email, user_id, user_email, google_user_id, access_token_enc, refresh_token_enc,
        scope, token_type, status, disconnected_at, expiry_date, connected_at, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      on conflict (email) do update set
        user_id = coalesce(gmail_accounts.user_id, excluded.user_id),
        user_email = coalesce(gmail_accounts.user_email, excluded.user_email),
        google_user_id = coalesce(gmail_accounts.google_user_id, excluded.google_user_id),
        access_token_enc = coalesce(gmail_accounts.access_token_enc, excluded.access_token_enc),
        refresh_token_enc = coalesce(gmail_accounts.refresh_token_enc, excluded.refresh_token_enc),
        scope = coalesce(gmail_accounts.scope, excluded.scope),
        token_type = coalesce(gmail_accounts.token_type, excluded.token_type),
        status = case
          when gmail_accounts.status = 'connected' or excluded.status = 'connected' then 'connected'
          else coalesce(gmail_accounts.status, excluded.status, 'connected')
        end,
        disconnected_at = coalesce(gmail_accounts.disconnected_at, excluded.disconnected_at),
        expiry_date = coalesce(gmail_accounts.expiry_date, excluded.expiry_date),
        connected_at = least(gmail_accounts.connected_at, excluded.connected_at),
        updated_at = greatest(gmail_accounts.updated_at, excluded.updated_at)
    `,
    values: (row) => [
      row.id,
      row.email,
      row.user_id ?? null,
      row.user_email ?? null,
      row.google_user_id ?? null,
      row.access_token_enc ?? null,
      row.refresh_token_enc ?? null,
      row.scope ?? null,
      row.token_type ?? null,
      row.status ?? 'connected',
      row.disconnected_at ?? null,
      row.expiry_date ?? null,
      row.connected_at ?? new Date().toISOString(),
      row.updated_at ?? new Date().toISOString(),
    ],
  },
  {
    name: 'oauth_states',
    query: `
      insert into oauth_states (
        state, requested_email, user_id, user_email, created_at, consumed_at
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (state) do nothing
    `,
    values: (row) => [
      row.state,
      row.requested_email ?? null,
      row.user_id ?? null,
      row.user_email ?? null,
      row.created_at ?? new Date().toISOString(),
      row.consumed_at ?? null,
    ],
  },
  {
    name: 'email_outbox',
    query: `
      insert into email_outbox (
        id, account_email, to_recipients, cc_recipients, bcc_recipients, subject,
        body_text, body_html, status, gmail_message_id, error_message,
        created_at, updated_at, sent_at
      ) values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      on conflict (id) do nothing
    `,
    values: (row) => [
      row.id,
      row.account_email,
      row.to_recipients ?? [],
      row.cc_recipients ?? [],
      row.bcc_recipients ?? [],
      row.subject ?? '',
      row.body_text ?? null,
      row.body_html ?? null,
      row.status ?? 'pending',
      row.gmail_message_id ?? null,
      row.error_message ?? null,
      row.created_at ?? new Date().toISOString(),
      row.updated_at ?? new Date().toISOString(),
      row.sent_at ?? null,
    ],
  },
  {
    name: 'email_message_metadata',
    query: `
      insert into email_message_metadata (
        id, account_email, gmail_message_id, thread_id, label_ids, from_address,
        to_addresses, subject, snippet, internal_date, has_attachments,
        created_at, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13
      )
      on conflict (account_email, gmail_message_id) do update set
        thread_id = coalesce(email_message_metadata.thread_id, excluded.thread_id),
        label_ids = case
          when coalesce(array_length(email_message_metadata.label_ids, 1), 0) > 0 then email_message_metadata.label_ids
          else excluded.label_ids
        end,
        from_address = coalesce(email_message_metadata.from_address, excluded.from_address),
        to_addresses = case
          when coalesce(array_length(email_message_metadata.to_addresses, 1), 0) > 0 then email_message_metadata.to_addresses
          else excluded.to_addresses
        end,
        subject = coalesce(email_message_metadata.subject, excluded.subject),
        snippet = coalesce(email_message_metadata.snippet, excluded.snippet),
        internal_date = coalesce(email_message_metadata.internal_date, excluded.internal_date),
        has_attachments = email_message_metadata.has_attachments or excluded.has_attachments,
        updated_at = greatest(email_message_metadata.updated_at, excluded.updated_at)
    `,
    values: (row) => [
      row.id,
      row.account_email,
      row.gmail_message_id,
      row.thread_id ?? null,
      row.label_ids ?? [],
      row.from_address ?? null,
      row.to_addresses ?? [],
      row.subject ?? null,
      row.snippet ?? null,
      row.internal_date ?? null,
      Boolean(row.has_attachments),
      row.created_at ?? new Date().toISOString(),
      row.updated_at ?? new Date().toISOString(),
    ],
  },
  {
    name: 'email_attachments',
    query: `
      insert into email_attachments (
        id, account_email, gmail_message_id, attachment_id, filename, mime_type, size_bytes, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (account_email, gmail_message_id, attachment_id) do update set
        filename = coalesce(email_attachments.filename, excluded.filename),
        mime_type = coalesce(email_attachments.mime_type, excluded.mime_type),
        size_bytes = coalesce(email_attachments.size_bytes, excluded.size_bytes)
    `,
    values: (row) => [
      row.id,
      row.account_email,
      row.gmail_message_id,
      row.attachment_id,
      row.filename,
      row.mime_type ?? null,
      row.size_bytes ?? null,
      row.created_at ?? new Date().toISOString(),
    ],
  },
  {
    name: 'email_logs',
    query: `
      insert into email_logs (
        id, account_email, user_id, event_type, severity, message, metadata, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do nothing
    `,
    values: (row) => [
      row.id,
      row.account_email ?? null,
      row.user_id ?? null,
      row.event_type,
      row.severity ?? 'info',
      row.message,
      row.metadata ?? {},
      row.created_at ?? new Date().toISOString(),
    ],
  },
  {
    name: 'email_outbox_attachments',
    query: `
      insert into email_outbox_attachments (
        id, outbox_id, filename, mime_type, content, size_bytes, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do nothing
    `,
    values: (row) => [
      row.id,
      row.outbox_id,
      row.filename,
      row.mime_type,
      normalizeBinaryField(row.content),
      row.size_bytes,
      row.created_at ?? new Date().toISOString(),
    ],
  },
];

function normalizeBinaryField(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : value;
    if (/^[a-f0-9]+$/i.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, 'hex');
    }
    return Buffer.from(value, 'base64');
  }
  if (Array.isArray(value)) {
    return Buffer.from(value);
  }
  return Buffer.from(String(value));
}

function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadProjectEnv() {
  const files = ['.env.local', '.env'];
  const env = {};

  for (const file of files) {
    const envPath = path.join(projectRoot, file);
    try {
      const content = await fs.readFile(envPath, 'utf8');
      Object.assign(env, parseEnvFile(content));
    } catch {}
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) {
      env[key] = value;
    }
  }

  return env;
}

function firstEnv(env, names) {
  for (const name of names) {
    if (env[name]) return env[name];
  }
  return '';
}

function buildTargetPoolConfig(env) {
  const databaseUrl = firstEnv(env, ['GMAIL_DATABASE_URL', 'DATABASE_URL']);
  if (databaseUrl) {
    return { connectionString: databaseUrl };
  }

  return {
    host: env.PGHOST || '127.0.0.1',
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE || 'rcmolina',
    user: env.PGUSER || 'rcmolina',
    password: env.PGPASSWORD || '',
  };
}

async function fetchSupabaseRows({ baseUrl, apiKey, table, pageSize = 1000 }) {
  const rows = [];
  let from = 0;

  while (true) {
    const url = `${baseUrl}/rest/v1/${table}?select=*`;
    let response;

    try {
      response = await fetch(url, {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          Range: `${from}-${from + pageSize - 1}`,
          'Range-Unit': 'items',
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'falha de rede';
      throw new Error(`Falha de conectividade ao acessar ${table} em ${baseUrl}. Detalhe: ${detail}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Falha ao ler ${table} do Supabase. HTTP ${response.status}. ${body.slice(0, 200)}`);
    }

    const page = await response.json();
    if (!Array.isArray(page)) {
      throw new Error(`Resposta invalida do Supabase para ${table}.`);
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function ensureBackupDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(projectRoot, '_backup_pre_merge', 'gmail_db_migration', stamp);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeReport(backupDir, filename, content) {
  await fs.writeFile(path.join(backupDir, filename), content, 'utf8');
}

async function run() {
  const env = await loadProjectEnv();
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null && value != null) {
      process.env[key] = value;
    }
  }
  const sourceUrl = firstEnv(env, ['GMAIL_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const sourceKey = firstEnv(env, [
    'GMAIL_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GMAIL_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ]);
  const dryRun = process.argv.includes('--dry-run');
  const writeSnapshot = process.argv.includes('--snapshot');
  const backupDir = await ensureBackupDir();

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceConfigured: Boolean(sourceUrl && sourceKey),
    dryRun,
    writeSnapshot,
    tables: {},
    targetConfigured: Boolean(firstEnv(env, ['GMAIL_DATABASE_URL', 'DATABASE_URL']) || env.PGHOST || env.PGDATABASE),
  };

  if (!sourceUrl || !sourceKey) {
    await writeReport(
      backupDir,
      'MIGRATION_REPORT.md',
      [
        '# Relatorio da migracao Gmail Supabase -> RC Molina',
        '',
        '- Status: bloqueado',
        '- Motivo: variaveis de origem do Supabase nao estao configuradas neste ambiente.',
        '- Esperado: `GMAIL_SUPABASE_URL` e uma chave `GMAIL_SUPABASE_SERVICE_ROLE_KEY` ou equivalente.',
      ].join('\n'),
    );
    console.error('Origem Supabase nao configurada.');
    process.exit(1);
  }

  try {
    for (const config of TABLE_CONFIGS) {
      const rows = await fetchSupabaseRows({ baseUrl: sourceUrl, apiKey: sourceKey, table: config.name });
      summary.tables[config.name] = { fetched: rows.length };

      if (writeSnapshot) {
        await fs.writeFile(
          path.join(backupDir, `${config.name}.json`),
          JSON.stringify(rows, null, 2),
          'utf8',
        );
      }

      config.rows = rows;
    }
  } catch (error) {
    await writeReport(
      backupDir,
      'MIGRATION_REPORT.md',
      [
        '# Relatorio da migracao Gmail Supabase -> RC Molina',
        '',
        '- Status: falha na leitura da origem',
        `- Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      ].join('\n'),
    );
    await fs.writeFile(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    throw error;
  }

  if (dryRun) {
    await writeReport(
      backupDir,
      'MIGRATION_REPORT.md',
      [
        '# Relatorio da migracao Gmail Supabase -> RC Molina',
        '',
        '- Status: dry-run concluido',
        '- Nenhum dado foi escrito no banco RC Molina.',
        '',
        ...Object.entries(summary.tables).map(([table, info]) => `- ${table}: ${info.fetched} registros lidos`),
      ].join('\n'),
    );
    await fs.writeFile(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Dry-run concluido. Relatorio em ${backupDir}`);
    return;
  }

  await initGmailDatabase();
  const targetPool = new Pool(buildTargetPoolConfig(env));
  const client = await targetPool.connect();

  try {
    await client.query('begin');

    for (const config of TABLE_CONFIGS) {
      let imported = 0;

      for (const row of config.rows || []) {
        await client.query(config.query, config.values(row));
        imported += 1;
      }

      summary.tables[config.name] = {
        ...summary.tables[config.name],
        imported,
      };
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    await writeReport(
      backupDir,
      'MIGRATION_REPORT.md',
      [
        '# Relatorio da migracao Gmail Supabase -> RC Molina',
        '',
        '- Status: falha na importacao',
        `- Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      ].join('\n'),
    );
    throw error;
  } finally {
    client.release();
    await targetPool.end();
  }

  await writeReport(
    backupDir,
    'MIGRATION_REPORT.md',
    [
      '# Relatorio da migracao Gmail Supabase -> RC Molina',
      '',
      '- Status: concluido',
      '',
      ...Object.entries(summary.tables).map(
        ([table, info]) => `- ${table}: ${info.fetched} lidos / ${info.imported || 0} processados`,
      ),
    ].join('\n'),
  );
  await fs.writeFile(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Migracao concluida. Relatorio em ${backupDir}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
