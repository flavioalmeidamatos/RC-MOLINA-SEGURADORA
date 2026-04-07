import { BootstrapInitialService } from "../lib/server/services/bootstrap-initial.service.js";
import { WhatsAppLegacyBridgeService } from "../lib/server/services/whatsapp-legacy-bridge.service.js";

type VercelRequest = {
  method?: string;
  query?: {
    q?: string;
    limit?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiQrResponse = {
  type?: string;
  message?: string;
};

type GreenApiStateResponse = {
  stateInstance?: string;
};

type GreenApiStatusResponse = {
  statusInstance?: string;
};

type GreenApiContact = {
  id?: string;
  name?: string;
  contactName?: string;
  type?: "user" | "group";
};

type WhatsAppDirectoryItem = {
  chatId: string;
  title: string;
  subtitle: string;
  preview: string;
  timestamp: number;
  direction: string;
  typeMessage: string;
  statusMessage: string;
  isGroup: boolean;
  unreadCount: number;
  latestIncomingTimestamp: number;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";
const INSTANCE_RETRY_COUNT = 2;
const GREEN_API_REQUEST_TIMEOUT_MS = 8000;
const POSITIVE_INSTANCE_STATES = new Set(["authorized"]);
const POSITIVE_INSTANCE_STATUS = new Set(["online"]);
const EXPLICIT_DISCONNECTED_STATES = new Set(["notauthorized", "blocked", "sleepmode"]);
const EXPLICIT_DISCONNECTED_STATUS = new Set(["disconnected", "blocked", "notauthorized"]);

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, OPTIONS");
};

const fetchGreenApi = async <T>(path: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GREEN_API_REQUEST_TIMEOUT_MS);
  const response = await fetch(`${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return (await response.json()) as T;
};

const fetchGreenApiWithQuery = async <T>(path: string, query: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GREEN_API_REQUEST_TIMEOUT_MS);
  const response = await fetch(
    `${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}?${query}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    }
  ).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return (await response.json()) as T;
};

const fetchGreenApiWithRetry = async <T>(path: string, retries = INSTANCE_RETRY_COUNT) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchGreenApi<T>(path);
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

const fetchGreenApiWithQueryRetry = async <T>(
  path: string,
  query: string,
  retries = INSTANCE_RETRY_COUNT
) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchGreenApiWithQuery<T>(path, query);
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

const formatPhoneNumber = (chatId: string) => {
  const digits = chatId.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return chatId.replace(/@.+$/, "");
};

const getPreferredContactName = (contact?: GreenApiContact) => {
  const contactBookName = String(contact?.contactName || "").trim();
  const profileName = String(contact?.name || "").trim();

  if (contactBookName) {
    return contactBookName;
  }

  if (profileName) {
    return profileName;
  }

  return "";
};

const buildChatSubtitle = (chatId: string, contact?: GreenApiContact) => {
  const preferredName = getPreferredContactName(contact);
  const profileName = String(contact?.name || "").trim();

  if (contact?.type === "group" || chatId.endsWith("@g.us")) {
    return preferredName && preferredName !== profileName && profileName
      ? `Grupo • ${profileName}`
      : "Grupo";
  }

  if (preferredName && profileName && preferredName !== profileName) {
    return profileName;
  }

  if (preferredName) {
    return "Contato";
  }

  return formatPhoneNumber(chatId);
};

const buildDirectoryItem = (contact: GreenApiContact): WhatsAppDirectoryItem | null => {
  const chatId = String(contact.id || "").trim();

  if (!chatId || chatId === "status@broadcast") {
    return null;
  }

  return {
    chatId,
    title: getPreferredContactName(contact) || formatPhoneNumber(chatId),
    subtitle: buildChatSubtitle(chatId, contact),
    preview:
      contact.type === "group"
        ? "Grupo disponível para abrir a conversa"
        : "Contato disponível para iniciar conversa",
    timestamp: 0,
    direction: "incoming",
    typeMessage: "textMessage",
    statusMessage: "",
    isGroup: String(contact.type || "") === "group" || chatId.endsWith("@g.us"),
    unreadCount: 0,
    latestIncomingTimestamp: 0,
  };
};

const mergeContacts = (...contactLists: GreenApiContact[][]) => {
  const contactsById = new Map<string, GreenApiContact>();

  contactLists.flat().forEach((contact) => {
    const contactId = String(contact?.id || "").trim();

    if (!contactId) {
      return;
    }

    const currentContact = contactsById.get(contactId);
    contactsById.set(contactId, {
      ...currentContact,
      ...contact,
    });
  });

  return Array.from(contactsById.values());
};

const isPositiveConnectionSignal = (stateInstance: string, statusInstance: string) =>
  POSITIVE_INSTANCE_STATES.has(stateInstance.toLowerCase()) ||
  POSITIVE_INSTANCE_STATUS.has(statusInstance.toLowerCase());

const isExplicitDisconnectionSignal = (stateInstance: string, statusInstance: string) =>
  EXPLICIT_DISCONNECTED_STATES.has(stateInstance.toLowerCase()) ||
  EXPLICIT_DISCONNECTED_STATUS.has(statusInstance.toLowerCase());

const resolveConnectionSnapshot = async () => {
  const [stateResult, statusResult, qrResult] = await Promise.allSettled([
    fetchGreenApiWithRetry<GreenApiStateResponse>("getStateInstance"),
    fetchGreenApiWithRetry<GreenApiStatusResponse>("getStatusInstance"),
    fetchGreenApiWithRetry<GreenApiQrResponse>("qr", 0),
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

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const snapshot = await resolveConnectionSnapshot();
    const bridge = new WhatsAppLegacyBridgeService();
    const searchQuery = String(request.query?.q || "").trim();
    const requestedLimit = Number(request.query?.limit || (searchQuery ? 120 : 600));
    const safeLimit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 600, 1), 5000);
    void bridge.updateInstanceSnapshot(snapshot).catch((error) => {
      console.warn("Nao foi possivel sincronizar o snapshot da instancia:", error);
    });

    if (!snapshot.connected) {
      return response.status(200).json({
        success: true,
        connected: false,
        validated: snapshot.validated,
        stateInstance: snapshot.stateInstance,
        statusInstance: snapshot.statusInstance,
        qrCode: snapshot.qrCode,
        contacts: [],
        fetchedAt: new Date().toISOString(),
      });
    }

    const storeDirectory = await bridge.getLegacyDirectory({
      query: searchQuery,
      limit: safeLimit,
    });

    if (storeDirectory?.hasData) {
      return response.status(200).json({
        success: true,
        connected: true,
        validated: snapshot.validated,
        stateInstance: snapshot.stateInstance,
        statusInstance: snapshot.statusInstance,
        qrCode: snapshot.qrCode,
        contacts: storeDirectory.contacts,
        fetchedAt: new Date().toISOString(),
        source: "supabase-store",
      });
    }

    if (await bridge.canUseStore()) {
      const instanceId = await bridge.ensureInstanceId();

      if (instanceId) {
        try {
          await new BootstrapInitialService().run(instanceId);
          const hydratedDirectory = await bridge.getLegacyDirectory({
            query: searchQuery,
            limit: safeLimit,
          });

          if (hydratedDirectory?.hasData) {
            return response.status(200).json({
              success: true,
              connected: true,
              validated: snapshot.validated,
              stateInstance: snapshot.stateInstance,
              statusInstance: snapshot.statusInstance,
              qrCode: snapshot.qrCode,
              contacts: hydratedDirectory.contacts,
              fetchedAt: new Date().toISOString(),
              source: "supabase-store",
            });
          }
        } catch (storeError) {
          console.warn("Nao foi possivel hidratar o diretorio pelo Supabase store:", storeError);
        }
      }
    }

    const [contactsResult, groupsResult] = await Promise.allSettled([
      fetchGreenApiWithRetry<GreenApiContact[]>("getContacts"),
      fetchGreenApiWithQueryRetry<GreenApiContact[]>("getContacts", "group=true"),
    ]);

    const contacts = contactsResult.status === "fulfilled" ? contactsResult.value : [];
    const groups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
    const mergedContacts = mergeContacts(contacts || [], groups || []);
    const directory = mergedContacts
      .map((contact) => buildDirectoryItem(contact))
      .filter((contact): contact is WhatsAppDirectoryItem => Boolean(contact))
      .sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));

    return response.status(200).json({
      success: true,
      connected: true,
      validated: snapshot.validated,
      stateInstance: snapshot.stateInstance,
      statusInstance: snapshot.statusInstance,
      qrCode: snapshot.qrCode,
      contacts: directory,
      fetchedAt: new Date().toISOString(),
      source: "green-api",
    });
  } catch (error) {
    console.error("Erro ao montar diretorio do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar o diretorio do WhatsApp.",
    });
  }
}
