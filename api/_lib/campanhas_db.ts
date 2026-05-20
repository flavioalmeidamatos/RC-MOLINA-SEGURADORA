import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

import type { CampaignHistoryEntry, SaveWhatsAppCampaignPayload, WhatsAppDispatchPayload, WhatsAppDispatchResult } from '../../src/types/whatsapp_campaign';
import type { CampaignActor } from './campanhas_auth';
import { initLocalDatabase } from './local_db';

type CampaignRow = {
  id: string;
  nome: string;
  mensagem: string;
  destinatarios: string[] | null;
  anexos: unknown[] | null;
  opt_in_confirmado: boolean;
  template_confirmado: boolean;
  canal: 'WHATSAPP';
  status: 'draft';
  created_by_user_id: string;
  created_by_user_email: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type CampaignHistoryRow = {
  id: string;
  campaign_id: string | null;
  campaign_name: string;
  event_type: CampaignHistoryEntry['eventType'];
  status: CampaignHistoryEntry['status'];
  summary: string;
  actor_user_id: string | null;
  actor_user_email: string;
  created_at: Date | string;
  details: Record<string, unknown> | null;
};

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

const CAMPAIGN_ATTACHMENT_LIMIT = 10;
const CAMPAIGN_ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_CAMPAIGN_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const getPool = () => {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL || '';
    pool = new Pool(
      databaseUrl
        ? { connectionString: databaseUrl }
        : {
            host: process.env.PGHOST || '127.0.0.1',
            port: Number(process.env.PGPORT || 5432),
            database: process.env.PGDATABASE || 'rcmolina',
            user: process.env.PGUSER || 'rcmolina',
            password: process.env.PGPASSWORD || '',
          },
    );
  }

  return pool;
};

const campaignsSchemaSql = `
create table if not exists "RCMOLINASEGUROS"."CAMPANHAS" (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mensagem text not null default '',
  canal text not null default 'WHATSAPP' check (canal in ('WHATSAPP')),
  status text not null default 'draft' check (status in ('draft')),
  destinatarios jsonb not null default '[]'::jsonb,
  anexos jsonb not null default '[]'::jsonb,
  opt_in_confirmado boolean not null default false,
  template_confirmado boolean not null default false,
  created_by_user_id uuid not null references "RCMOLINASEGUROS"."USUARIOS"(id) on delete cascade,
  created_by_user_email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists campanhas_created_by_user_idx
  on "RCMOLINASEGUROS"."CAMPANHAS" (created_by_user_id, updated_at desc);

drop trigger if exists trg_campanhas_touch_updated_at on "RCMOLINASEGUROS"."CAMPANHAS";
create trigger trg_campanhas_touch_updated_at
before update on "RCMOLINASEGUROS"."CAMPANHAS"
for each row
execute function "RCMOLINASEGUROS".touch_updated_at();

create table if not exists "RCMOLINASEGUROS"."CAMPANHAS_HISTORICO" (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid null,
  campaign_name text not null,
  event_type text not null check (event_type in ('created', 'updated', 'deleted', 'dispatched')),
  status text not null check (status in ('success', 'error')),
  summary text not null,
  actor_user_id uuid null,
  actor_user_email text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists campanhas_historico_campaign_idx
  on "RCMOLINASEGUROS"."CAMPANHAS_HISTORICO" (campaign_id, created_at desc);

create index if not exists campanhas_historico_actor_idx
  on "RCMOLINASEGUROS"."CAMPANHAS_HISTORICO" (actor_user_id, created_at desc);
`;

export const initCampanhasDatabase = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await initLocalDatabase();
      await getPool().query(campaignsSchemaSql);
    })();
  }

  return initPromise;
};

const toCampaignPayload = (payload: SaveWhatsAppCampaignPayload) => ({
  campaignName: String(payload.campaignName || '').trim().slice(0, 140),
  message: String(payload.message || '').slice(0, 12000),
  recipients: Array.isArray(payload.recipients)
    ? payload.recipients.map((value) => String(value || '').replace(/\D/g, '').slice(0, 11)).filter(Boolean).slice(0, 10)
    : [],
  attachments: Array.isArray(payload.attachments)
    ? payload.attachments.slice(0, CAMPAIGN_ATTACHMENT_LIMIT).map((item) => ({
        id: String(item?.id || ''),
        kind: String(item?.kind || 'file'),
        name: String(item?.name || '').slice(0, 255),
        sizeLabel: String(item?.sizeLabel || '').slice(0, 40),
        sizeBytes: Number(item?.sizeBytes || 0) || null,
        mimeType: item?.mimeType ? String(item.mimeType).slice(0, 120) : null,
        fileUrl: item?.fileUrl ? String(item.fileUrl).slice(0, 1024) : null,
        uploadedAt: item?.uploadedAt ? String(item.uploadedAt).slice(0, 80) : null,
      }))
    : [],
  optInChecked: payload.optInChecked === true,
  templateChecked: payload.templateChecked === true,
});

const mapCampaignRow = (row: CampaignRow) => ({
  id: row.id,
  campaignName: row.nome,
  message: row.mensagem,
  recipients: Array.isArray(row.destinatarios) ? row.destinatarios.map((value) => String(value || '')) : [],
  attachments: Array.isArray(row.anexos)
    ? row.anexos.map((item: any) => ({
        id: String(item?.id || ''),
        kind: String(item?.kind || 'file'),
        name: String(item?.name || ''),
        sizeLabel: String(item?.sizeLabel || ''),
        sizeBytes: Number(item?.sizeBytes || 0) || null,
        mimeType: item?.mimeType ? String(item.mimeType) : null,
        fileUrl: item?.fileUrl ? String(item.fileUrl) : null,
        uploadedAt: item?.uploadedAt ? String(item.uploadedAt) : null,
      }))
    : [],
  optInChecked: Boolean(row.opt_in_confirmado),
  templateChecked: Boolean(row.template_confirmado),
  channel: row.canal,
  status: row.status,
  createdByUserId: row.created_by_user_id,
  createdByUserEmail: row.created_by_user_email,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
});

const mapCampaignHistoryRow = (row: CampaignHistoryRow): CampaignHistoryEntry => ({
  id: row.id,
  campaignId: row.campaign_id,
  campaignName: row.campaign_name,
  eventType: row.event_type,
  status: row.status,
  summary: row.summary,
  actorUserId: row.actor_user_id,
  actorUserEmail: row.actor_user_email,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  details: row.details && typeof row.details === 'object' ? row.details : null,
});

const appendCampaignHistoryLog = async ({
  actor,
  campaignId,
  campaignName,
  eventType,
  status,
  summary,
  details,
}: {
  actor: CampaignActor;
  campaignId: string | null;
  campaignName: string;
  eventType: CampaignHistoryEntry['eventType'];
  status: CampaignHistoryEntry['status'];
  summary: string;
  details?: Record<string, unknown>;
}) => {
  await initCampanhasDatabase();
  await getPool().query(
    `insert into "RCMOLINASEGUROS"."CAMPANHAS_HISTORICO"
      (campaign_id, campaign_name, event_type, status, summary, actor_user_id, actor_user_email, details)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      campaignId,
      campaignName || 'Campanha sem nome',
      eventType,
      status,
      summary,
      actor.userId,
      actor.userEmail,
      JSON.stringify(details || {}),
    ],
  );
};

const campaignScopeSql = (actor: CampaignActor) =>
  actor.isAdmin ? '' : 'where created_by_user_id = $1';

const sanitizeFileName = (name: string) => {
  const cleanName = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ');

  return cleanName || 'anexo';
};

const extensionFromMime = (mimeType: string) => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  return 'bin';
};

const getCampaignUploadRoot = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const formatStoredFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const removeStoredCampaignFile = async (fileUrl?: string | null) => {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) {
    return;
  }

  const relativePath = fileUrl.replace(/^\/uploads\//, '');
  const absolutePath = path.join(getCampaignUploadRoot(), relativePath);
  await fs.unlink(absolutePath).catch(() => undefined);
};

export const listCampaigns = async (actor: CampaignActor) => {
  await initCampanhasDatabase();
  const result = await getPool().query(
    `select *
     from "RCMOLINASEGUROS"."CAMPANHAS"
     ${campaignScopeSql(actor)}
     order by updated_at desc
     limit 20`,
    actor.isAdmin ? [] : [actor.userId],
  );

  return result.rows.map(mapCampaignRow);
};

export const listCampaignHistory = async (actor: CampaignActor, campaignId: string) => {
  await initCampanhasDatabase();
  const result = await getPool().query(
    `select *
     from "RCMOLINASEGUROS"."CAMPANHAS_HISTORICO"
     where campaign_id = $1
       ${actor.isAdmin ? '' : 'and actor_user_id = $2'}
     order by created_at desc
     limit 40`,
    actor.isAdmin ? [campaignId] : [campaignId, actor.userId],
  );

  return result.rows.map(mapCampaignHistoryRow);
};

export const getCampaignById = async (actor: CampaignActor, id: string) => {
  await initCampanhasDatabase();
  const result = await getPool().query(
    `select *
     from "RCMOLINASEGUROS"."CAMPANHAS"
     where id = $1
       ${actor.isAdmin ? '' : 'and created_by_user_id = $2'}
     limit 1`,
    actor.isAdmin ? [id] : [id, actor.userId],
  );

  return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
};

export const createCampaign = async (actor: CampaignActor, payload: SaveWhatsAppCampaignPayload) => {
  await initCampanhasDatabase();
  const normalized = toCampaignPayload(payload);

  const result = await getPool().query(
    `insert into "RCMOLINASEGUROS"."CAMPANHAS"
      (nome, mensagem, destinatarios, anexos, opt_in_confirmado, template_confirmado, created_by_user_id, created_by_user_email)
     values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
     returning *`,
    [
      normalized.campaignName || 'Campanha sem nome',
      normalized.message,
      JSON.stringify(normalized.recipients),
      JSON.stringify(normalized.attachments),
      normalized.optInChecked,
      normalized.templateChecked,
      actor.userId,
      actor.userEmail,
    ],
  );

  const campaign = mapCampaignRow(result.rows[0]);
  await appendCampaignHistoryLog({
    actor,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    eventType: 'created',
    status: 'success',
    summary: 'Campanha criada e salva como rascunho.',
    details: {
      recipients: campaign.recipients.length,
      attachments: campaign.attachments.length,
    },
  });

  return campaign;
};

export const updateCampaign = async (actor: CampaignActor, id: string, payload: SaveWhatsAppCampaignPayload) => {
  await initCampanhasDatabase();
  const normalized = toCampaignPayload(payload);

  const result = await getPool().query(
    `update "RCMOLINASEGUROS"."CAMPANHAS"
     set nome = $1,
         mensagem = $2,
         destinatarios = $3::jsonb,
         anexos = $4::jsonb,
         opt_in_confirmado = $5,
         template_confirmado = $6
     where id = $7
       ${actor.isAdmin ? '' : 'and created_by_user_id = $8'}
     returning *`,
    actor.isAdmin
      ? [
          normalized.campaignName || 'Campanha sem nome',
          normalized.message,
          JSON.stringify(normalized.recipients),
          JSON.stringify(normalized.attachments),
          normalized.optInChecked,
          normalized.templateChecked,
          id,
        ]
      : [
          normalized.campaignName || 'Campanha sem nome',
          normalized.message,
          JSON.stringify(normalized.recipients),
          JSON.stringify(normalized.attachments),
          normalized.optInChecked,
          normalized.templateChecked,
          id,
          actor.userId,
        ],
  );

  if (!result.rows[0]) {
    return null;
  }

  const campaign = mapCampaignRow(result.rows[0]);
  await appendCampaignHistoryLog({
    actor,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    eventType: 'updated',
    status: 'success',
    summary: 'Campanha atualizada.',
    details: {
      recipients: campaign.recipients.length,
      attachments: campaign.attachments.length,
    },
  });

  return campaign;
};

export const deleteCampaign = async (actor: CampaignActor, id: string) => {
  await initCampanhasDatabase();
  const existing = await getCampaignById(actor, id);
  if (!existing) {
    return false;
  }

  const result = await getPool().query(
    `delete from "RCMOLINASEGUROS"."CAMPANHAS"
     where id = $1
       ${actor.isAdmin ? '' : 'and created_by_user_id = $2'}
     returning id`,
    actor.isAdmin ? [id] : [id, actor.userId],
  );

  if (result.rowCount) {
    await Promise.all(existing.attachments.map((attachment) => removeStoredCampaignFile(attachment.fileUrl)));
    await appendCampaignHistoryLog({
      actor,
      campaignId: existing.id,
      campaignName: existing.campaignName,
      eventType: 'deleted',
      status: 'success',
      summary: 'Campanha removida.',
      details: {
        recipients: existing.recipients.length,
        attachments: existing.attachments.length,
      },
    });
  }

  return Boolean(result.rowCount);
};

export const uploadCampaignAttachment = async (
  actor: CampaignActor,
  campaignId: string,
  payload: {
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    dataUrl?: string;
  },
) => {
  await initCampanhasDatabase();
  const campaign = await getCampaignById(actor, campaignId);
  if (!campaign) {
    throw new Error('Campanha nao encontrada.');
  }

  if (campaign.attachments.length >= CAMPAIGN_ATTACHMENT_LIMIT) {
    throw new Error(`O limite atual e de ${CAMPAIGN_ATTACHMENT_LIMIT} anexos por campanha.`);
  }

  const dataUrlMatch = String(payload.dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!dataUrlMatch) {
    throw new Error('Arquivo invalido para upload.');
  }

  const mimeType = String(payload.mimeType || dataUrlMatch[1] || '').trim().toLowerCase();
  if (!ALLOWED_CAMPAIGN_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato de anexo nao permitido. Use imagem, video MP4/WEBM/MOV ou PDF.');
  }

  const buffer = Buffer.from(dataUrlMatch[2], 'base64');
  if (!buffer.length) {
    throw new Error('Arquivo vazio.');
  }

  if (buffer.length > CAMPAIGN_ATTACHMENT_MAX_BYTES) {
    throw new Error('Cada anexo deve ter no maximo 12 MB.');
  }

  const originalName = sanitizeFileName(payload.name || `anexo.${extensionFromMime(mimeType)}`);
  const extension = path.extname(originalName) || `.${extensionFromMime(mimeType)}`;
  const filename = `${crypto.randomUUID()}${extension.toLowerCase()}`;
  const campaignDir = path.join(getCampaignUploadRoot(), 'campanhas', campaignId);

  await fs.mkdir(campaignDir, { recursive: true });
  await fs.writeFile(path.join(campaignDir, filename), buffer);

  const uploadedAt = new Date().toISOString();
  const attachment = {
    id: crypto.randomUUID(),
    kind: mimeType.startsWith('image/')
      ? 'image'
      : mimeType.startsWith('video/')
        ? 'video'
        : mimeType === 'application/pdf'
          ? 'pdf'
          : 'file',
    name: originalName,
    sizeLabel: formatStoredFileSize(buffer.length),
    sizeBytes: buffer.length,
    mimeType,
    fileUrl: `/uploads/campanhas/${campaignId}/${filename}`,
    uploadedAt,
  };

  const nextAttachments = [...campaign.attachments, attachment];
  const result = await getPool().query(
    `update "RCMOLINASEGUROS"."CAMPANHAS"
     set anexos = $1::jsonb
     where id = $2
       ${actor.isAdmin ? '' : 'and created_by_user_id = $3'}
     returning *`,
    actor.isAdmin ? [JSON.stringify(nextAttachments), campaignId] : [JSON.stringify(nextAttachments), campaignId, actor.userId],
  );

  const updatedCampaign = result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  if (!updatedCampaign) {
    throw new Error('Nao foi possivel atualizar os anexos da campanha.');
  }

  await appendCampaignHistoryLog({
    actor,
    campaignId: updatedCampaign.id,
    campaignName: updatedCampaign.campaignName,
    eventType: 'updated',
    status: 'success',
    summary: `Anexo "${originalName}" enviado para a campanha.`,
    details: {
      attachmentId: attachment.id,
      attachmentName: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      attachmentCount: updatedCampaign.attachments.length,
    },
  });

  return updatedCampaign;
};

export const removeCampaignAttachment = async (actor: CampaignActor, campaignId: string, attachmentId: string) => {
  await initCampanhasDatabase();
  const campaign = await getCampaignById(actor, campaignId);
  if (!campaign) {
    throw new Error('Campanha nao encontrada.');
  }

  const attachment = campaign.attachments.find((item) => item.id === attachmentId);
  if (!attachment) {
    throw new Error('Anexo nao encontrado.');
  }

  const nextAttachments = campaign.attachments.filter((item) => item.id !== attachmentId);
  const result = await getPool().query(
    `update "RCMOLINASEGUROS"."CAMPANHAS"
     set anexos = $1::jsonb
     where id = $2
       ${actor.isAdmin ? '' : 'and created_by_user_id = $3'}
     returning *`,
    actor.isAdmin ? [JSON.stringify(nextAttachments), campaignId] : [JSON.stringify(nextAttachments), campaignId, actor.userId],
  );

  await removeStoredCampaignFile(attachment.fileUrl);

  const updatedCampaign = result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  if (!updatedCampaign) {
    throw new Error('Nao foi possivel remover o anexo da campanha.');
  }

  await appendCampaignHistoryLog({
    actor,
    campaignId: updatedCampaign.id,
    campaignName: updatedCampaign.campaignName,
    eventType: 'updated',
    status: 'success',
    summary: `Anexo "${attachment.name}" removido da campanha.`,
    details: {
      attachmentId,
      attachmentName: attachment.name,
      attachmentCount: updatedCampaign.attachments.length,
    },
  });

  return updatedCampaign;
};

export const recordCampaignDispatch = async (
  actor: CampaignActor,
  payload: WhatsAppDispatchPayload,
  result: WhatsAppDispatchResult,
) => {
  const normalized = toCampaignPayload(payload);
  const campaignName = normalized.campaignName || 'Campanha sem nome';
  const campaignId = payload.campaignId ? String(payload.campaignId) : null;
  const status: CampaignHistoryEntry['status'] = result.failed > 0 ? 'error' : 'success';

  await appendCampaignHistoryLog({
    actor,
    campaignId,
    campaignName,
    eventType: 'dispatched',
    status,
    summary: `${result.sent}/${result.attempted} envio(s) concluido(s), ${result.failed} falha(s).`,
    details: {
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
      recipients: normalized.recipients,
      messagePreview: normalized.message.slice(0, 280),
      attachments: normalized.attachments.map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        fileUrl: item.fileUrl,
      })),
      results: result.results,
    },
  });
};

export const recordCampaignDispatchFailure = async (
  actor: CampaignActor,
  payload: WhatsAppDispatchPayload,
  errorMessage: string,
) => {
  const normalized = toCampaignPayload(payload);

  await appendCampaignHistoryLog({
    actor,
    campaignId: payload.campaignId ? String(payload.campaignId) : null,
    campaignName: normalized.campaignName || 'Campanha sem nome',
    eventType: 'dispatched',
    status: 'error',
    summary: errorMessage || 'Tentativa de disparo bloqueada ou com falha.',
    details: {
      recipients: normalized.recipients,
      messagePreview: normalized.message.slice(0, 280),
      attachments: normalized.attachments.map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        fileUrl: item.fileUrl,
      })),
    },
  });
};
