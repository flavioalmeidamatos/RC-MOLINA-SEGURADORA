import express from 'express';
import multer from 'multer';
import {
  createDraft,
  disconnectAccount,
  downloadAttachment,
  emptyTrash,
  exchangeCodeForAccount,
  getAccountStatus,
  getAuthUrl,
  getAuthedGmail,
  getMessage,
  listAccounts,
  listDrafts,
  listMessages,
  modifyMessage,
  sendMessage,
  listExistingContacts,
  importContactsToGoogle,
} from './gmail_service.js';
import { logEvent, query, withTransaction } from './gmail_db.js';
import { gmailConfig } from './gmail_config.js';
import { normalizeUploadedFiles, normalizeUtf8Text } from './gmail_text_encoding.js';
import { validateRecipientFields } from './gmail_email_address.js';
import {
  isMicrosoftEmail,
  listMicrosoftMessages,
  getMicrosoftMessage,
  downloadMicrosoftAttachment,
  sendMicrosoftMessage,
  modifyMicrosoftMessage,
  createMicrosoftDraft,
  sendMicrosoftDraft,
  deleteMicrosoftDraft
} from './microsoft_service.js';


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
});

const MAX_TRANSMISSION_BYTES = 25 * 1024 * 1024;
const OUTBOX_STATUS_FILTER = "('pending', 'failed', 'sending')";
export const gmailRouter = express.Router();

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function registerRoute(method, paths, ...stack) {
  const routePaths = Array.isArray(paths) ? paths : [paths];
  const handlers = [...stack];
  const finalHandler = handlers.pop();

  for (const routePath of routePaths) {
    gmailRouter[method](routePath, ...handlers, asyncRoute(finalHandler));
  }
}

function accountEmailFrom(req) {
  return (
    req.body?.accountEmail ||
    req.query?.accountEmail ||
    req.headers['x-gmail-account'] ||
    gmailConfig.google.allowedAccount
  );
}

function requestActorFrom(req) {
  return {
    userId: String(
      req.headers['x-rcm-user-id'] ||
      req.body?.userId ||
      req.query?.userId ||
      '',
    ).trim() || null,
    userEmail: String(
      req.headers['x-rcm-user-email'] ||
      req.body?.userEmail ||
      req.query?.userEmail ||
      '',
    ).trim().toLowerCase() || null,
  };
}

function requireAccountEmail(req) {
  const accountEmail = String(accountEmailFrom(req) || '');
  if (!accountEmail) {
    const error = new Error('Email nao especificado.');
    error.status = 400;
    throw error;
  }

  return accountEmail;
}

function requireOauthCallbackParams(req) {
  const { code, state } = req.query;

  if (!code || !state) {
    const error = new Error('Callback OAuth sem code ou state.');
    error.status = 400;
    throw error;
  }

  return {
    code: String(code),
    state: String(state),
  };
}

function encodeHeaderParameter(value = '') {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function asciiFilenameFallback(value = '') {
  const sanitized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_')
    .trim();

  return sanitized || 'attachment';
}

function stripHtmlToText(value = '') {
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mailPayloadFromBody(body) {
  const recipients = validateRecipientFields({
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
  });
  const bodyHtml = body.html || body.bodyHtml || '';
  const bodyText = body.text || body.bodyText || stripHtmlToText(bodyHtml);

  return {
    to: recipients.recipients.to,
    cc: recipients.recipients.cc,
    bcc: recipients.recipients.bcc,
    subject: body.subject || '',
    text: bodyText,
    html: bodyHtml,
  };
}

function buildRecipientValidationMessage(invalidByField) {
  const labels = { to: 'Para', cc: 'Cc', bcc: 'Cco' };
  const invalidFields = Object.entries(invalidByField).map(
    ([field, values]) => `${labels[field] || field}: ${values.join(', ')}`,
  );
  return `Endereços de e-mail inválidos. Corrija os campos ${invalidFields.join(' | ')}.`;
}

function assertValidRecipients(body, options = {}) {
  const recipients = validateRecipientFields({
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
  });

  if (options.requireTo && recipients.recipients.to.length === 0) {
    const error = new Error('Informe pelo menos um destinatário em Para.');
    error.status = 400;
    throw error;
  }

  if (recipients.invalid.length > 0) {
    const error = new Error(buildRecipientValidationMessage(recipients.invalidByField));
    error.status = 400;
    throw error;
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${Math.max(1, Math.round(value / (1024 * 1024)))} MB`;
}

function estimateTransmissionBytes(payload, files = []) {
  const subjectBytes = Buffer.byteLength(payload.subject || '', 'utf8');
  const textBytes = Buffer.byteLength(payload.text || '', 'utf8');
  const htmlBytes = Buffer.byteLength(payload.html || '', 'utf8');
  const attachmentBytes = files.reduce(
    (total, file) => total + Number(file.size || file.buffer?.length || 0),
    0,
  );

  return subjectBytes + textBytes + htmlBytes + attachmentBytes;
}

function assertTransmissionCapacity(payload, files = []) {
  const estimatedBytes = estimateTransmissionBytes(payload, files);
  if (estimatedBytes <= MAX_TRANSMISSION_BYTES) return;

  const hasVideo = files.some((file) => String(file.mimetype || '').startsWith('video/'));
  const subject = hasVideo ? 'O video selecionado' : 'O conteudo do e-mail';
  const error = new Error(
    `${subject} excede a capacidade de transmissão. Tamanho estimado: ${formatBytes(estimatedBytes)}. Limite atual: ${formatBytes(MAX_TRANSMISSION_BYTES)}. Reduza o arquivo ou envie um link.`,
  );
  error.status = 400;
  error.code = 'message_too_large';
  error.details = {
    estimatedTransmissionBytes: estimatedBytes,
    maxTransmissionBytes: MAX_TRANSMISSION_BYTES,
  };
  throw error;
}

function listMessagesOptions(req, folder) {
  return {
    folder,
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    content: req.query.q || req.query.content,
    after: req.query.after,
    before: req.query.before,
    status: req.query.status,
    hasAttachment: req.query.hasAttachment,
  };
}

function folderFromQuery(req) {
  const folder = String(req.query.folder || 'inbox');
  return ['inbox', 'sent', 'trash'].includes(folder) ? folder : 'inbox';
}

async function listEmailLogs(accountEmail, actor) {
  const result = await query(
    actor.userId
      ? 'select * from email_logs where account_email = $1 and user_id = $2 order by created_at desc limit 50'
      : 'select * from email_logs where account_email = $1 order by created_at desc limit 50',
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );

  return result.rows;
}

async function listOutboxMessages(accountEmail, actor) {
  const result = await query(
    actor.userId
      ? `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
           join gmail_accounts g on g.email = o.account_email
          where o.account_email = $1
            and g.user_id = $2
            and o.status in ${OUTBOX_STATUS_FILTER}
          order by o.created_at desc`
      : `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
          where account_email = $1
            and status in ${OUTBOX_STATUS_FILTER}
          order by created_at desc`,
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );

  return result.rows;
}

async function createOutboxMessage(req) {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  assertValidRecipients(req.body, { requireTo: true });

  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);

  const outboxResult = await query(
    `insert into email_outbox (
       account_email, to_recipients, cc_recipients, bcc_recipients, subject, body_text, body_html
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [accountEmail, payload.to, payload.cc, payload.bcc, payload.subject, payload.text, payload.html],
  );

  const outboxMessage = outboxResult.rows[0];

  for (const file of files) {
    await query(
      `insert into email_outbox_attachments (
         outbox_id, filename, mime_type, content, size_bytes
       )
       values ($1, $2, $3, $4, $5)`,
      [outboxMessage.id, file.originalname, file.mimetype, file.buffer, file.size],
    );
  }

  await logEvent(accountEmail, 'send', 'Mensagem adicionada à caixa de saída local', {
    outboxId: outboxMessage.id,
    attachmentCount: files.length,
  }, 'info', actor.userId);

  return {
    ...outboxMessage,
    attachment_count: files.length,
  };
}

async function sendOutboxMessage(req) {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  const itemResult = await query(
    'select * from email_outbox where id = $1 and account_email = $2',
    [req.params.id, accountEmail],
  );

  if (itemResult.rowCount === 0) {
    return { status: 404, body: { error: 'Mensagem não encontrada na caixa de saída.' } };
  }

  const item = itemResult.rows[0];
  if (!['pending', 'failed'].includes(item.status)) {
    return {
      status: 400,
      body: { error: `Mensagem nao pode ser enviada com status: ${item.status}` },
    };
  }

  const attachmentsResult = await query(
    `select filename as originalname, mime_type as mimetype, content as buffer, size_bytes as size
       from email_outbox_attachments
      where outbox_id = $1`,
    [req.params.id],
  );

  const files = normalizeUploadedFiles(attachmentsResult.rows);

  await query(
    "update email_outbox set status = 'sending', updated_at = now() where id = $1",
    [req.params.id],
  );

  try {
    let sent;
    if (isMicrosoftEmail(accountEmail)) {
      sent = await sendMicrosoftMessage(accountEmail, {
        to: item.to_recipients,
        cc: item.cc_recipients,
        bcc: item.bcc_recipients,
        subject: item.subject,
        text: item.body_text,
        html: item.body_html,
      }, files);
    } else {
      sent = await sendMessage(accountEmail, {
        to: item.to_recipients,
        cc: item.cc_recipients,
        bcc: item.bcc_recipients,
        subject: item.subject,
        text: item.body_text,
        html: item.body_html,
      }, files, actor);
    }

    const updated = await query(
      `update email_outbox
          set status = 'sent',
              gmail_message_id = $1,
              sent_at = now(),
              updated_at = now(),
              error_message = null
        where id = $2
    returning *`,
      [sent.id, req.params.id],
    );

    return { status: 200, body: { outboxMessage: updated.rows[0] } };
  } catch (error) {
    await query(
      `update email_outbox
          set status = 'failed',
              error_message = $1,
              updated_at = now()
        where id = $2`,
      [error.message, req.params.id],
    );
    throw error;
  }
}

async function sendDraft(req) {
  const accountEmail = requireAccountEmail(req);
  if (isMicrosoftEmail(accountEmail)) {
    return await sendMicrosoftDraft(accountEmail, req.params.id);
  }
  const gmail = await getAuthedGmail(accountEmail, requestActorFrom(req));
  const result = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: req.params.id },
  });

  return { message: result.data };
}

async function deleteDraft(req) {
  const accountEmail = requireAccountEmail(req);
  if (isMicrosoftEmail(accountEmail)) {
    return await deleteMicrosoftDraft(accountEmail, req.params.id);
  }
  const gmail = await getAuthedGmail(accountEmail, requestActorFrom(req));
  let draftId = req.params.id;
  let messageId = null;

  try {
    const draft = await gmail.users.drafts.get({ userId: 'me', id: draftId });
    messageId = draft.data.message?.id;
  } catch (err) {
    const list = await gmail.users.drafts.list({ userId: 'me' });
    const draft = (list.data.drafts || []).find((d) => d.message?.id === draftId);
    if (draft) {
      draftId = draft.id;
      messageId = draft.message?.id;
    }
  }

  if (messageId) {
    await gmail.users.messages.trash({ userId: 'me', id: messageId });
  } else {
    try {
      await gmail.users.messages.trash({ userId: 'me', id: req.params.id });
    } catch (e) {
      await gmail.users.drafts.delete({ userId: 'me', id: draftId });
    }
  }
  return { success: true };
}

async function modifyMessageResponse(req, action) {
  const accountEmail = requireAccountEmail(req);
  if (isMicrosoftEmail(accountEmail)) {
    return {
      message: await modifyMicrosoftMessage(accountEmail, req.params.id, action),
    };
  }
  return {
    message: await modifyMessage(accountEmail, req.params.id, action, requestActorFrom(req)),
  };
}

registerRoute('get', ['/email/auth/google', '/gmail/auth/url'], async (req, res) => {
  const requestedEmail = String(req.query.email || gmailConfig.google.allowedAccount || '');
  res.json({ url: await getAuthUrl(requestedEmail, requestActorFrom(req)) });
});

registerRoute('get', ['/auth/google/callback', '/gmail/callback'], async (req, res) => {
  const { code, state } = requireOauthCallbackParams(req);
  const email = await exchangeCodeForAccount(code, state);
  res.redirect(`/email/inbox?webmail=connected&account=${encodeURIComponent(email)}`);
});

registerRoute('get', ['/email/auth/status', '/gmail/status'], async (req, res) => {
  const email = String(accountEmailFrom(req) || '').trim().toLowerCase();
  if (email.endsWith('@hotmail.com') || email.endsWith('@outlook.com') || email.endsWith('@live.com')) {
    const actor = requestActorFrom(req);
    const result = await query(
      `select * from user_email_integrations 
       where provider = 'microsoft' 
         and (lower(provider_email) = $1 or lower(user_email) = $1 or user_email = $2)
       limit 1`,
      [email, actor.userEmail || '']
    );
    if (result.rowCount > 0) {
      const integration = result.rows[0];
      return res.json({
        connected: integration.status === 'connected',
        email: integration.provider_email,
        scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite',
        userId: actor.userId,
        status: integration.status,
        missingScopes: [],
        needsReconnect: false,
        missingTrashScopes: [],
        needsTrashReconnect: false
      });
    } else {
      return res.json({ connected: false });
    }
  }
  res.json(await getAccountStatus(email, requestActorFrom(req)));
});

registerRoute('post', ['/email/auth/disconnect', '/gmail/disconnect'], async (req, res) => {
  const email = String(requireAccountEmail(req) || '').trim().toLowerCase();
  if (email.endsWith('@hotmail.com') || email.endsWith('@outlook.com') || email.endsWith('@live.com')) {
    const actor = requestActorFrom(req);
    await query(
      `update user_email_integrations 
       set status = 'disconnected', 
           access_token = '', 
           refresh_token = '', 
           updated_at = now() 
       where provider = 'microsoft' 
         and (lower(provider_email) = $1 or lower(user_email) = $1 or user_email = $2)`,
      [email, actor.userEmail || '']
    );
    return res.json({ success: true });
  }
  res.json(await disconnectAccount(email, requestActorFrom(req)));
});

registerRoute('get', ['/email/accounts', '/gmail/accounts'], async (req, res) => {
  const actor = requestActorFrom(req);
  const gmailAccounts = await listAccounts(actor);

  const msResult = await query(
    `select provider_email as email, status, expires_at as expiry_date, created_at as connected_at, updated_at 
     from user_email_integrations 
     where provider = 'microsoft' 
       and (user_email = $1 or provider_email = $1)`,
    [actor.userEmail || '']
  );

  const msAccounts = msResult.rows.map((row) => ({
    email: row.email,
    scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite',
    status: row.status,
    expiry_date: row.expiry_date ? row.expiry_date.toISOString() : new Date().toISOString(),
    connected_at: row.connected_at ? row.connected_at.toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    missingScopes: [],
    needsReconnect: false,
    missingTrashScopes: [],
    needsTrashReconnect: false,
  }));

  res.json({ accounts: [...gmailAccounts, ...msAccounts] });
});

registerRoute('get', ['/email/logs', '/gmail/logs'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  res.json({ logs: await listEmailLogs(accountEmail, actor) });
});

registerRoute('get', '/email/inbox', async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const options = {
    ...listMessagesOptions(req, 'inbox'),
    content: req.query.content,
    status: req.query.status || (req.query.unread === 'true' ? 'unread' : undefined),
  };
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, options));
  }
  res.json(await listMessages(accountEmail, options, requestActorFrom(req)));
});

registerRoute('get', '/email/sent', async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const options = {
    ...listMessagesOptions(req, 'sent'),
    content: req.query.content,
  };
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, options));
  }
  res.json(await listMessages(accountEmail, options, requestActorFrom(req)));
});

registerRoute('get', '/email/trash', async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const options = {
    ...listMessagesOptions(req, 'trash'),
    content: req.query.content,
  };
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, options));
  }
  res.json(await listMessages(accountEmail, options, requestActorFrom(req)));
});

registerRoute('get', '/email/search', async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const options = {
    ...listMessagesOptions(req, 'inbox'),
    content: req.query.q || req.query.content,
  };
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, options));
  }
  res.json(await listMessages(accountEmail, options, requestActorFrom(req)));
});

registerRoute('get', '/gmail/messages', async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const folder = folderFromQuery(req);
  const options = listMessagesOptions(req, folder);
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, options));
  }
  res.json(await listMessages(accountEmail, options, requestActorFrom(req)));
});


registerRoute('get', ['/email/outbox', '/gmail/outbox'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  res.json({ outbox: await listOutboxMessages(accountEmail, actor) });
});

registerRoute('post', ['/email/outbox', '/gmail/outbox'], upload.array('attachments'), async (req, res) => {
  res.status(201).json({ outboxMessage: await createOutboxMessage(req) });
});

registerRoute('post', ['/email/outbox/:id/send', '/gmail/outbox/:id/send'], async (req, res) => {
  const result = await sendOutboxMessage(req);
  res.status(result.status).json(result.body);
});

registerRoute('delete', ['/email/outbox/:id', '/gmail/outbox/:id'], async (req, res) => {
  await query('delete from email_outbox where id = $1 and account_email = $2', [
    req.params.id,
    requireAccountEmail(req),
  ]);
  res.json({ success: true });
});

registerRoute('get', ['/email/messages/:id', '/gmail/messages/:id'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  if (isMicrosoftEmail(accountEmail)) {
    return res.json({
      message: await getMicrosoftMessage(accountEmail, req.params.id)
    });
  }
  res.json({
    message: await getMessage(accountEmail, req.params.id, requestActorFrom(req)),
  });
});

registerRoute('post', '/email/send', upload.none(), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  assertTransmissionCapacity(payload, []);
  if (isMicrosoftEmail(accountEmail)) {
    return res.status(201).json({
      message: await sendMicrosoftMessage(accountEmail, payload, [])
    });
  }
  res.status(201).json({
    message: await sendMessage(accountEmail, payload, [], requestActorFrom(req)),
  });
});

registerRoute('post', '/email/send-with-attachments', upload.array('attachments'), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  if (isMicrosoftEmail(accountEmail)) {
    return res.status(201).json({
      message: await sendMicrosoftMessage(accountEmail, payload, files)
    });
  }
  res.status(201).json({
    message: await sendMessage(accountEmail, payload, files, requestActorFrom(req)),
  });
});

registerRoute('post', '/gmail/send', upload.array('attachments'), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  if (isMicrosoftEmail(accountEmail)) {
    return res.status(201).json({
      message: await sendMicrosoftMessage(accountEmail, payload, files)
    });
  }
  res.status(201).json({
    message: await sendMessage(accountEmail, payload, files, requestActorFrom(req)),
  });
});

registerRoute('get', ['/email/messages/:messageId/attachments', '/gmail/messages/:messageId/attachments'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  if (isMicrosoftEmail(accountEmail)) {
    const message = await getMicrosoftMessage(accountEmail, req.params.messageId);
    return res.json({ attachments: message.attachments });
  }
  const message = await getMessage(accountEmail, req.params.messageId, requestActorFrom(req));
  res.json({ attachments: message.attachments });
});

registerRoute('get', ['/email/messages/:messageId/attachments/:attachmentId', '/gmail/messages/:messageId/attachments/:attachmentId'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  let buffer;
  let filename = req.query.filename;
  let mimeType = req.query.mimeType;

  if (isMicrosoftEmail(accountEmail)) {
    const att = await downloadMicrosoftAttachment(
      accountEmail,
      req.params.messageId,
      req.params.attachmentId
    );
    buffer = att.data;
    filename = filename || att.filename;
    mimeType = mimeType || att.mimeType;
  } else {
    buffer = await downloadAttachment(
      accountEmail,
      req.params.messageId,
      req.params.attachmentId,
      requestActorFrom(req),
    );
  }

  filename = normalizeUtf8Text(filename || 'attachment');
  mimeType = mimeType || 'application/octet-stream';
  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  const fallbackFilename = asciiFilenameFallback(filename);
  const encodedFilename = encodeHeaderParameter(String(filename));

  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
  );
  res.send(buffer);
});

registerRoute('get', ['/email/drafts', '/gmail/drafts'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const options = listMessagesOptions(req, 'drafts');
  if (isMicrosoftEmail(accountEmail)) {
    return res.json(await listMicrosoftMessages(accountEmail, { folder: 'drafts', ...options }));
  }
  res.json(await listDrafts(
    accountEmail,
    options,
    requestActorFrom(req),
  ));
});

registerRoute('post', '/email/drafts', upload.array('attachments'), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body);
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  if (isMicrosoftEmail(accountEmail)) {
    return res.status(201).json(await createMicrosoftDraft(accountEmail, payload, files));
  }
  res.status(201).json({
    draft: await createDraft(accountEmail, payload, files, requestActorFrom(req)),
  });
});

registerRoute('post', '/gmail/draft', upload.array('attachments'), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body);
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  if (isMicrosoftEmail(accountEmail)) {
    return res.status(201).json(await createMicrosoftDraft(accountEmail, payload, files));
  }
  res.status(201).json({
    draft: await createDraft(accountEmail, payload, files, requestActorFrom(req)),
  });
});

registerRoute('post', ['/email/drafts/:id/send', '/gmail/drafts/:id/send'], async (req, res) => {
  res.json(await sendDraft(req));
});

registerRoute('delete', ['/email/drafts/:id', '/gmail/drafts/:id'], async (req, res) => {
  res.json(await deleteDraft(req));
});

registerRoute('patch', '/email/messages/:id/read', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'mark_read'));
});

registerRoute('post', '/gmail/messages/:id/read', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'mark_read'));
});

registerRoute('patch', '/email/messages/:id/unread', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'mark_unread'));
});

registerRoute('post', '/gmail/messages/:id/unread', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'mark_unread'));
});

registerRoute('patch', '/email/messages/:id/archive', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'archive'));
});

registerRoute('patch', '/email/messages/:id/trash', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'trash'));
});

registerRoute('patch', '/email/messages/:id/restore', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'restore'));
});

registerRoute('post', ['/email/trash/empty', '/gmail/trash/empty'], async (req, res) => {
  res.json(await emptyTrash(requireAccountEmail(req), requestActorFrom(req)));
});

registerRoute('delete', '/gmail/messages/:id', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'trash'));
});

registerRoute('post', '/gmail/messages/:id/archive', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'archive'));
});

registerRoute('post', '/gmail/messages/:id/trash', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'trash'));
});

registerRoute('post', '/gmail/messages/:id/restore', async (req, res) => {
  res.json(await modifyMessageResponse(req, 'restore'));
});

registerRoute('post', '/email/sync/recent', async (_req, res) => {
  res.json({ success: true, message: 'Sync not implemented yet.' });
});

registerRoute('post', ['/email/import-contacts', '/gmail/import-contacts'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  const { contacts } = req.body;

  if (!Array.isArray(contacts)) {
    const error = new Error('Lista de contatos inválida.');
    error.status = 400;
    throw error;
  }

  const existingPhones = await listExistingContacts(accountEmail, actor);
  
  const validContacts = [];
  const rejectedContacts = [];

  for (const contact of contacts) {
    const nome = contact.name || contact.nome_completo;
    const telefone = contact.phone || contact.celular;

    if (!nome) {
      rejectedContacts.push({ ...contact, reason: 'Falta nome' });
      continue;
    }

    if (!telefone) {
      rejectedContacts.push({ ...contact, reason: 'Falta celular/telefone' });
      continue;
    }

    const rawPhone = String(telefone).trim();
    const digits = rawPhone.replace(/\D/g, '');
    
    // O usuário solicitou "desde que tenha 14 digitos". Assumindo 14 caracteres com o '+' (ex: +5511999999999) ou 14 números
    if (rawPhone.length !== 14 && digits.length !== 14) {
      rejectedContacts.push({ ...contact, reason: 'Telefone não possui 14 caracteres/dígitos' });
      continue;
    }

    if (existingPhones.has(digits)) {
      rejectedContacts.push({ ...contact, reason: 'Telefone já importado' });
      continue;
    }

    // Ensure backwards compatibility for importContactsToGoogle
    contact.name = nome;
    contact.phone = telefone;

    validContacts.push(contact);
    existingPhones.add(digits);
  }

  let importedCount = 0;
  if (validContacts.length > 0) {
    const result = await importContactsToGoogle(accountEmail, validContacts, actor);
    importedCount = result.importedCount;

    try {
      await withTransaction(async (client) => {
        await client.query(`select pg_advisory_xact_lock(hashtext('RCMOLINASEGUROS.CLIENTES.codigo'))`);
        
        const maxResult = await client.query(`
          select coalesce(max(regexp_replace(codigo, '\\D', '', 'g')::integer), 0) as max_codigo
          from "RCMOLINASEGUROS"."CLIENTES"
          where codigo ~ '^\\d{1,7}$'
        `);
        let nextNumber = Number(maxResult.rows[0]?.max_codigo || 0) + 1;

        for (const contact of validContacts) {
          let candidate;
          while (true) {
            candidate = String(nextNumber).padStart(7, '0');
            const exists = await client.query(
              `select 1 from "RCMOLINASEGUROS"."CLIENTES" where codigo = $1 limit 1`,
              [candidate]
            );
            if (exists.rowCount === 0) {
              break;
            }
            nextNumber++;
          }

          const comoConheceu = (contact.name && contact.name.includes('- REMALHO')) ? '6 - Lead' : '0 - Nao informado';

          const clienteResult = await client.query(
            `INSERT INTO "RCMOLINASEGUROS"."CLIENTES" 
             (nome_completo, codigo, status_cliente, como_conheceu, permite_agendar_online, data_cadastro, data_atualizacao, cpf, rg, cnpj, data_nascimento, cep, logradouro, bairro, cidade, uf, observacoes_extras)
             VALUES ($1, $2, 'ATIVO', $13, true, current_date, current_date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id_cliente`,
            [
              contact.name, 
              candidate,
              contact.cpf || null,
              contact.rg || null,
              contact.cnpj || null,
              contact.data_nascimento || null,
              contact.cep || null,
              contact.logradouro || null,
              contact.bairro || null,
              contact.cidade || null,
              contact.uf || null,
              contact.observacoes_extras || null,
              comoConheceu
            ]
          );

          const idCliente = clienteResult.rows[0].id_cliente;

          const rawPhone = String(contact.phone).replace(/\D/g, '');
          const cleanPhone = rawPhone.startsWith('55') && rawPhone.length > 11 ? rawPhone.slice(2) : rawPhone;
          const phoneValue = cleanPhone.length === 11 
            ? `(${cleanPhone.substring(0,2)}) ${cleanPhone.substring(2,7)}-${cleanPhone.substring(7)}`
            : `(${cleanPhone.substring(0,2)}) ${cleanPhone.substring(2,6)}-${cleanPhone.substring(6)}`;

          await client.query(
            `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_CONTATOS"
             (id_cliente, tipo, valor, preferencial)
             VALUES ($1, 'Celular', $2, true)`,
            [idCliente, phoneValue]
          );

          if (contact.email) {
            await client.query(
              `INSERT INTO "RCMOLINASEGUROS"."CLIENTES_CONTATOS"
               (id_cliente, tipo, valor, preferencial)
               VALUES ($1, 'E-mail', $2, false)`,
              [idCliente, String(contact.email).toLowerCase()]
            );
          }
          
          nextNumber++;
        }
      });
    } catch (dbError) {
      console.error('============================');
      console.error('Falha ao importar contatos para o banco local:', dbError);
      console.error('============================');
    }
  }

  res.json({
    success: true,
    importedCount,
    rejectedContacts,
    totalReceived: contacts.length
  });
});

gmailRouter.use(async (error, req, res, _next) => {
  const accountEmail = req.body?.accountEmail || req.query?.accountEmail || null;
  const actor = requestActorFrom(req);

  if (error?.code === 'LIMIT_FILE_SIZE') {
    error.status = 400;
    error.code = 'message_too_large';
    error.message = `O arquivo selecionado excede a capacidade de transmissão. Limite atual: ${Math.round(
      MAX_TRANSMISSION_BYTES / (1024 * 1024),
    )} MB.`;
    error.details = {
      ...(error.details || {}),
      maxTransmissionBytes: MAX_TRANSMISSION_BYTES,
    };
  }

  try {
    await logEvent(accountEmail, 'sync', error.message || 'Erro inesperado no webmail', {
      path: req.path,
      method: req.method,
    }, 'error', actor.userId);
  } catch (logError) {
    console.error('Falha ao registrar erro do webmail:', logError);
  }

  res.status(error.status || 500).json({
    error: error.message || 'Erro interno do servidor',
    code: error.code || undefined,
    details: error.details || undefined,
  });
});
