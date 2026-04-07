import { decodeCursor, encodeCursor, type ChatCursor } from "../../lib/domain/whatsapp.js";
import { ChatRepository } from "../../lib/server/repositories/chat-repository.js";
import { InstanceRegistryService } from "../../lib/server/services/instance-registry.service.js";

type VercelRequest = {
  method?: string;
  query?: {
    instanceId?: string;
    limit?: string;
    cursor?: string;
    archived?: string;
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
  maxDuration: 15,
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
    const instances = new InstanceRegistryService();
    const instanceId =
      String(request.query?.instanceId || "").trim() || (await instances.ensureDefaultInstance());
    const limit = Number(request.query?.limit || 40);
    const archived = String(request.query?.archived || "false") === "true";
    const cursor = decodeCursor<ChatCursor>(request.query?.cursor || null);

    const repository = new ChatRepository();
    const page = await repository.listPage({
      instanceId,
      limit,
      cursor,
      archived,
    });

    return response.status(200).json({
      success: true,
      instanceId,
      items: page.items,
      nextCursor: encodeCursor(page.nextCursor),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Erro inesperado ao listar chats.",
    });
  }
}
