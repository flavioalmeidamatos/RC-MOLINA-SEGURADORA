import crypto from 'crypto';
import { google } from 'googleapis';
import {
  gmailConfig,
  ensureAllowedAccount,
  ensureGmailOAuthConfig,
} from './gmail_config.js';
import { logEvent, query, withTransaction } from './gmail_db.js';
import { decryptText, encryptText } from './gmail_token_crypto.js';
import { createRawMessage } from './gmail_mime.js';
import {
  metadataFromFullMessage,
  toFullMessage,
  toMessageSummary,
} from './gmail_message_parser.js';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/contacts',
];

export const GMAIL_TRASH_SCOPES = ['https://mail.google.com/'];

function normalizeActor(actor = {}) {
  return {
    userId: actor?.userId ? String(actor.userId) : null,
    userEmail: actor?.userEmail ? String(actor.userEmail).trim().toLowerCase() : null,
  };
}

async function findAccountRecord(accountEmail, actor = {}) {
  const normalizedActor = normalizeActor(actor);
  const normalizedEmail = String(accountEmail || '').trim().toLowerCase();

  if (normalizedActor.userId && normalizedEmail) {
    const result = await query(
      'select * from gmail_accounts where user_id = $1 and lower(email) = $2 limit 1',
      [normalizedActor.userId, normalizedEmail],
    );
    if (result.rowCount > 0) return result.rows[0];
  }

  if (normalizedActor.userId && !normalizedEmail) {
    const result = await query(
      'select * from gmail_accounts where user_id = $1 order by updated_at desc limit 1',
      [normalizedActor.userId],
    );
    if (result.rowCount > 0) return result.rows[0];
  }

  if (normalizedEmail) {
    const result = await query('select * from gmail_accounts where lower(email) = $1 limit 1', [
      normalizedEmail,
    ]);
    if (result.rowCount > 0) return result.rows[0];
  }

  return null;
}

function normalizeGrantedScopes(scope = '') {
  return new Set(
    String(scope)
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function hasScope(grantedScopes, requiredScope) {
  return grantedScopes.has(requiredScope) || grantedScopes.has('https://mail.google.com/');
}

function buildInsufficientScopeError(missingScopes) {
  const error = new Error(
    'Permissoes do Gmail insuficientes. Reconecte a conta e aceite todas as permissoes.',
  );
  error.status = 403;
  error.code = 'insufficient_scope';
  error.details = {
    reconnectRequired: true,
    missingScopes,
  };
  return error;
}

function folderToLabel(folder) {
  return {
    inbox: 'INBOX',
    sent: 'SENT',
    trash: 'TRASH',
  }[folder] || 'INBOX';
}

function buildSearchQuery(filters = {}, folder = 'inbox') {
  const terms = [];

  if (filters.from) {
    if (folder === 'sent' || folder === 'drafts') {
      terms.push(`(to:${filters.from} OR from:${filters.from} OR ${filters.from})`);
    } else {
      terms.push(`(from:${filters.from} OR ${filters.from})`);
    }
  }
  if (filters.subject) terms.push(`subject:(${filters.subject})`);
  if (filters.content) terms.push(filters.content);
  if (filters.after) terms.push(`after:${String(filters.after).replaceAll('-', '/')}`);
  if (filters.before) terms.push(`before:${String(filters.before).replaceAll('-', '/')}`);
  if (filters.status === 'unread') terms.push('is:unread');
  if (filters.status === 'read') terms.push('-is:unread');
  if (filters.hasAttachment === true || filters.hasAttachment === 'true') {
    terms.push('has:attachment');
  }
  if (folder !== 'trash') {
    terms.push('-in:trash');
  }

  return terms.join(' ');
}

function getPartHeaderValue(part, name) {
  const header = (part?.headers || []).find(
    (item) => item.name?.toLowerCase() === String(name).toLowerCase(),
  );
  return header?.value || '';
}

function getAccountRefreshToken(existingAccount, nextTokens) {
  if (nextTokens.refresh_token) {
    return nextTokens.refresh_token;
  }

  return decryptText(existingAccount?.refresh_token_enc);
}

async function hydrateMessagePartBodies(gmail, messageId, part) {
  if (!part) return;

  const isTextBody = part.mimeType === 'text/plain' || part.mimeType === 'text/html';
  const attachmentId = part.body?.attachmentId;
  const bodyData = part.body?.data;

  if (isTextBody && attachmentId && !bodyData) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    part.body = {
      ...part.body,
      data: attachment.data.data || '',
    };
  }

  await Promise.all((part.parts || []).map((child) => hydrateMessagePartBodies(gmail, messageId, child)));
}

async function hydrateInlineAttachmentBodies(gmail, messageId, part) {
  if (!part) return;

  const attachmentId = part.body?.attachmentId;
  const bodyData = part.body?.data;
  const contentId = getPartHeaderValue(part, 'Content-ID').trim();
  const contentLocation = getPartHeaderValue(part, 'Content-Location').trim();
  const contentDisposition = getPartHeaderValue(part, 'Content-Disposition').toLowerCase();
  const isInlineAttachment =
    Boolean(contentId) ||
    Boolean(contentLocation) ||
    contentDisposition.includes('inline');

  if (isInlineAttachment && attachmentId && !bodyData) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    part.body = {
      ...part.body,
      data: attachment.data.data || '',
    };
  }

  await Promise.all(
    (part.parts || []).map((child) => hydrateInlineAttachmentBodies(gmail, messageId, child)),
  );
}

async function saveMessageMetadata(accountEmail, gmailMessage) {
  const metadata = metadataFromFullMessage(accountEmail, gmailMessage);

  await withTransaction(async (client) => {
    await client.query(
      `insert into email_message_metadata (
         account_email, gmail_message_id, thread_id, label_ids, from_address, to_addresses,
         subject, snippet, internal_date, has_attachments
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (account_email, gmail_message_id) do update set
         thread_id = excluded.thread_id,
         label_ids = excluded.label_ids,
         from_address = excluded.from_address,
         to_addresses = excluded.to_addresses,
         subject = excluded.subject,
         snippet = excluded.snippet,
         internal_date = excluded.internal_date,
         has_attachments = excluded.has_attachments,
         updated_at = now()`,
      [
        metadata.accountEmail,
        metadata.gmailMessageId,
        metadata.threadId,
        metadata.labelIds,
        metadata.fromAddress,
        metadata.toAddresses,
        metadata.subject,
        metadata.snippet,
        metadata.internalDate,
        metadata.hasAttachments,
      ],
    );

    for (const attachment of metadata.attachments) {
      await client.query(
        `insert into email_attachments (
           account_email, gmail_message_id, attachment_id, filename, mime_type, size_bytes
         )
         values ($1, $2, $3, $4, $5, $6)
         on conflict (account_email, gmail_message_id, attachment_id) do update set
           filename = excluded.filename,
           mime_type = excluded.mime_type,
           size_bytes = excluded.size_bytes`,
        [
          accountEmail,
          metadata.gmailMessageId,
          attachment.attachmentId,
          attachment.filename,
          attachment.mimeType,
          attachment.size,
        ],
      );
    }
  });
}

async function upsertAccountTokens(email, googleUserId, tokens, actor = {}) {
  const normalizedActor = normalizeActor(actor);
  const existing = await findAccountRecord(email, normalizedActor);
  const refreshToken = getAccountRefreshToken(existing, tokens);

  await query(
    `insert into gmail_accounts (
       email, user_id, user_email, google_user_id, access_token_enc, refresh_token_enc, scope, token_type, status, disconnected_at, expiry_date
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'connected', null, to_timestamp($9 / 1000.0))
     on conflict (email) do update set
       user_id = coalesce(excluded.user_id, gmail_accounts.user_id),
       user_email = coalesce(excluded.user_email, gmail_accounts.user_email),
       google_user_id = excluded.google_user_id,
       access_token_enc = excluded.access_token_enc,
       refresh_token_enc = coalesce(excluded.refresh_token_enc, gmail_accounts.refresh_token_enc),
       scope = excluded.scope,
       token_type = excluded.token_type,
       status = 'connected',
       disconnected_at = null,
       expiry_date = excluded.expiry_date,
       updated_at = now()`,
    [
      email,
      normalizedActor.userId,
      normalizedActor.userEmail,
      googleUserId,
      encryptText(tokens.access_token),
      encryptText(refreshToken),
      tokens.scope || '',
      tokens.token_type || 'Bearer',
      tokens.expiry_date || Date.now(),
    ],
  );
}

export function getMissingGmailScopes(scope = '') {
  const grantedScopes = normalizeGrantedScopes(scope);
  return GMAIL_SCOPES.filter((requiredScope) => !hasScope(grantedScopes, requiredScope));
}

export function getMissingTrashScopes(scope = '') {
  const grantedScopes = normalizeGrantedScopes(scope);
  return GMAIL_TRASH_SCOPES.filter((requiredScope) => !hasScope(grantedScopes, requiredScope));
}

export function createOAuthClient() {
  ensureGmailOAuthConfig();
  return new google.auth.OAuth2(
    gmailConfig.google.clientId,
    gmailConfig.google.clientSecret,
    gmailConfig.google.redirectUri,
  );
}

export async function createOAuthState(requestedEmail, actor = {}) {
  const normalizedActor = normalizeActor(actor);
  const state = crypto.randomBytes(24).toString('hex');
  await query(
    'insert into oauth_states (state, requested_email, user_id, user_email) values ($1, $2, $3, $4)',
    [state, requestedEmail, normalizedActor.userId, normalizedActor.userEmail],
  );
  return state;
}

export async function consumeOAuthState(state) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `select *
       from oauth_states
       where state = $1
         and consumed_at is null
         and created_at > now() - interval '15 minutes'
       for update`,
      [state],
    );

    if (result.rowCount === 0) {
      const error = new Error('OAuth state invalido ou expirado.');
      error.status = 400;
      throw error;
    }

    await client.query('update oauth_states set consumed_at = now() where state = $1', [state]);
    return result.rows[0];
  });
}

export async function getAuthUrl(requestedEmail = gmailConfig.google.allowedAccount, actor = {}) {
  ensureAllowedAccount(requestedEmail);
  const oauth2Client = createOAuthClient();
  const state = await createOAuthState(requestedEmail, actor);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...GMAIL_SCOPES, ...GMAIL_TRASH_SCOPES],
    state,
    login_hint: requestedEmail,
  });
}

export async function exchangeCodeForAccount(code, state) {
  const stateRow = await consumeOAuthState(state);
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const email = profile.data.emailAddress || '';

  ensureAllowedAccount(email);

  if (stateRow.requested_email && email !== stateRow.requested_email) {
    const error = new Error(`Conta conectada difere da solicitada: ${email}`);
    error.status = 403;
    throw error;
  }

  await upsertAccountTokens(email, profile.data.historyId || null, tokens, {
    userId: stateRow.user_id,
    userEmail: stateRow.user_email,
  });
  await logEvent(email, 'oauth', 'Conta Gmail conectada via OAuth 2.0', {
    scope: tokens.scope,
  }, 'info', stateRow.user_id || null);

  return email;
}

export async function listAccounts(actor = {}) {
  const normalizedActor = normalizeActor(actor);
  let result = normalizedActor.userId
    ? await query(
        `select email, user_id, user_email, scope, status, disconnected_at, expiry_date, connected_at, updated_at
         from gmail_accounts
         where refresh_token_enc is not null and user_id = $1
         order by connected_at desc`,
        [normalizedActor.userId],
      )
    : await query(
        `select email, user_id, user_email, scope, status, disconnected_at, expiry_date, connected_at, updated_at
         from gmail_accounts
         where refresh_token_enc is not null
         order by connected_at desc`,
      );

  // This application works with a single allowed Gmail account. If the current
  // actor has no direct binding yet, expose the shared connected account so a
  // second workstation/session can reuse the existing refresh token.
  if (result.rowCount === 0 && gmailConfig.google.allowedAccount) {
    result = await query(
      `select email, user_id, user_email, scope, status, disconnected_at, expiry_date, connected_at, updated_at
       from gmail_accounts
       where refresh_token_enc is not null and lower(email) = $1
       order by connected_at desc
       limit 1`,
      [String(gmailConfig.google.allowedAccount).trim().toLowerCase()],
    );
  }

  return result.rows.map((account) => {
    const missingScopes = getMissingGmailScopes(account.scope);
    const missingTrashScopes = getMissingTrashScopes(account.scope);

    return {
      ...account,
      missingScopes,
      needsReconnect: missingScopes.length > 0,
      missingTrashScopes,
      needsTrashReconnect: missingTrashScopes.length > 0,
    };
  });
}

export async function getAccountStatus(accountEmail, actor = {}) {
  const account = await findAccountRecord(accountEmail, actor);

  if (!account || !account.refresh_token_enc) {
    return { connected: false };
  }

  const missingScopes = getMissingGmailScopes(account.scope);
  const missingTrashScopes = getMissingTrashScopes(account.scope);

  return {
    connected: true,
    email: account.email,
    scope: account.scope,
    userId: account.user_id || null,
    status: account.status || 'connected',
    missingScopes,
    needsReconnect: missingScopes.length > 0,
    missingTrashScopes,
    needsTrashReconnect: missingTrashScopes.length > 0,
  };
}

export async function disconnectAccount(accountEmail, actor = {}) {
  const account = await findAccountRecord(accountEmail, actor);
  if (!account) {
    const error = new Error('Conta Gmail nao encontrada para o usuario atual.');
    error.status = 404;
    throw error;
  }

  await query(
    `update gmail_accounts
     set access_token_enc = null,
         refresh_token_enc = null,
         status = 'disconnected',
         disconnected_at = now(),
         updated_at = now()
     where email = $1`,
    [account.email],
  );

  await logEvent(account.email, 'oauth', 'Conta Gmail desconectada (tokens removidos)', {}, 'info', account.user_id || null);
  return { success: true };
}

export async function getAuthedGmail(accountEmail, actorOrOptions = {}, maybeOptions = {}) {
  const actor = maybeOptions && Object.keys(maybeOptions).length > 0 ? actorOrOptions : {};
  const options = maybeOptions && Object.keys(maybeOptions).length > 0 ? maybeOptions : actorOrOptions;
  ensureAllowedAccount(accountEmail);
  ensureGmailOAuthConfig();

  const account = await findAccountRecord(accountEmail, actor);
  if (!account) {
    const error = new Error('Conta Gmail nao conectada.');
    error.status = 404;
    error.code = 'gmail_account_not_connected';
    throw error;
  }

  const missingScopes = options.allowTrashOnly
    ? getMissingTrashScopes(account.scope)
    : getMissingGmailScopes(account.scope);

  if (missingScopes.length > 0) {
    throw buildInsufficientScopeError(missingScopes);
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptText(account.access_token_enc),
    refresh_token: decryptText(account.refresh_token_enc),
    expiry_date: account.expiry_date ? new Date(account.expiry_date).getTime() : undefined,
    scope: account.scope,
    token_type: account.token_type,
  });

  oauth2Client.on('tokens', async (tokens) => {
    try {
      await upsertAccountTokens(accountEmail, account.google_user_id, tokens);
    } catch (error) {
      console.error('Falha ao atualizar tokens do Gmail:', error);
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function listMessages(accountEmail, { folder = 'inbox', maxResults = 25, pageToken, ...filters }, actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  const labelId = folderToLabel(folder);
  const q = buildSearchQuery(filters, folder);

  const list = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [labelId],
    maxResults: Number(maxResults),
    pageToken,
    q,
  });

  const messages = await Promise.all(
    (list.data.messages || []).map(async (message) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });

      return toMessageSummary(detail.data);
    }),
  );

  return {
    messages,
    nextPageToken: list.data.nextPageToken || null,
    resultSizeEstimate: list.data.resultSizeEstimate || 0,
  };
}

export async function listDrafts(accountEmail, { maxResults = 25, pageToken, ...filters } = {}, actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  const q = buildSearchQuery(filters, 'drafts');
  const list = await gmail.users.drafts.list({
    userId: 'me',
    maxResults: Number(maxResults),
    pageToken,
    q: q || undefined,
  });

  const drafts = await Promise.all(
    (list.data.drafts || []).map(async (draft) => {
      const detail = await gmail.users.drafts.get({
        userId: 'me',
        id: draft.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });

      const message = detail.data.message || {};
      const summary = toMessageSummary(message);

      return {
        ...summary,
        id: summary.id || message.id || detail.data.id || draft.id,
        draftId: detail.data.id || draft.id,
        gmailMessageId: message.id || summary.id || '',
      };
    }),
  );

  return {
    drafts: drafts.filter((draft) => draft.gmailMessageId && !draft.labelIds?.includes('TRASH')),
    nextPageToken: list.data.nextPageToken || null,
    resultSizeEstimate: list.data.resultSizeEstimate || drafts.length,
  };
}

export async function getMessage(accountEmail, messageId, actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  let detail = null;
  let isDraft = false;
  let realMessageId = messageId;
  let draftId = null;

  if (String(messageId).startsWith('r')) {
    isDraft = true;
    draftId = messageId;
  }

  if (isDraft) {
    try {
      const draft = await gmail.users.drafts.get({
        userId: 'me',
        id: draftId,
        format: 'full',
      });
      detail = { data: draft.data.message };
      realMessageId = draft.data.message?.id || messageId;
      detail.data.draftId = draftId;
    } catch (err) {
      isDraft = false;
    }
  }

  if (!isDraft) {
    try {
      detail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      if (detail.data.labelIds?.includes('DRAFT')) {
        const list = await gmail.users.drafts.list({ userId: 'me' });
        const foundDraft = (list.data.drafts || []).find((d) => d.message?.id === messageId);
        if (foundDraft) {
          detail.data.draftId = foundDraft.id;
        }
      }
    } catch (err) {
      const list = await gmail.users.drafts.list({ userId: 'me' });
      const foundDraft = (list.data.drafts || []).find((d) => d.message?.id === messageId);
      if (foundDraft) {
        const draft = await gmail.users.drafts.get({
          userId: 'me',
          id: foundDraft.id,
          format: 'full',
        });
        detail = { data: draft.data.message };
        detail.data.draftId = foundDraft.id;
        realMessageId = draft.data.message?.id || messageId;
      } else {
        throw err;
      }
    }
  }

  await hydrateMessagePartBodies(gmail, realMessageId, detail.data.payload);
  await hydrateInlineAttachmentBodies(gmail, realMessageId, detail.data.payload);

  const parsed = toFullMessage(detail.data);
  if (detail.data.draftId) {
    parsed.draftId = detail.data.draftId;
  }

  await saveMessageMetadata(accountEmail, detail.data);
  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'read', 'Mensagem visualizada', { messageId }, 'info', normalizedActor.userId);
  return parsed;
}

export async function downloadAttachment(accountEmail, messageId, attachmentId, actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  let realMessageId = messageId;

  if (String(messageId).startsWith('r')) {
    try {
      const draft = await gmail.users.drafts.get({ userId: 'me', id: messageId });
      realMessageId = draft.data.message?.id || messageId;
    } catch (err) {
      // ignore
    }
  }

  const result = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: realMessageId,
    id: attachmentId,
  });

  return Buffer.from(
    String(result.data.data || '').replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
}

export async function sendMessage(accountEmail, payload, files = [], actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  const raw = createRawMessage({
    from: accountEmail,
    ...payload,
    files,
  });

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'send', 'E-mail enviado', {
    messageId: result.data.id,
    to: payload.to,
    subject: payload.subject,
    attachments: files.length,
  }, 'info', normalizedActor.userId);

  return result.data;
}

export async function createDraft(accountEmail, payload, files = [], actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  const raw = createRawMessage({
    from: accountEmail,
    ...payload,
    files,
  });

  const result = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw },
    },
  });

  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'draft', 'Rascunho criado', {
    draftId: result.data.id,
    to: payload.to,
    subject: payload.subject,
    attachments: files.length,
  }, 'info', normalizedActor.userId);

  return result.data;
}

export async function modifyMessage(accountEmail, messageId, action, actor = {}) {
  const gmail = await getAuthedGmail(accountEmail, actor);
  const map = {
    mark_read: { removeLabelIds: ['UNREAD'] },
    mark_unread: { addLabelIds: ['UNREAD'] },
    archive: { removeLabelIds: ['INBOX'] },
  };

  let result;

  if (action === 'trash') {
    result = await gmail.users.messages.trash({ userId: 'me', id: messageId });
  } else if (action === 'restore') {
    const untrashed = await gmail.users.messages.untrash({ userId: 'me', id: messageId });
    const labelIds = new Set(untrashed.data.labelIds || []);
    const hasMailboxPlacement =
      labelIds.has('INBOX') ||
      labelIds.has('SENT') ||
      labelIds.has('DRAFT');

    result = hasMailboxPlacement
      ? untrashed
      : await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { addLabelIds: ['INBOX'] },
        });
  } else if (action in map) {
    result = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: map[action],
    });
  } else {
    const error = new Error('Acao de mensagem invalida.');
    error.status = 400;
    throw error;
  }

  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'message_action', 'Acao aplicada na mensagem', {
    messageId,
    action,
  }, 'info', normalizedActor.userId);

  return result.data;
}

export async function emptyTrash(accountEmail, actor = {}) {
  const status = await getAccountStatus(accountEmail, actor);
  const missingScopes = getMissingTrashScopes(status.scope || '');
  if (missingScopes.length > 0) {
    throw buildInsufficientScopeError(missingScopes);
  }

  const gmail = await getAuthedGmail(accountEmail, actor, { allowTrashOnly: true });
  let deletedCount = 0;
  let pageToken;

  do {
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['TRASH'],
      maxResults: 500,
      pageToken,
    });

    const ids = (list.data.messages || []).map((message) => message.id).filter(Boolean);
    if (ids.length > 0) {
      await gmail.users.messages.batchDelete({
        userId: 'me',
        requestBody: { ids },
      });
      deletedCount += ids.length;
    }

    pageToken = list.data.nextPageToken || undefined;
  } while (pageToken);

  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'trash', 'Lixeira esvaziada', { deletedCount }, 'info', normalizedActor.userId);
  return { deletedCount };
}

export async function getAuthedPeople(accountEmail, actorOrOptions = {}, maybeOptions = {}) {
  const actor = maybeOptions && Object.keys(maybeOptions).length > 0 ? actorOrOptions : {};
  ensureAllowedAccount(accountEmail);
  ensureGmailOAuthConfig();

  const account = await findAccountRecord(accountEmail, actor);
  if (!account) {
    const error = new Error('Conta Gmail nao conectada.');
    error.status = 404;
    error.code = 'gmail_account_not_connected';
    throw error;
  }

  const missingScopes = getMissingGmailScopes(account.scope);
  if (missingScopes.length > 0) {
    throw buildInsufficientScopeError(missingScopes);
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptText(account.access_token_enc),
    refresh_token: decryptText(account.refresh_token_enc),
    expiry_date: account.expiry_date ? new Date(account.expiry_date).getTime() : undefined,
    scope: account.scope,
    token_type: account.token_type,
  });

  oauth2Client.on('tokens', async (tokens) => {
    try {
      await upsertAccountTokens(accountEmail, account.google_user_id, tokens);
    } catch (error) {
      console.error('Falha ao atualizar tokens do Gmail:', error);
    }
  });

  return google.people({ version: 'v1', auth: oauth2Client });
}

export async function listExistingContacts(accountEmail, actor = {}) {
  const people = await getAuthedPeople(accountEmail, actor);
  const existingPhones = new Set();
  let pageToken;

  do {
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'phoneNumbers',
      pageToken,
    });

    const connections = response.data.connections || [];
    for (const person of connections) {
      if (person.phoneNumbers) {
        for (const phone of person.phoneNumbers) {
          if (phone.value) {
            const digits = phone.value.replace(/\D/g, '');
            if (digits) existingPhones.add(digits);
          }
        }
      }
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return existingPhones;
}

export async function importContactsToGoogle(accountEmail, contactsToImport, actor = {}) {
  const people = await getAuthedPeople(accountEmail, actor);
  let importedCount = 0;

  for (const contact of contactsToImport) {
    try {
      await people.people.createContact({
        requestBody: {
          names: [
            {
              givenName: contact.name,
            },
          ],
          phoneNumbers: contact.phone ? [
            {
              value: contact.phone,
              type: 'mobile',
            },
          ] : [],
        },
      });
      importedCount++;
      // Atraso de 250ms para não estourar a cota da Google People API
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (err) {
      console.error(`Falha ao importar contato ${contact.name}:`, err.message);
    }
  }

  const normalizedActor = normalizeActor(actor);
  await logEvent(accountEmail, 'import_contacts', 'Contatos importados', { importedCount }, 'info', normalizedActor.userId);

  return { importedCount };
}
