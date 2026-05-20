import fs from 'fs/promises';
import path from 'path';

import type { WhatsAppBridgeStatus, WhatsAppDispatchPayload, WhatsAppDispatchRecipientResult, WhatsAppDispatchResult } from '../../src/types/whatsapp_campaign';
import {
  getLocalWhatsAppBridgeStatus,
  logoutLocalWhatsAppBridge,
  sendLocalWhatsAppBridgeMessage,
} from './whatsapp_connector';

const DEFAULT_TIMEOUT_MS = 20000;

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
      throw new Error(`Anexo "${attachment.name}" ainda nao foi persistido no servidor.`);
    }

    const fileBuffer = await fs.readFile(resolveStoredAttachmentPath(attachment.fileUrl));
    media.push({
      base64: `data:${attachment.mimeType};base64,${fileBuffer.toString('base64')}`,
      type: attachment.mimeType,
      name: attachment.name,
    });
  }

  return media;
};

export const getWhatsAppBridgeStatus = async (): Promise<WhatsAppBridgeStatus> => {
  if (!useExternalBridge()) {
    return getLocalWhatsAppBridgeStatus();
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
