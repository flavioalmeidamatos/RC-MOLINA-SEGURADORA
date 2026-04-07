import { WhatsAppLegacyBridgeService } from "../lib/server/services/whatsapp-legacy-bridge.service";

type VercelRequest = {
  method?: string;
  query?: {
    receiveTimeout?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiSettingsResponse = {
  webhookUrl?: string;
  incomingWebhook?: string;
  outgoingWebhook?: string;
  outgoingMessageWebhook?: string;
  outgoingAPIMessageWebhook?: string;
  stateWebhook?: string;
  statusInstanceChangedWebhook?: string;
};

type GreenApiReceiveNotificationResponse = {
  receiptId?: number;
  body?: {
    typeWebhook?: string;
    [key: string]: unknown;
  };
};

type GreenApiDeleteNotificationResponse = {
  result?: boolean;
};

export const config = {
  maxDuration: 60,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";
const DEFAULT_RECEIVE_TIMEOUT = 20;

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, POST, OPTIONS");
};

const fetchGreenApiGet = async <T>(path: string) => {
  const response = await fetch(`${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return payload as T;
};

const fetchGreenApiDelete = async <T>(path: string) => {
  const response = await fetch(`${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return payload as T;
};

const fetchGreenApiPost = async <T>(path: string, body: unknown) => {
  const response = await fetch(`${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return payload as T;
};

const normalizeReceiveTimeout = (rawValue?: string) => {
  const numericValue = Number(rawValue || DEFAULT_RECEIVE_TIMEOUT);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_RECEIVE_TIMEOUT;
  }

  return Math.max(5, Math.min(60, Math.floor(numericValue)));
};

const ensureQueueNotificationSettings = async () => {
  const settings = await fetchGreenApiGet<GreenApiSettingsResponse>("getSettings");

  const isConfigured =
    String(settings?.webhookUrl || "").trim() === "" &&
    String(settings?.incomingWebhook || "").toLowerCase() === "yes" &&
    String(settings?.outgoingWebhook || "").toLowerCase() === "yes" &&
    String(settings?.outgoingMessageWebhook || "").toLowerCase() === "yes" &&
    String(settings?.outgoingAPIMessageWebhook || "").toLowerCase() === "yes" &&
    String(settings?.stateWebhook || "").toLowerCase() === "yes" &&
    String(settings?.statusInstanceChangedWebhook || "").toLowerCase() === "yes";

  if (isConfigured) {
    return {
      configured: true,
      changed: false,
    };
  }

  await fetchGreenApiPost("setSettings", {
    webhookUrl: "",
    incomingWebhook: "yes",
    outgoingWebhook: "yes",
    outgoingMessageWebhook: "yes",
    outgoingAPIMessageWebhook: "yes",
    stateWebhook: "yes",
    statusInstanceChangedWebhook: "yes",
  });

  return {
    configured: true,
    changed: true,
  };
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  try {
    if (request.method === "POST") {
      const settingsResult = await ensureQueueNotificationSettings();

      return response.status(200).json({
        success: true,
        configured: settingsResult.configured,
        changed: settingsResult.changed,
      });
    }

    if (request.method === "GET") {
      const receiveTimeout = normalizeReceiveTimeout(request.query?.receiveTimeout);
      const notification = await fetchGreenApiGet<GreenApiReceiveNotificationResponse | null>(
        `receiveNotification?receiveTimeout=${receiveTimeout}`
      );

      if (!notification || !notification.receiptId) {
        return response.status(200).json({
          success: true,
          notification: null,
        });
      }

      const deleteResult = await fetchGreenApiDelete<GreenApiDeleteNotificationResponse>(
        `deleteNotification/${notification.receiptId}`
      );

      if (notification.body) {
        const bridge = new WhatsAppLegacyBridgeService();
        void bridge.ingestNotification(notification.body as any).catch((error) => {
          console.warn("Nao foi possivel persistir a notificacao no Supabase store:", error);
        });
      }

      return response.status(200).json({
        success: true,
        notification,
        deleted: Boolean(deleteResult?.result),
      });
    }

    return response.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error("Erro ao consumir notificações do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consumir notificações do WhatsApp.",
    });
  }
}
