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

export const config = {
  maxDuration: 30,
};

const GREEN_API_BASE_URL = "https://7107.api.greenapi.com/waInstance7107375943";
const GREEN_API_TOKEN = "0605c7c040e54a888ca58c312612109777c45c734bb049f782";

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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  try {
    if (request.method === "GET") {
      const [statePayload, statusPayload] = await Promise.all([
        fetchGreenApiGet<GreenApiStateResponse>("getStateInstance"),
        fetchGreenApiGet<GreenApiStatusResponse>("getStatusInstance"),
      ]);

      const stateInstance = String(statePayload.stateInstance || "");
      const statusInstance = String(statusPayload.statusInstance || "");

      return response.status(200).json({
        success: true,
        connected: stateInstance === "authorized" && statusInstance === "online",
        stateInstance,
        statusInstance,
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
