import { WhatsAppLegacyBridgeService } from "../lib/server/services/whatsapp-legacy-bridge.service";

type VercelRequest = {
  method?: string;
  body?: {
    action?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiStateResponse = {
  stateInstance?: string;
};

type GreenApiStatusResponse = {
  statusInstance?: string;
};

type GreenApiLogoutResponse = {
  isLogout?: boolean;
};

type GreenApiQrResponse = {
  type?: string;
  message?: string;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL = "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";
const INSTANCE_RETRY_COUNT = 2;
const POSITIVE_INSTANCE_STATES = new Set(["authorized"]);
const POSITIVE_INSTANCE_STATUS = new Set(["online"]);
const EXPLICIT_DISCONNECTED_STATES = new Set(["notauthorized", "blocked", "sleepmode"]);
const EXPLICIT_DISCONNECTED_STATUS = new Set(["disconnected", "blocked", "notauthorized"]);

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

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return (await response.json()) as T;
};

const fetchGreenApiGetWithRetry = async <T>(path: string, retries = INSTANCE_RETRY_COUNT) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchGreenApiGet<T>(path);
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Falha ao consultar ${path}.`);
};

const isPositiveConnectionSignal = (stateInstance: string, statusInstance: string) =>
  POSITIVE_INSTANCE_STATES.has(stateInstance.toLowerCase()) ||
  POSITIVE_INSTANCE_STATUS.has(statusInstance.toLowerCase());

const isExplicitDisconnectionSignal = (stateInstance: string, statusInstance: string) =>
  EXPLICIT_DISCONNECTED_STATES.has(stateInstance.toLowerCase()) ||
  EXPLICIT_DISCONNECTED_STATUS.has(statusInstance.toLowerCase());

const resolveConnectionSnapshot = async () => {
  const [stateResult, statusResult, qrResult] = await Promise.allSettled([
    fetchGreenApiGetWithRetry<GreenApiStateResponse>("getStateInstance"),
    fetchGreenApiGetWithRetry<GreenApiStatusResponse>("getStatusInstance"),
    fetchGreenApiGetWithRetry<GreenApiQrResponse>("qr", 0),
  ]);

  const stateInstance =
    stateResult.status === "fulfilled" ? String(stateResult.value.stateInstance || "").trim() : "";
  const statusInstance =
    statusResult.status === "fulfilled" ? String(statusResult.value.statusInstance || "").trim() : "";
  const qrType = qrResult.status === "fulfilled" ? String(qrResult.value.type || "").trim() : "";
  const qrMessage = qrResult.status === "fulfilled" ? String(qrResult.value.message || "").trim() : "";
  const hasQrCode = qrType === "qrCode" && Boolean(qrMessage);
  const hasPositiveSignal = isPositiveConnectionSignal(stateInstance, statusInstance);
  const hasExplicitDisconnection = isExplicitDisconnectionSignal(stateInstance, statusInstance);
  const connected =
    hasPositiveSignal ||
    (!hasQrCode && !hasExplicitDisconnection && Boolean(stateInstance || statusInstance));
  const validated =
    stateResult.status === "fulfilled" ||
    statusResult.status === "fulfilled" ||
    qrResult.status === "fulfilled";

  return {
    connected,
    validated,
    stateInstance,
    statusInstance,
    qrCode: hasQrCode ? `data:image/png;base64,${qrMessage}` : "",
  };
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  try {
    if (request.method === "GET") {
      const snapshot = await resolveConnectionSnapshot();
      const bridge = new WhatsAppLegacyBridgeService();
      void bridge.updateInstanceSnapshot(snapshot).catch((error) => {
        console.warn("Nao foi possivel atualizar o snapshot da instancia no store:", error);
      });

      return response.status(200).json({
        success: true,
        connected: snapshot.connected,
        validated: snapshot.validated,
        stateInstance: snapshot.stateInstance,
        statusInstance: snapshot.statusInstance,
        qrCode: snapshot.qrCode,
      });
    }

    if (request.method === "POST") {
      if (String(request.body?.action || "").trim() !== "logout") {
        return response.status(400).json({ error: "Acao invalida." });
      }

      const logoutPayload = await fetchGreenApiGet<GreenApiLogoutResponse>("logout");

      return response.status(200).json({
        success: true,
        isLogout: Boolean(logoutPayload.isLogout),
      });
    }

    return response.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    console.error("Erro ao consultar/logout da instancia do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar ou encerrar a instancia do WhatsApp.",
    });
  }
}
