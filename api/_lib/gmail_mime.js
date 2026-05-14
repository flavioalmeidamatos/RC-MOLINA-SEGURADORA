import path from 'path';
import { parseRecipientList } from './gmail_email_address.js';
import { normalizeUtf8Text } from './gmail_text_encoding.js';

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeHeader(value = '') {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
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

function foldBase64(buffer) {
  return buffer
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n')
    .trim();
}

export function decodeBase64Url(data = '') {
  const normalized = String(data).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

export function createRawMessage({
  from,
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  files = [],
}) {
  const toList = parseRecipientList(to);
  const ccList = parseRecipientList(cc);
  const bccList = parseRecipientList(bcc);
  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const body = [];

  const headers = [
    `From: ${from}`,
    `To: ${toList.join(', ')}`,
    ccList.length ? `Cc: ${ccList.join(', ')}` : null,
    bccList.length ? `Bcc: ${bccList.join(', ')}` : null,
    `Subject: ${encodeHeader(subject || '')}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  if (files.length > 0) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    body.push(`--${mixedBoundary}`);
  }

  if (text && html) {
    if (files.length === 0) {
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    } else {
      body.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      body.push('');
    }

    body.push(`--${altBoundary}`);
    body.push('Content-Type: text/plain; charset="UTF-8"');
    body.push('Content-Transfer-Encoding: 7bit');
    body.push('');
    body.push(text);
    body.push(`--${altBoundary}`);
    body.push('Content-Type: text/html; charset="UTF-8"');
    body.push('Content-Transfer-Encoding: 7bit');
    body.push('');
    body.push(html);
    body.push(`--${altBoundary}--`);
  } else if (html) {
    if (files.length === 0) {
      headers.push('Content-Type: text/html; charset="UTF-8"');
      headers.push('Content-Transfer-Encoding: 7bit');
    } else {
      body.push('Content-Type: text/html; charset="UTF-8"');
      body.push('Content-Transfer-Encoding: 7bit');
      body.push('');
    }
    body.push(html);
  } else {
    if (files.length === 0) {
      headers.push('Content-Type: text/plain; charset="UTF-8"');
      headers.push('Content-Transfer-Encoding: 7bit');
    } else {
      body.push('Content-Type: text/plain; charset="UTF-8"');
      body.push('Content-Transfer-Encoding: 7bit');
      body.push('');
    }
    body.push(text || '');
  }

  for (const file of files) {
    const filename = normalizeUtf8Text(
      file.originalname || path.basename(file.path || 'attachment'),
    );
    const filenameFallback = asciiFilenameFallback(filename);
    const encodedFilename = encodeHeaderParameter(filename);
    body.push(`--${mixedBoundary}`);
    body.push(
      `Content-Type: ${file.mimetype || 'application/octet-stream'}; name="${filenameFallback}"; name*=UTF-8''${encodedFilename}`,
    );
    body.push('Content-Transfer-Encoding: base64');
    body.push(
      `Content-Disposition: attachment; filename="${filenameFallback}"; filename*=UTF-8''${encodedFilename}`,
    );
    body.push('');
    body.push(foldBase64(file.buffer));
  }

  if (files.length > 0) {
    body.push(`--${mixedBoundary}--`);
  }

  return base64Url(`${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`);
}
