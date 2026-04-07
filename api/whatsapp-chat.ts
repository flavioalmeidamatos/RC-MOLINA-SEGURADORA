import { WhatsAppLegacyBridgeService } from "../lib/server/services/whatsapp-legacy-bridge.service.js";

type VercelRequest = {
  method?: string;
  query?: {
    chatId?: string;
    count?: string;
  };
  body?: {
    action?: "text" | "file" | "contact" | "poll";
    chatId?: string;
    message?: string;
    count?: number;
    fileName?: string;
    mimeType?: string;
    fileBase64?: string;
    fileUrl?: string;
    caption?: string;
    quotedMessageId?: string;
    typingType?: string;
    typingTime?: number;
    contact?: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      company?: string;
    };
    poll?: {
      question?: string;
      options?: string[];
      multipleAnswers?: boolean;
    };
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiChatMessage = {
  type?: "incoming" | "outgoing";
  idMessage?: string;
  timestamp?: number;
  statusMessage?: string;
  sendByApi?: boolean;
  typeMessage?: string;
  chatId?: string;
  senderId?: string;
  senderName?: string;
  senderContactName?: string;
  textMessage?: string;
  caption?: string;
  fileName?: string;
  downloadUrl?: string;
  jpegThumbnail?: string;
  mimeType?: string;
  isAnimated?: boolean;
};

type GreenApiContact = {
  id?: string;
  name?: string;
  contactName?: string;
};

type GreenApiSendMessageResponse = {
  idMessage?: string;
  urlFile?: string;
};

type GreenApiDownloadFileResponse = {
  downloadUrl?: string;
};

type GreenApiSendContactPayload = {
  chatId: string;
  contact: {
    phoneContact: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  };
};

type GreenApiSendPollPayload = {
  chatId: string;
  message: string;
  options: Array<{
    optionName: string;
  }>;
  multipleAnswers?: boolean;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_MEDIA_URL =
  "https://media.green-api.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";
const DEFAULT_HISTORY_COUNT = 50;

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, POST, OPTIONS");
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
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return payload as T;
};

const fetchGreenApiGet = async <T>(path: string) => {
  const response = await fetch(`${GREEN_API_BASE_URL}/${path}/${GREEN_API_TOKEN}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${path}.`);
  }

  return payload as T;
};

const fetchGreenApiUpload = async <T>(formData: FormData) => {
  const response = await fetch(`${GREEN_API_MEDIA_URL}/sendFileByUpload/${GREEN_API_TOKEN}`, {
    method: "POST",
    body: formData,
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(`Falha ao enviar arquivo para o WhatsApp.`);
  }

  return payload as T;
};

const needsDownloadLookup = (message: GreenApiChatMessage) =>
  ["imageMessage", "audioMessage", "stickerMessage", "documentMessage", "videoMessage"].includes(
    String(message.typeMessage || "")
  ) &&
  !String(message.downloadUrl || "").trim() &&
  String(message.chatId || "").trim() &&
  String(message.idMessage || "").trim();

const normalizePreview = (message: GreenApiChatMessage) => {
  const text = String(message.textMessage || "").trim();
  const caption = String(message.caption || "").trim();
  const fileName = String(message.fileName || "").trim();

  if (text) {
    return text;
  }

  if (caption) {
    return caption;
  }

  if (fileName) {
    return fileName;
  }

  const typeMap: Record<string, string> = {
    textMessage: "Mensagem",
    extendedTextMessage: "Mensagem",
    imageMessage: "Imagem",
    videoMessage: "Vídeo",
    documentMessage: "Documento",
    audioMessage: "Áudio",
    stickerMessage: "Sticker",
    contactMessage: "Contato",
    locationMessage: "Localização",
    pollMessage: "Enquete",
  };

  return typeMap[String(message.typeMessage || "")] || "Mensagem";
};

const toDataImage = (jpegThumbnail: string) =>
  jpegThumbnail ? `data:image/jpeg;base64,${jpegThumbnail}` : "";

const getPreferredContactName = (contact?: GreenApiContact) => {
  const contactBookName = String(contact?.contactName || "").trim();
  const profileName = String(contact?.name || "").trim();

  return contactBookName || profileName;
};

const normalizeParticipantId = (value: string) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.includes("@")
    ? normalizedValue
    : `${normalizedValue.replace(/\D/g, "")}@c.us`;
};

const resolveSenderLabel = (
  message: GreenApiChatMessage,
  contactsById: Map<string, GreenApiContact>
) => {
  const senderId = normalizeParticipantId(String(message.senderId || "").trim());
  const mappedName = getPreferredContactName(contactsById.get(senderId));
  const contactName = String(message.senderContactName || "").trim();
  const profileName = String(message.senderName || "").trim();

  return mappedName || contactName || profileName || senderId.replace(/@.+$/, "");
};

const normalizeHistory = async (
  messages: GreenApiChatMessage[],
  contactsById: Map<string, GreenApiContact>
) => {
  const orderedMessages = [...messages].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

  return Promise.all(
    orderedMessages.map(async (message) => {
      let mediaUrl = String(message.downloadUrl || "").trim();

      if (needsDownloadLookup(message)) {
        try {
          const downloadPayload = await fetchGreenApiPost<GreenApiDownloadFileResponse>("downloadFile", {
            chatId: String(message.chatId || "").trim(),
            idMessage: String(message.idMessage || "").trim(),
          });
          mediaUrl = String(downloadPayload.downloadUrl || "").trim();
        } catch (error) {
          console.warn("Não foi possível resolver a mídia do WhatsApp:", error);
        }
      }

      return {
        idMessage: String(message.idMessage || ""),
        chatId: String(message.chatId || ""),
        timestamp: Number(message.timestamp || 0),
        direction: message.type || "incoming",
        typeMessage: String(message.typeMessage || ""),
        text: normalizePreview(message),
        statusMessage: String(message.statusMessage || ""),
        senderName: resolveSenderLabel(message, contactsById),
        sendByApi: Boolean(message.sendByApi),
        fileName: String(message.fileName || "").trim(),
        mediaUrl,
        mimeType: String(message.mimeType || ""),
        thumbnailUrl: toDataImage(String(message.jpegThumbnail || "").trim()),
        isAnimated: Boolean(message.isAnimated),
      };
    })
  );
};

const normalizeBase64Payload = (rawBase64: string) => {
  const normalized = String(rawBase64 || "").trim();

  if (!normalized) {
    return "";
  }

  const [, payload = normalized] = normalized.split(",");
  return payload.replace(/\s/g, "");
};

const resolveUploadBuffer = async (fileBase64?: string, fileUrl?: string) => {
  const normalizedBase64 = normalizeBase64Payload(String(fileBase64 || ""));

  if (normalizedBase64) {
    return Buffer.from(normalizedBase64, "base64");
  }

  const normalizedFileUrl = String(fileUrl || "").trim();

  if (!normalizedFileUrl) {
    return null;
  }

  const remoteResponse = await fetch(normalizedFileUrl);

  if (!remoteResponse.ok) {
    throw new Error("Não foi possível buscar a mídia selecionada.");
  }

  const arrayBuffer = await remoteResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const sanitizeFileName = (fileName: string) =>
  String(fileName || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .slice(0, 140);

const buildContactPayload = (chatId: string, requestBody: VercelRequest["body"]): GreenApiSendContactPayload => {
  const firstName = String(requestBody?.contact?.firstName || "").trim();
  const lastName = String(requestBody?.contact?.lastName || "").trim();
  const phoneNumber = String(requestBody?.contact?.phoneNumber || "").replace(/\D/g, "");
  const company = String(requestBody?.contact?.company || "").trim();

  if (!firstName || !phoneNumber) {
    throw new Error("Informe nome e telefone do contato.");
  }

  return {
    chatId,
    contact: {
      phoneContact: phoneNumber,
      firstName,
      lastName,
      company,
    },
  };
};

const buildPollPayload = (chatId: string, requestBody: VercelRequest["body"]): GreenApiSendPollPayload => {
  const question = String(requestBody?.poll?.question || "").trim();
  const options = Array.isArray(requestBody?.poll?.options)
    ? requestBody?.poll?.options
        .map((option) => String(option || "").trim())
        .filter(Boolean)
    : [];

  if (!question || options.length < 2) {
    throw new Error("Informe a pergunta e pelo menos duas opções para a enquete.");
  }

  return {
    chatId,
    message: question,
    options: options.map((optionName) => ({
      optionName,
    })),
    multipleAnswers: Boolean(requestBody?.poll?.multipleAnswers),
  };
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  try {
    if (request.method === "GET") {
      const chatId = String(request.query?.chatId || "").trim();
      const count = Number(request.query?.count || DEFAULT_HISTORY_COUNT);

      if (!chatId) {
        return response.status(400).json({ error: "chatId é obrigatório." });
      }

      const bridge = new WhatsAppLegacyBridgeService();
      const storeHistory = await bridge.getLegacyChatHistory({
        chatWaId: chatId,
        count,
      });

      if (storeHistory?.messages?.length) {
        return response.status(200).json({
          success: true,
          chatId,
          messages: storeHistory.messages,
          source: "supabase-store",
        });
      }

      const history = await fetchGreenApiPost<GreenApiChatMessage[]>("getChatHistory", {
        chatId,
        count,
      });
      const contacts = await fetchGreenApiGet<GreenApiContact[]>("getContacts");
      const contactsById = new Map(
        (Array.isArray(contacts) ? contacts : [])
          .map((contact) => [normalizeParticipantId(String(contact.id || "").trim()), contact] as const)
          .filter(([contactId]) => contactId)
      );

      return response.status(200).json({
        success: true,
        chatId,
        messages: await normalizeHistory(Array.isArray(history) ? history : [], contactsById),
        source: "green-api",
      });
    }

    if (request.method === "POST") {
      const action = String(request.body?.action || "text").trim();
      const chatId = String(request.body?.chatId || "").trim();

      if (!chatId) {
        return response.status(400).json({ error: "chatId é obrigatório." });
      }

      if (action === "text") {
        const message = String(request.body?.message || "").trim();

        if (!message) {
          return response.status(400).json({ error: "message é obrigatório." });
        }

        const sendResult = await fetchGreenApiPost<GreenApiSendMessageResponse>("sendMessage", {
          chatId,
          message,
        });

        return response.status(200).json({
          success: true,
          action,
          chatId,
          idMessage: String(sendResult.idMessage || ""),
        });
      }

      if (action === "file") {
        const fileName = sanitizeFileName(String(request.body?.fileName || ""));
        const mimeType = String(request.body?.mimeType || "application/octet-stream").trim();
        const caption = String(request.body?.caption || "").trim();
        const quotedMessageId = String(request.body?.quotedMessageId || "").trim();
        const typingType = String(request.body?.typingType || "").trim();
        const typingTime = Number(request.body?.typingTime || 0);
        const fileBuffer = await resolveUploadBuffer(
          String(request.body?.fileBase64 || ""),
          String(request.body?.fileUrl || "")
        );

        if (!fileName || !fileBuffer) {
          return response.status(400).json({ error: "fileName e mídia são obrigatórios." });
        }

        const formData = new FormData();
        formData.append("chatId", chatId);
        formData.append("fileName", fileName);
        formData.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

        if (caption) {
          formData.append("caption", caption);
        }

        if (quotedMessageId) {
          formData.append("quotedMessageId", quotedMessageId);
        }

        if (typingType) {
          formData.append("typingType", typingType);
        }

        if (typingTime >= 1000) {
          formData.append("typingTime", String(Math.min(20000, typingTime)));
        }

        const sendResult = await fetchGreenApiUpload<GreenApiSendMessageResponse>(formData);

        return response.status(200).json({
          success: true,
          action,
          chatId,
          idMessage: String(sendResult.idMessage || ""),
          urlFile: String(sendResult.urlFile || ""),
        });
      }

      if (action === "contact") {
        const payload = buildContactPayload(chatId, request.body);
        const sendResult = await fetchGreenApiPost<GreenApiSendMessageResponse>("sendContact", payload);

        return response.status(200).json({
          success: true,
          action,
          chatId,
          idMessage: String(sendResult.idMessage || ""),
        });
      }

      if (action === "poll") {
        const payload = buildPollPayload(chatId, request.body);
        const sendResult = await fetchGreenApiPost<GreenApiSendMessageResponse>("sendPoll", payload);

        return response.status(200).json({
          success: true,
          action,
          chatId,
          idMessage: String(sendResult.idMessage || ""),
        });
      }

      return response.status(400).json({ error: "Ação de envio inválida." });
    }

    return response.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error("Erro ao consultar/enviar mensagens do WhatsApp:", error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno ao consultar ou enviar mensagens do WhatsApp.",
    });
  }
}
