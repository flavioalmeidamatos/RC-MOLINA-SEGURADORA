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
  const gmail = await getAuthedGmail(requireAccountEmail(req), requestActorFrom(req));
  const result = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: req.params.id },
  });

  return { message: result.data };
}

async function deleteDraft(req) {
  const gmail = await getAuthedGmail(requireAccountEmail(req), requestActorFrom(req));
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
  return {
    message: await modifyMessage(requireAccountEmail(req), req.params.id, action, requestActorFrom(req)),
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
  res.json(await getAccountStatus(String(accountEmailFrom(req) || ''), requestActorFrom(req)));
});

registerRoute('post', ['/email/auth/disconnect', '/gmail/disconnect'], async (req, res) => {
  res.json(await disconnectAccount(requireAccountEmail(req), requestActorFrom(req)));
});

registerRoute('get', ['/email/accounts', '/gmail/accounts'], async (req, res) => {
  res.json({ accounts: await listAccounts(requestActorFrom(req)) });
});

registerRoute('get', ['/email/logs', '/gmail/logs'], async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  const actor = requestActorFrom(req);
  res.json({ logs: await listEmailLogs(accountEmail, actor) });
});

registerRoute('get', '/email/inbox', async (req, res) => {
  res.json(await listMessages(requireAccountEmail(req), {
    ...listMessagesOptions(req, 'inbox'),
    content: req.query.content,
    status: req.query.status || (req.query.unread === 'true' ? 'unread' : undefined),
  }, requestActorFrom(req)));
});

registerRoute('get', '/email/sent', async (req, res) => {
  res.json(await listMessages(requireAccountEmail(req), {
    ...listMessagesOptions(req, 'sent'),
    content: req.query.content,
  }, requestActorFrom(req)));
});

registerRoute('get', '/email/trash', async (req, res) => {
  res.json(await listMessages(requireAccountEmail(req), {
    ...listMessagesOptions(req, 'trash'),
    content: req.query.content,
  }, requestActorFrom(req)));
});

registerRoute('get', '/email/search', async (req, res) => {
  res.json(await listMessages(requireAccountEmail(req), {
    ...listMessagesOptions(req, 'inbox'),
    content: req.query.q || req.query.content,
  }, requestActorFrom(req)));
});

registerRoute('get', '/gmail/messages', async (req, res) => {
  res.json(await listMessages(requireAccountEmail(req), listMessagesOptions(req, folderFromQuery(req)), requestActorFrom(req)));
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
  res.json({
    message: await getMessage(requireAccountEmail(req), req.params.id, requestActorFrom(req)),
  });
});

registerRoute('post', '/email/send', upload.none(), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body, { requireTo: true });
  const payload = mailPayloadFromBody(req.body);
  assertTransmissionCapacity(payload, []);
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
  res.status(201).json({
    message: await sendMessage(accountEmail, payload, files, requestActorFrom(req)),
  });
});

registerRoute('get', ['/email/messages/:messageId/attachments', '/gmail/messages/:messageId/attachments'], async (req, res) => {
  const message = await getMessage(requireAccountEmail(req), req.params.messageId, requestActorFrom(req));
  res.json({ attachments: message.attachments });
});

registerRoute('get', ['/email/messages/:messageId/attachments/:attachmentId', '/gmail/messages/:messageId/attachments/:attachmentId'], async (req, res) => {
  const buffer = await downloadAttachment(
    requireAccountEmail(req),
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
});

registerRoute('get', ['/email/drafts', '/gmail/drafts'], async (req, res) => {
  res.json(await listDrafts(
    requireAccountEmail(req),
    listMessagesOptions(req, 'drafts'),
    requestActorFrom(req),
  ));
});

registerRoute('post', '/email/drafts', upload.array('attachments'), async (req, res) => {
  const accountEmail = requireAccountEmail(req);
  assertValidRecipients(req.body);
  const payload = mailPayloadFromBody(req.body);
  const files = normalizeUploadedFiles(req.files || []);
  assertTransmissionCapacity(payload, files);
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
