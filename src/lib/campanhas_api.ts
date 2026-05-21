import type { CampaignHistoryEntry, SaveWhatsAppCampaignPayload, SavedWhatsAppCampaign } from "../types/whatsapp_campaign";

type ApiResult<T> = {
  data?: T;
  error?: string;
};

type CampaignActor = {
  id: string;
  email: string;
};

const parseJson = async <T>(response: Response): Promise<ApiResult<T>> => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { error: payload?.error || "Não foi possível concluir a operação." };
  }

  return { data: payload?.data ?? payload };
};

const campaignHeaders = (actor: CampaignActor) => ({
  "content-type": "application/json",
  "x-user-id": actor.id,
  "x-user-email": actor.email,
});

export const apiListCampaigns = async (actor: CampaignActor) => {
  const response = await fetch("/api/campanhas", {
    headers: {
      "x-user-id": actor.id,
      "x-user-email": actor.email,
    },
  });

  return parseJson<SavedWhatsAppCampaign[]>(response);
};

export const apiCreateCampaign = async (actor: CampaignActor, payload: SaveWhatsAppCampaignPayload) => {
  const response = await fetch("/api/campanhas", {
    method: "POST",
    headers: campaignHeaders(actor),
    body: JSON.stringify(payload),
  });

  return parseJson<SavedWhatsAppCampaign>(response);
};

export const apiUploadCampaignAttachment = async (
  actor: CampaignActor,
  campaignId: string,
  payload: {
    name: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string;
  },
) => {
  const response = await fetch(`/api/campanhas/${encodeURIComponent(campaignId)}/attachments`, {
    method: "POST",
    headers: campaignHeaders(actor),
    body: JSON.stringify(payload),
  });

  return parseJson<SavedWhatsAppCampaign>(response);
};

export const apiDeleteCampaignAttachment = async (
  actor: CampaignActor,
  campaignId: string,
  attachmentId: string,
) => {
  const response = await fetch(
    `/api/campanhas/${encodeURIComponent(campaignId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: {
        "x-user-id": actor.id,
        "x-user-email": actor.email,
      },
    },
  );

  return parseJson<SavedWhatsAppCampaign>(response);
};

export const apiListCampaignHistory = async (actor: CampaignActor, id: string) => {
  const response = await fetch(`/api/campanhas/${encodeURIComponent(id)}/history`, {
    headers: {
      "x-user-id": actor.id,
      "x-user-email": actor.email,
    },
  });

  return parseJson<CampaignHistoryEntry[]>(response);
};

export const apiUpdateCampaign = async (
  actor: CampaignActor,
  id: string,
  payload: SaveWhatsAppCampaignPayload,
) => {
  const response = await fetch(`/api/campanhas/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: campaignHeaders(actor),
    body: JSON.stringify(payload),
  });

  return parseJson<SavedWhatsAppCampaign>(response);
};

export const apiDeleteCampaign = async (actor: CampaignActor, id: string) => {
  const response = await fetch(`/api/campanhas/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "x-user-id": actor.id,
      "x-user-email": actor.email,
    },
  });

  return parseJson<{ ok: boolean }>(response);
};
