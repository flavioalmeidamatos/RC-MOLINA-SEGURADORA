import { decodeBase64Url } from './gmail_mime.js';
import { normalizeUtf8Text } from './gmail_text_encoding.js';

function getHeader(headers = [], name) {
  const header = headers.find(
    (item) => item.name?.toLowerCase() === String(name).toLowerCase(),
  );
  return normalizeUtf8Text(header?.value || '');
}

function getPartHeader(part, name) {
  return getHeader(part?.headers || [], name);
}

function normalizeContentId(value = '') {
  return String(value).replace(/^<|>$/g, '').trim();
}

function normalizeContentLocation(value = '') {
  return String(value).trim();
}

function collectParts(part, collector) {
  if (!part) return;

  const bodyData = part.body?.data;
  const attachmentId = part.body?.attachmentId;
  const filename = normalizeUtf8Text(part.filename || '');
  const mimeType = part.mimeType || '';
  const contentId = normalizeContentId(getPartHeader(part, 'Content-ID'));
  const contentLocation = normalizeContentLocation(getPartHeader(part, 'Content-Location'));
  const contentDisposition = getPartHeader(part, 'Content-Disposition').toLowerCase();
  const inline =
    Boolean(contentId) ||
    Boolean(contentLocation) ||
    contentDisposition.includes('inline');

  if (bodyData && mimeType === 'text/plain') {
    collector.text.push(decodeBase64Url(bodyData).toString('utf8'));
  }

  if (bodyData && mimeType === 'text/html') {
    collector.html.push(decodeBase64Url(bodyData).toString('utf8'));
  }

  if (attachmentId && (filename || contentId || contentLocation)) {
    collector.attachments.push({
      attachmentId,
      filename: filename || contentId || 'inline-asset',
      mimeType,
      size: part.body?.size || 0,
      contentId: contentId || undefined,
      contentLocation: contentLocation || undefined,
      contentData: inline && bodyData ? bodyData : undefined,
      inline,
    });
  }

  for (const child of part.parts || []) {
    collectParts(child, collector);
  }
}

export function toMessageSummary(message) {
  const headers = message.payload?.headers || [];
  const labelIds = message.labelIds || [];

  return {
    id: message.id,
    threadId: message.threadId,
    labelIds,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(sem assunto)',
    date: getHeader(headers, 'Date'),
    snippet: message.snippet || '',
    size: Number(message.sizeEstimate || 0),
    unread: labelIds.includes('UNREAD'),
    internalDate: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
  };
}

export function toFullMessage(message) {
  const collector = { text: [], html: [], attachments: [] };
  collectParts(message.payload, collector);

  return {
    ...toMessageSummary(message),
    bodyText: collector.text.join('\n\n'),
    bodyHtml: collector.html.join('\n\n'),
    attachments: collector.attachments,
    headers: message.payload?.headers || [],
  };
}

export function metadataFromFullMessage(accountEmail, message) {
  const parsed = toFullMessage(message);
  const toAddresses = parsed.to
    ? parsed.to
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    accountEmail,
    gmailMessageId: parsed.id,
    threadId: parsed.threadId,
    labelIds: parsed.labelIds,
    fromAddress: parsed.from,
    toAddresses,
    subject: parsed.subject,
    snippet: parsed.snippet,
    internalDate: parsed.internalDate,
    hasAttachments: parsed.attachments.length > 0,
    attachments: parsed.attachments,
  };
}
