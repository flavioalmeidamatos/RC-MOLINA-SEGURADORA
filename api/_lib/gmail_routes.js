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
} from './gmail_service.js';
import { logEvent, query } from './gmail_db.js';
import { gmailConfig } from './gmail_config.js';
import { normalizeUploadedFiles, normalizeUtf8Text } from './gmail_text_encoding.js';
import { validateRecipientFields } from './gmail_email_address.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
});

const MAX_TRANSMISSION_BYTES = 25 * 1024 * 1024;
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
  return `Enderecos de e-mail invalidos. Corrija os campos ${invalidFields.join(' | ')}.`;
}

function assertValidRecipients(body, options = {}) {
  const recipients = validateRecipientFields({
    to: body.to,
    cc: body.cc,
    bcc: body.bcc,
  });

  if (options.requireTo && recipients.recipients.to.length === 0) {
    const error = new Error('Informe pelo menos um destinatario em Para.');
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
    `${subject} excede a capacidade de transmissao. Tamanho estimado: ${formatBytes(estimatedBytes)}. Limite atual: ${formatBytes(MAX_TRANSMISSION_BYTES)}. Reduza o arquivo ou envie um link.`,
  );
  error.status = 400;
  error.code = 'message_too_large';
  error.details = {
    estimatedTransmissionBytes: estimatedBytes,
    maxTransmissionBytes: MAX_TRANSMISSION_BYTES,
  };
  throw error;
}

gmailRouter.get('/email/auth/google', asyncRoute(async (req, res) => {
  const requestedEmail = String(req.query.email || gmailConfig.google.allowedAccount || '');
  const url = await getAuthUrl(requestedEmail, requestActorFrom(req));
  res.json({ url });
}));

gmailRouter.get('/gmail/auth/url', asyncRoute(async (req, res) => {
  const requestedEmail = String(req.query.email || gmailConfig.google.allowedAccount || '');
  const url = await getAuthUrl(requestedEmail, requestActorFrom(req));
  res.json({ url });
}));

gmailRouter.get('/auth/google/callback', asyncRoute(async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    const error = new Error('Callback OAuth sem code ou state.');
    error.status = 400;
    throw error;
  }

  const email = await exchangeCodeForAccount(String(code), String(state));
  res.redirect(`/email/inbox?webmail=connected&account=${encodeURIComponent(email)}`);
}));

gmailRouter.get('/gmail/callback', asyncRoute(async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    const error = new Error('Callback OAuth sem code ou state.');
    error.status = 400;
    throw error;
  }

  const email = await exchangeCodeForAccount(String(code), String(state));
  res.redirect(`/email/inbox?webmail=connected&account=${encodeURIComponent(email)}`);
}));

gmailRouter.get('/email/auth/status', asyncRoute(async (req, res) => {
  res.json(await getAccountStatus(String(accountEmailFrom(req) || ''), requestActorFrom(req)));
}));

gmailRouter.get('/gmail/status', asyncRoute(async (req, res) => {
  res.json(await getAccountStatus(String(accountEmailFrom(req) || ''), requestActorFrom(req)));
}));

gmailRouter.post('/email/auth/disconnect', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  if (!accountEmail) {
    return res.status(400).json({ error: 'Email nao especificado.' });
  }

  res.json(await disconnectAccount(accountEmail, requestActorFrom(req)));
}));

gmailRouter.post('/gmail/disconnect', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  if (!accountEmail) {
    return res.status(400).json({ error: 'Email nao especificado.' });
  }

  res.json(await disconnectAccount(accountEmail, requestActorFrom(req)));
}));

gmailRouter.get('/email/accounts', asyncRoute(async (req, res) => {
  res.json({ accounts: await listAccounts(requestActorFrom(req)) });
}));

gmailRouter.get('/gmail/accounts', asyncRoute(async (req, res) => {
  res.json({ accounts: await listAccounts(requestActorFrom(req)) });
}));

gmailRouter.get('/email/logs', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const result = await query(
    actor.userId
      ? 'select * from email_logs where account_email = $1 and user_id = $2 order by created_at desc limit 50'
      : 'select * from email_logs where account_email = $1 order by created_at desc limit 50',
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );
  res.json({ logs: result.rows });
}));

gmailRouter.get('/gmail/logs', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const result = await query(
    actor.userId
      ? 'select * from email_logs where account_email = $1 and user_id = $2 order by created_at desc limit 50'
      : 'select * from email_logs where account_email = $1 order by created_at desc limit 50',
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );
  res.json({ logs: result.rows });
}));

gmailRouter.get('/email/inbox', asyncRoute(async (req, res) => {
  res.json(await listMessages(String(accountEmailFrom(req) || ''), {
    folder: 'inbox',
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    status: req.query.status || (req.query.unread === 'true' ? 'unread' : undefined),
    content: req.query.content,
    after: req.query.after,
    before: req.query.before,
    hasAttachment: req.query.hasAttachment,
  }, requestActorFrom(req)));
}));

gmailRouter.get('/email/sent', asyncRoute(async (req, res) => {
  res.json(await listMessages(String(accountEmailFrom(req) || ''), {
    folder: 'sent',
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    content: req.query.content,
    after: req.query.after,
    before: req.query.before,
    hasAttachment: req.query.hasAttachment,
  }, requestActorFrom(req)));
}));

gmailRouter.get('/email/trash', asyncRoute(async (req, res) => {
  res.json(await listMessages(String(accountEmailFrom(req) || ''), {
    folder: 'trash',
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    content: req.query.content,
    after: req.query.after,
    before: req.query.before,
    hasAttachment: req.query.hasAttachment,
  }, requestActorFrom(req)));
}));

gmailRouter.get('/email/search', asyncRoute(async (req, res) => {
  res.json(await listMessages(String(accountEmailFrom(req) || ''), {
    folder: 'inbox',
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    content: req.query.q || req.query.content,
    after: req.query.after,
    before: req.query.before,
    status: req.query.status,
    hasAttachment: req.query.hasAttachment,
  }, requestActorFrom(req)));
}));

gmailRouter.get('/gmail/messages', asyncRoute(async (req, res) => {
  const folder = String(req.query.folder || 'inbox');
  const normalizedFolder = ['inbox', 'sent', 'trash'].includes(folder) ? folder : 'inbox';
  res.json(await listMessages(String(accountEmailFrom(req) || ''), {
    folder: normalizedFolder,
    maxResults: req.query.maxResults || 25,
    pageToken: req.query.pageToken,
    from: req.query.from,
    subject: req.query.subject,
    content: req.query.q || req.query.content,
    after: req.query.after,
    before: req.query.before,
    status: req.query.status,
    hasAttachment: req.query.hasAttachment,
  }, requestActorFrom(req)));
}));

gmailRouter.get('/email/outbox', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const result = await query(
    actor.userId
      ? `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
           join gmail_accounts g on g.email = o.account_email
          where o.account_email = $1
            and g.user_id = $2
            and o.status in ('pending', 'failed', 'sending')
          order by o.created_at desc`
      : `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
          where account_email = $1
            and status in ('pending', 'failed', 'sending')
          order by created_at desc`,
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );
  res.json({ outbox: result.rows });
}));

gmailRouter.get('/gmail/outbox', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const result = await query(
    actor.userId
      ? `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
           join gmail_accounts g on g.email = o.account_email
          where o.account_email = $1
            and g.user_id = $2
            and o.status in ('pending', 'failed', 'sending')
          order by o.created_at desc`
      : `select o.*,
                (select count(*) from email_outbox_attachments a where a.outbox_id = o.id)::int as attachment_count
           from email_outbox o
          where account_email = $1
            and status in ('pending', 'failed', 'sending')
          order by created_at desc`,
    actor.userId ? [accountEmail, actor.userId] : [accountEmail],
  );
  res.json({ outbox: result.rows });
}));

gmailRouter.post('/email/outbox', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
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

  await logEvent(accountEmail, 'send', 'Mensagem adicionada a caixa de saida local', {
    outboxId: outboxMessage.id,
    attachmentCount: files.length,
  }, 'info', actor.userId);

  res.status(201).json({
    outboxMessage: {
      ...outboxMessage,
      attachment_count: files.length,
    },
  });
}));

gmailRouter.post('/gmail/outbox', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
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

  await logEvent(accountEmail, 'send', 'Mensagem adicionada a caixa de saida local', {
    outboxId: outboxMessage.id,
    attachmentCount: files.length,
  }, 'info', actor.userId);

  res.status(201).json({
    outboxMessage: {
      ...outboxMessage,
      attachment_count: files.length,
    },
  });
}));

gmailRouter.post('/email/outbox/:id/send', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const itemResult = await query(
    `select * from email_outbox where id = $1 and account_email = $2`,
    [req.params.id, accountEmail],
  );

  if (itemResult.rowCount === 0) {
    return res.status(404).json({ error: 'Mensagem nao encontrada na caixa de saida.' });
  }

  const item = itemResult.rows[0];
  if (!['pending', 'failed'].includes(item.status)) {
    return res.status(400).json({
      error: `Mensagem nao pode ser enviada com status: ${item.status}`,
    });
  }

  const attachmentsResult = await query(
    `select filename as originalname, mime_type as mimetype, content as buffer, size_bytes as size
       from email_outbox_attachments
      where outbox_id = $1`,
    [req.params.id],
  );

  const files = normalizeUploadedFiles(attachmentsResult.rows);

  await query(
    `update email_outbox set status = 'sending', updated_at = now() where id = $1`,
    [req.params.id],
  );

  try {
    const sent = await sendMessage(accountEmail, {
      to: item.to_recipients,
      cc: item.cc_recipients,
      bcc: item.bcc_recipients,
      subject: item.subject,
      text: item.body_text,
      html: item.body_html,
    }, files, actor);

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

    res.json({ outboxMessage: updated.rows[0] });
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
}));

gmailRouter.post('/gmail/outbox/:id/send', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const actor = requestActorFrom(req);
  const itemResult = await query(
    `select * from email_outbox where id = $1 and account_email = $2`,
    [req.params.id, accountEmail],
  );

  if (itemResult.rowCount === 0) {
    return res.status(404).json({ error: 'Mensagem nao encontrada na caixa de saida.' });
  }

  const item = itemResult.rows[0];
  if (!['pending', 'failed'].includes(item.status)) {
    return res.status(400).json({
      error: `Mensagem nao pode ser enviada com status: ${item.status}`,
    });
  }

  const attachmentsResult = await query(
    `select filename as originalname, mime_type as mimetype, content as buffer, size_bytes as size
       from email_outbox_attachments
      where outbox_id = $1`,
    [req.params.id],
  );

  const files = normalizeUploadedFiles(attachmentsResult.rows);

  await query(
    `update email_outbox set status = 'sending', updated_at = now() where id = $1`,
    [req.params.id],
  );

  try {
    const sent = await sendMessage(accountEmail, {
      to: item.to_recipients,
      cc: item.cc_recipients,
      bcc: item.bcc_recipients,
      subject: item.subject,
      text: item.body_text,
      html: item.body_html,
    }, files, actor);

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

    res.json({ outboxMessage: updated.rows[0] });
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
}));

gmailRouter.delete('/email/outbox/:id', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  await query('delete from email_outbox where id = $1 and account_email = $2', [
    req.params.id,
    accountEmail,
  ]);
  res.json({ success: true });
}));

gmailRouter.delete('/gmail/outbox/:id', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  await query('delete from email_outbox where id = $1 and account_email = $2', [
    req.params.id,
    accountEmail,
  ]);
  res.json({ success: true });
}));

gmailRouter.get('/email/messages/:id', asyncRoute(async (req, res) => {
  res.json({
    message: await getMessage(String(accountEmailFrom(req) || ''), req.params.id, requestActorFrom(req)),
  });
}));

gmailRouter.get('/gmail/messages/:id', asyncRoute(async (req, res) => {
  res.json({
    message: await getMessage(String(accountEmailFrom(req) || ''), req.params.id, requestActorFrom(req)),
  });
}));

gmailRouter.post('/email/send', upload.none(), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  assertTransmissionCapacity(payload, []);
  const result = await sendMessage(accountEmail, payload, [], requestActorFrom(req));
  res.status(201).json({ message: result });
}));

gmailRouter.post('/email/send-with-attachments', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  const result = await sendMessage(accountEmail, payload, files, requestActorFrom(req));
  res.status(201).json({ message: result });
}));

gmailRouter.post('/gmail/send', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  const result = await sendMessage(accountEmail, payload, files, requestActorFrom(req));
  res.status(201).json({ message: result });
}));

gmailRouter.get('/email/messages/:messageId/attachments', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const message = await getMessage(accountEmail, req.params.messageId, requestActorFrom(req));
  res.json({ attachments: message.attachments });
}));

gmailRouter.get('/gmail/messages/:messageId/attachments', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const message = await getMessage(accountEmail, req.params.messageId, requestActorFrom(req));
  res.json({ attachments: message.attachments });
}));

gmailRouter.get('/email/messages/:messageId/attachments/:attachmentId', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const buffer = await downloadAttachment(
    accountEmail,
    req.params.messageId,
    req.params.attachmentId,
    requestActorFrom(req),
  );

  const filename = normalizeUtf8Text(req.query.filename || 'attachment');
  const mimeType = req.query.mimeType || 'application/octet-stream';
  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  const fallbackFilename = asciiFilenameFallback(filename);
  const encodedFilename = encodeHeaderParameter(String(filename));

  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
  );
  res.send(buffer);
}));

gmailRouter.get('/gmail/messages/:messageId/attachments/:attachmentId', asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  const buffer = await downloadAttachment(
    accountEmail,
    req.params.messageId,
    req.params.attachmentId,
    requestActorFrom(req),
  );

  const filename = normalizeUtf8Text(req.query.filename || 'attachment');
  const mimeType = req.query.mimeType || 'application/octet-stream';
  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  const fallbackFilename = asciiFilenameFallback(filename);
  const encodedFilename = encodeHeaderParameter(String(filename));

  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
  );
  res.send(buffer);
}));

gmailRouter.get('/email/drafts', asyncRoute(async (req, res) => {
  res.json(await listDrafts(
    String(accountEmailFrom(req) || ''),
    { maxResults: req.query.maxResults || 25 },
    requestActorFrom(req),
  ));
}));

gmailRouter.get('/gmail/drafts', asyncRoute(async (req, res) => {
  res.json(await listDrafts(
    String(accountEmailFrom(req) || ''),
    { maxResults: req.query.maxResults || 25 },
    requestActorFrom(req),
  ));
}));

gmailRouter.post('/email/drafts', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  assertValidRecipients(req.body);
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  const result = await createDraft(accountEmail, payload, files, requestActorFrom(req));
  res.status(201).json({ draft: result });
}));

gmailRouter.post('/gmail/draft', upload.array('attachments'), asyncRoute(async (req, res) => {
  const accountEmail = String(accountEmailFrom(req) || '');
  assertValidRecipients(req.body);
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
  const result = await createDraft(accountEmail, payload, files, requestActorFrom(req));
  res.status(201).json({ draft: result });
}));

gmailRouter.post('/email/drafts/:id/send', asyncRoute(async (req, res) => {
  const gmail = await getAuthedGmail(String(accountEmailFrom(req) || ''), requestActorFrom(req));
  const result = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: req.params.id },
  });
  res.json({ message: result.data });
}));

gmailRouter.delete('/email/drafts/:id', asyncRoute(async (req, res) => {
  const gmail = await getAuthedGmail(String(accountEmailFrom(req) || ''), requestActorFrom(req));
  await gmail.users.drafts.delete({ userId: 'me', id: req.params.id });
  res.json({ success: true });
}));

gmailRouter.post('/gmail/drafts/:id/send', asyncRoute(async (req, res) => {
  const gmail = await getAuthedGmail(String(accountEmailFrom(req) || ''), requestActorFrom(req));
  const result = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: req.params.id },
  });
  res.json({ message: result.data });
}));

gmailRouter.delete('/gmail/drafts/:id', asyncRoute(async (req, res) => {
  const gmail = await getAuthedGmail(String(accountEmailFrom(req) || ''), requestActorFrom(req));
  await gmail.users.drafts.delete({ userId: 'me', id: req.params.id });
  res.json({ success: true });
}));

gmailRouter.patch('/email/messages/:id/read', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'mark_read', requestActorFrom(req)),
  });
}));

gmailRouter.post('/gmail/messages/:id/read', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'mark_read', requestActorFrom(req)),
  });
}));

gmailRouter.patch('/email/messages/:id/unread', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'mark_unread', requestActorFrom(req)),
  });
}));

gmailRouter.post('/gmail/messages/:id/unread', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'mark_unread', requestActorFrom(req)),
  });
}));

gmailRouter.patch('/email/messages/:id/archive', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'archive', requestActorFrom(req)),
  });
}));

gmailRouter.patch('/email/messages/:id/trash', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'trash', requestActorFrom(req)),
  });
}));

gmailRouter.patch('/email/messages/:id/restore', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'restore', requestActorFrom(req)),
  });
}));

gmailRouter.post('/email/trash/empty', asyncRoute(async (req, res) => {
  res.json(await emptyTrash(String(accountEmailFrom(req) || ''), requestActorFrom(req)));
}));

gmailRouter.post('/gmail/trash/empty', asyncRoute(async (req, res) => {
  res.json(await emptyTrash(String(accountEmailFrom(req) || ''), requestActorFrom(req)));
}));

gmailRouter.delete('/gmail/messages/:id', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'trash', requestActorFrom(req)),
  });
}));

gmailRouter.post('/gmail/messages/:id/archive', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'archive', requestActorFrom(req)),
  });
}));

gmailRouter.post('/gmail/messages/:id/trash', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'trash', requestActorFrom(req)),
  });
}));

gmailRouter.post('/gmail/messages/:id/restore', asyncRoute(async (req, res) => {
  res.json({
    message: await modifyMessage(String(accountEmailFrom(req) || ''), req.params.id, 'restore', requestActorFrom(req)),
  });
}));

gmailRouter.post('/email/sync/recent', asyncRoute(async (_req, res) => {
  res.json({ success: true, message: 'Sync not implemented yet.' });
}));

gmailRouter.use(async (error, req, res, _next) => {
  const accountEmail = req.body?.accountEmail || req.query?.accountEmail || null;
  const actor = requestActorFrom(req);

  if (error?.code === 'LIMIT_FILE_SIZE') {
    error.status = 400;
    error.code = 'message_too_large';
    error.message = `O arquivo selecionado excede a capacidade de transmissao. Limite atual: ${Math.round(
      MAX_TRANSMISSION_BYTES / (1024 * 1024),
    )} MB.`;
    error.details = {
      ...(error.details || {}),
      maxTransmissionBytes: MAX_TRANSMISSION_BYTES,
    };
  }

  try {
    await logEvent(accountEmail, 'error', error.message || 'Erro inesperado no webmail', {
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
