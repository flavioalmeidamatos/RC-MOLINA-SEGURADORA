import { ReconciliationService } from "../../lib/server/services/reconciliation.service";

type VercelRequest = {
  method?: string;
  query?: {
    secret?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

export const config = {
  maxDuration: 60,
};

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "GET, OPTIONS");
};

const isCronRequest = (request: VercelRequest) =>
  String(request.headers?.["user-agent"] || "").includes("vercel-cron/1.0");

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Método não permitido." });
  }

  const expectedSecret = String(process.env.WHATSAPP_SYNC_SECRET || "").trim();
  const providedSecret =
    String(request.query?.secret || "").trim() ||
    String(request.headers?.["x-sync-secret"] || "").trim();

  if (expectedSecret && !isCronRequest(request) && providedSecret !== expectedSecret) {
    return response.status(401).json({ error: "Reconciliação não autorizada." });
  }

  try {
    const service = new ReconciliationService();
    const result = await service.runDefault();

    return response.status(200).json({
      success: true,
      instanceId: result.instanceId,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Erro inesperado na reconciliação.",
    });
  }
}
