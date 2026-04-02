type VercelRequest = {
  method?: string;
  query?: {
    chatId?: string;
    count?: string;
  };
  body?: {
    chatId?: string;
    message?: string;
    count?: number;
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
};

type GreenApiSendMessageResponse = {
  idMessage?: string;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
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
    videoMessage: "Video",
    documentMessage: "Documento",
    audioMessage: "Audio",
    stickerMessage: "Sticker",
    contactMessage: "Contato",
    locationMessage: "Localizacao",
  };

  return typeMap[String(message.typeMessage || "")] || "Mensagem";
};

const normalizeHistory = (messages: GreenApiChatMessage[]) =>
  [...messages]
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
    .map((message) => ({
      idMessage: String(message.idMessage || ""),
      chatId: String(message.chatId || ""),
      timestamp: Number(message.timestamp || 0),
      direction: message.type || "incoming",
      typeMessage: String(message.typeMessage || ""),
      text: normalizePreview(message),
      statusMessage: String(message.statusMessage || ""),
      senderName: String(message.senderContactName || message.senderName || "").trim(),
      sendByApi: Boolean(message.sendByApi),
    }));

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
        return response.status(400).json({ error: "chatId e obrigatorio." });
      }

      const history = await fetchGreenApiPost<GreenApiChatMessage[]>("getChatHistory", {
        chatId,
        count,
      });

      return response.status(200).json({
        success: true,
        chatId,
        messages: normalizeHistory(Array.isArray(history) ? history : []),
      });
    }

    if (request.method === "POST") {
      const chatId = String(request.body?.chatId || "").trim();
      const message = String(request.body?.message || "").trim();

      if (!chatId || !message) {
        return response.status(400).json({ error: "chatId e message sao obrigatorios." });
      }

      const sendResult = await fetchGreenApiPost<GreenApiSendMessageResponse>("sendMessage", {
        chatId,
        message,
      });

      return response.status(200).json({
        success: true,
        chatId,
        idMessage: String(sendResult.idMessage || ""),
      });
    }

    return response.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    console.error("Erro ao consultar/enviar mensagens do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar ou enviar mensagens do WhatsApp.",
    });
  }
}
