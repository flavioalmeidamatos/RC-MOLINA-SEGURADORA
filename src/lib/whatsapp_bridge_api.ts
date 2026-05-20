import type { WhatsAppBridgeStatus, WhatsAppDispatchPayload, WhatsAppDispatchResult } from "../types/whatsapp_campaign";

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
    return { error: payload?.error || "Nao foi possivel concluir a operacao." };
  }

  return { data: payload?.data ?? payload };
};

const actorHeaders = (actor: CampaignActor) => ({
  "content-type": "application/json",
  "x-user-id": actor.id,
  "x-user-email": actor.email,
});

export const apiGetWhatsAppBridgeStatus = async (actor: CampaignActor) => {
  const response = await fetch("/api/whatsapp-bridge/status", {
    headers: {
      "x-user-id": actor.id,
      "x-user-email": actor.email,
    },
  });

  return parseJson<WhatsAppBridgeStatus>(response);
};

export const apiLogoutWhatsAppBridge = async (actor: CampaignActor) => {
  const response = await fetch("/api/whatsapp-bridge/logout", {
    method: "POST",
    headers: actorHeaders(actor),
  });

  return parseJson<{ ok: boolean }>(response);
};

export const apiSendWhatsAppCampaign = async (actor: CampaignActor, payload: WhatsAppDispatchPayload) => {
  const response = await fetch("/api/whatsapp-bridge/send", {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(payload),
  });

  return parseJson<WhatsAppDispatchResult>(response);
};
