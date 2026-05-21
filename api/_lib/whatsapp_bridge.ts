import fs from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';

import type { WhatsAppBridgeStatus, WhatsAppDispatchPayload, WhatsAppDispatchRecipientResult, WhatsAppDispatchResult } from '../../src/types/whatsapp_campaign';
import {
  getLocalWhatsAppBridgeStatus,
  logoutLocalWhatsAppBridge,
  sendLocalWhatsAppBridgeMessage,
} from './whatsapp_connector';

const DEFAULT_TIMEOUT_MS = 20000;
const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

const normalizeBaseUrl = (value: string | undefined) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
};

const bridgeBaseUrl = () => normalizeBaseUrl(process.env.WHATSAPP_BRIDGE_BASE_URL);

const bridgeTimeoutMs = () => {
  const parsed = Number(process.env.WHATSAPP_BRIDGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const useExternalBridge = () => Boolean(bridgeBaseUrl());

const createBridgeStatus = (
  override: Partial<WhatsAppBridgeStatus> = {},
): WhatsAppBridgeStatus => ({
  configured: false,
  available: false,
  status: 'disabled',
  qr: null,
  qrAvailable: false,
  user: null,
  error: null,
  ...override,
});

const createQrSvgDataUrl = (qrValue: string | null) => {
  if (!qrValue) {
    return null;
  }

  const qrCode = new QRCode(-1, QRErrorCorrectLevel.M);
  qrCode.addData(qrValue);
  qrCode.make();

  const moduleCount = qrCode.getModuleCount();
  const cellSize = 8;
  const quietZone = 4;
  const size = (moduleCount + quietZone * 2) * cellSize;
  let pathData = '';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qrCode.isDark(row, col)) {
        continue;
      }

      const x = (col + quietZone) * cellSize;
      const y = (row + quietZone) * cellSize;
      pathData += `M${x} ${y}h${cellSize}v${cellSize}H${x}z`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><path fill="#0f172a" d="${pathData}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const fetchBridgeJson = async <T>(pathname: string, init?: RequestInit): Promise<T> => {
  const baseUrl = bridgeBaseUrl();
  if (!baseUrl) {
    throw new Error('WHATSAPP_BRIDGE_BASE_URL nao configurada.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), bridgeTimeoutMs());

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || 'Falha ao consultar servico externo do WhatsApp.');
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
};

const cleanRecipients = (recipients: string[]) =>
  recipients
    .map((item) => String(item || '').replace(/\D/g, '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);

const getUploadRoot = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const resolveStoredAttachmentPath = (fileUrl: string) => {
  if (!fileUrl.startsWith('/uploads/')) {
    throw new Error('Anexo sem caminho publico valido.');
  }

  return path.join(getUploadRoot(), fileUrl.replace(/^\/uploads\//, ''));
};

const mapAttachmentsToBridgeMedia = async (attachments: WhatsAppDispatchPayload['attachments']) => {
  const media = [];

  for (const attachment of attachments || []) {
    if (!attachment.fileUrl || !attachment.mimeType) {
      throw new Error(`Anexo "${attachment.name}" invalido.`);
    }

    if (attachment.fileUrl.startsWith('data:')) {
      media.push({
        base64: attachment.fileUrl,
        type: attachment.mimeType,
        name: attachment.name,
      });
    } else {
      const fileBuffer = await fs.readFile(resolveStoredAttachmentPath(attachment.fileUrl));
      media.push({
        base64: `data:${attachment.mimeType};base64,${fileBuffer.toString('base64')}`,
        type: attachment.mimeType,
        name: attachment.name,
      });
    }
  }

  return media;
};

export const getWhatsAppBridgeStatus = async (): Promise<WhatsAppBridgeStatus> => {
  if (!useExternalBridge()) {
    const localStatus = await getLocalWhatsAppBridgeStatus();
    return {
      ...localStatus,
      qrSvg: createQrSvgDataUrl(localStatus.qr),
    };
  }

  try {
    const payload = await fetchBridgeJson<{
      status?: string;
      qr?: string;
      user?: { pushname?: string; phone?: string } | null;
      ready?: boolean;
      error?: string;
    }>('/api/status');

    const status = String(payload?.status || 'disconnected') as WhatsAppBridgeStatus['status'];
    const qr = payload?.qr ? String(payload.qr) : null;

    return createBridgeStatus({
      configured: true,
      available: true,
      status,
      qr,
      qrSvg: createQrSvgDataUrl(qr),
      qrAvailable: Boolean(qr),
      user: payload?.user?.phone
        ? {
            pushname: payload.user.pushname || 'Usuario WhatsApp',
            phone: payload.user.phone,
          }
        : null,
      error: payload?.error || null,
    });
  } catch (error) {
    return createBridgeStatus({
      configured: true,
      available: false,
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Falha ao consultar servico externo do WhatsApp.',
    });
  }
};

export const logoutWhatsAppBridge = async () => {
  if (!useExternalBridge()) {
    await logoutLocalWhatsAppBridge();
    return;
  }

  await fetchBridgeJson<{ success?: boolean; message?: string }>('/api/logout', {
    method: 'POST',
  });
};

export const sendCampaignToWhatsAppBridge = async (
  payload: WhatsAppDispatchPayload,
): Promise<WhatsAppDispatchResult> => {
  const recipients = cleanRecipients(payload.recipients || []);
  const message = String(payload.message || '').trim();

  if (!payload.optInChecked || !payload.templateChecked) {
    throw new Error('Confirme opt-in e conformidade de template antes de disparar mensagens.');
  }

  if (!message) {
    throw new Error('A campanha precisa ter uma mensagem antes do disparo.');
  }

  if (recipients.length === 0) {
    throw new Error('Informe ao menos um destinatario valido antes do disparo.');
  }

  const media = await mapAttachmentsToBridgeMedia(payload.attachments || []);

  const results: WhatsAppDispatchRecipientResult[] = [];

  for (const number of recipients) {
    try {
      const response = useExternalBridge()
        ? await fetchBridgeJson<{ success?: boolean; messageId?: string; error?: string }>('/api/send', {
            method: 'POST',
            body: JSON.stringify({
              number,
              message,
              media,
              optInConfirmed: true,
            }),
          })
        : await sendLocalWhatsAppBridgeMessage(number, message, media);

      results.push({
        number,
        success: response?.success !== false,
        messageId: response?.messageId,
      });
    } catch (error) {
      results.push({
        number,
        success: false,
        error: error instanceof Error ? error.message : 'Falha ao enviar mensagem.',
      });
    }
  }

  const sent = results.filter((item) => item.success).length;

  return {
    attempted: results.length,
    sent,
    failed: results.length - sent,
    results,
  };
};
