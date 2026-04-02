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

type GreenApiQrResponse = {
  type?: string;
  message?: string;
};

export const config = {
  maxDuration: 30,
};

const GREEN_API_QR_URL =
  "https://7107.api.greenapi.com/waInstance7107375943/qr/0605c7c040e54a888ca58c312612109777c45c734bb049f782";

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, OPTIONS");
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
    const greenApiResponse = await fetch(GREEN_API_QR_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = (await greenApiResponse.json()) as GreenApiQrResponse;

    if (!greenApiResponse.ok) {
      return response.status(greenApiResponse.status).json({
        error: "Nao foi possivel obter o QR Code do WhatsApp.",
        details: payload,
      });
    }

    const base64Image = String(payload.message || "").trim();

    if (payload.type !== "qrCode" || !base64Image) {
      return response.status(502).json({
        error: "A Green API nao retornou um QR Code valido.",
        details: payload,
      });
    }

    return response.status(200).json({
      success: true,
      type: payload.type,
      qrCode: `data:image/png;base64,${base64Image}`,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao buscar QR Code do WhatsApp:", error);
    return response.status(500).json({
      error: "Erro interno ao consultar o QR Code do WhatsApp.",
    });
  }
}
