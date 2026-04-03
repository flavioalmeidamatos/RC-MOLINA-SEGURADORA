type VercelRequest = {
  method?: string;
  query?: {
    chatId?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

type GreenApiAvatarResponse = {
  urlAvatar?: string;
  available?: boolean;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL =
  "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, OPTIONS");
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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const chatId = String(request.query?.chatId || "").trim();

    if (!chatId) {
      return response.status(400).json({ error: "chatId e obrigatorio." });
    }

    const avatarPayload = await fetchGreenApiPost<GreenApiAvatarResponse>("getAvatar", {
      chatId,
    });

    return response.status(200).json({
      success: true,
      chatId,
      avatarUrl: String(avatarPayload.urlAvatar || "").trim(),
      available: Boolean(avatarPayload.available),
    });
  } catch (error) {
    console.error("Erro ao consultar avatar do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar avatar do WhatsApp.",
    });
  }
}
