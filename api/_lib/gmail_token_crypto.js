import crypto from 'crypto';
import { gmailConfig } from './gmail_config.js';

function getKey() {
  const key = Buffer.from(gmailConfig.tokenEncryptionKey || '', 'base64');
  if (key.length !== 32) {
    const error = new Error('TOKEN_ENCRYPTION_KEY deve ser uma string base64 de 32 bytes.');
    error.status = 503;
    error.code = 'gmail_not_configured';
    throw error;
  }
  return key;
}

export function encryptText(value) {
  if (!value) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64')).join(':');
}

export function decryptText(value) {
  if (!value) return null;

  const [ivBase64, tagBase64, encryptedBase64] = String(value).split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
