type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiMessage = {
  chatId?: string;
  timestamp?: number;
  type?: "incoming" | "outgoing";
  typeMessage?: string;
  textMessage?: string;
  caption?: string;
  fileName?: string;
  statusMessage?: string;
  senderName?: string;
  senderContactName?: string;
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

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";
const CHATS_LOOKBACK_MINUTES = 1440;

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, OPTIONS");
};

const fetchGreenApi = async <T>(path: string) => {
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

const fetchGreenApiWithQuery = async <T>(path: string, query: string) => {
  const response = await fetch(
    `${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}?${query}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return (await response.json()) as T;
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

const buildChatTitle = (message: GreenApiMessage, contact?: GreenApiContact) => {
  const mappedName = getPreferredContactName(contact);

  if (mappedName) {
    return mappedName;
  }

  const senderName = String(message.senderContactName || message.senderName || "").trim();

  if (senderName) {
    return senderName;
  }

  const chatId = String(message.chatId || "");

  if (chatId.endsWith("@g.us")) {
    const groupId = chatId.replace("@g.us", "");
    return `Grupo ${groupId.slice(0, 12)}`;
  }

  return formatPhoneNumber(chatId);
};

const buildChatSubtitle = (message: GreenApiMessage, contact?: GreenApiContact) => {
  const preferredName = getPreferredContactName(contact);
  const profileName = String(contact?.name || "").trim();
  const chatId = String(message.chatId || "");

  if (contact?.type === "group") {
    return preferredName && preferredName !== profileName && profileName
      ? `Grupo • ${profileName}`
      : "Grupo do WhatsApp";
  }

  if (preferredName && profileName && preferredName !== profileName) {
    return profileName;
  }

  if (preferredName) {
    return "Contato do WhatsApp";
  }

  if (chatId.endsWith("@g.us")) {
    return "Grupo";
  }

  return formatPhoneNumber(chatId);
};

const buildPreview = (message: GreenApiMessage) => {
  const directText = String(message.textMessage || "").trim();
  const caption = String(message.caption || "").trim();
  const fileName = String(message.fileName || "").trim();

  if (directText) {
    return directText;
  }

  if (caption) {
    return caption;
  }

  if (fileName) {
    return fileName;
  }

  const typeMap: Record<string, string> = {
    imageMessage: "Imagem",
    videoMessage: "Video",
    audioMessage: "Audio",
    documentMessage: "Documento",
    extendedTextMessage: "Mensagem",
    textMessage: "Mensagem",
    stickerMessage: "Sticker",
  };

  return typeMap[String(message.typeMessage || "")] || "Midia recebida";
};

const buildChats = (
  incomingMessages: GreenApiMessage[],
  outgoingMessages: GreenApiMessage[],
  contacts: GreenApiContact[]
) => {
  const latestByChat = new Map<string, GreenApiMessage>();
  const contactsById = new Map(
    contacts
      .map((contact) => [String(contact.id || "").trim(), contact] as const)
      .filter(([id]) => id)
  );

  [...incomingMessages, ...outgoingMessages]
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .forEach((message) => {
      const chatId = String(message.chatId || "").trim();

      if (!chatId || latestByChat.has(chatId)) {
        return;
      }

      latestByChat.set(chatId, message);
    });

  return Array.from(latestByChat.values())
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .map((message) => {
      const chatId = String(message.chatId || "").trim();
      const contact = contactsById.get(chatId);

      return {
        chatId,
        title: buildChatTitle(message, contact),
        subtitle: buildChatSubtitle(message, contact),
        preview: buildPreview(message),
        timestamp: Number(message.timestamp || 0),
        direction: message.type || "incoming",
        typeMessage: String(message.typeMessage || ""),
        statusMessage: String(message.statusMessage || ""),
        isGroup: String(contact?.type || "") === "group" || chatId.endsWith("@g.us"),
      };
    });
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
    const [statePayload, statusPayload] = await Promise.all([
      fetchGreenApi<GreenApiStateResponse>("getStateInstance"),
      fetchGreenApi<GreenApiStatusResponse>("getStatusInstance"),
    ]);

    const stateInstance = String(statePayload.stateInstance || "");
    const statusInstance = String(statusPayload.statusInstance || "");
    const isConnected = stateInstance === "authorized" && statusInstance === "online";

    if (!isConnected) {
      const qrPayload = await fetchGreenApi<GreenApiQrResponse>("qr");
      const base64Image = String(qrPayload.message || "").trim();

      return response.status(200).json({
        success: true,
        connected: false,
        stateInstance,
        statusInstance,
        qrCode: qrPayload.type === "qrCode" && base64Image
          ? `data:image/png;base64,${base64Image}`
          : "",
        fetchedAt: new Date().toISOString(),
      });
    }

    const [incomingMessages, outgoingMessages, contacts] = await Promise.all([
      fetchGreenApiWithQuery<GreenApiMessage[]>(
        "lastIncomingMessages",
        `minutes=${CHATS_LOOKBACK_MINUTES}`
      ),
      fetchGreenApiWithQuery<GreenApiMessage[]>(
        "lastOutgoingMessages",
        `minutes=${CHATS_LOOKBACK_MINUTES}`
      ),
      fetchGreenApi<GreenApiContact[]>("getContacts"),
    ]);

    return response.status(200).json({
      success: true,
      connected: true,
      stateInstance,
      statusInstance,
      chats: buildChats(incomingMessages || [], outgoingMessages || [], contacts || []),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao montar painel do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar a conexao e os chats do WhatsApp.",
    });
  }
}
