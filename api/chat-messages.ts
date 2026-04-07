import { decodeCursor, encodeCursor, type MessageCursor } from "../lib/domain/whatsapp";
import { InstanceRegistryService } from "../lib/server/services/instance-registry.service";
import { OpenConversationService } from "../lib/server/services/open-conversation.service";

type VercelRequest = {
  method?: string;
  query?: {
    instanceId?: string;
    chatId?: string;
    limit?: string;
    cursor?: string;
  };
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

export const config = {
  maxDuration: 30,
};

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
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const chatId = String(request.query?.chatId || "").trim();

    if (!chatId) {
      return response.status(400).json({ error: "chatId é obrigatório." });
    }

    const instances = new InstanceRegistryService();
    const instanceId =
      String(request.query?.instanceId || "").trim() || (await instances.ensureDefaultInstance());
    const limit = Number(request.query?.limit || 50);
    const cursor = decodeCursor<MessageCursor>(request.query?.cursor || null);

    const service = new OpenConversationService();
    const page = await service.open({
      instanceId,
      chatId,
      limit,
      cursor,
    });

    return response.status(200).json({
      success: true,
      instanceId,
      items: page.items,
      nextCursor: encodeCursor(page.nextCursor),
    });
  } catch (error) {
    return response.status(500).json({
      error:
        error instanceof Error ? error.message : "Erro inesperado ao carregar a conversa.",
    });
  }
}
