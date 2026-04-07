import type { GreenApiWebhookPayload } from "../../lib/domain/whatsapp";
import { normalizeWebhookPayload } from "../../lib/domain/whatsapp";
import { getSupabaseAdmin } from "../../lib/server/supabase-admin";
import { InstanceRegistryService } from "../../lib/server/services/instance-registry.service";
import { MutationPersistenceService } from "../../lib/server/services/mutation-persistence.service";
import { buildWebhookDedupeKey, registerWebhookInboxEvent } from "../../lib/server/utils/idempotency";
import { logger } from "../../lib/server/utils/logger";

type VercelRequest = {
  method?: string;
  body?: GreenApiWebhookPayload;
  query?: {
    instanceId?: string;
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
  maxDuration: 15,
};

const applyHeaders = (response: VercelResponse) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  response.setHeader("Allow", "POST, OPTIONS");
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Método não permitido." });
  }

  const expectedSecret = String(process.env.GREEN_API_WEBHOOK_SECRET || "").trim();
  const providedSecret =
    String(request.query?.secret || "").trim() ||
    String(request.headers?.["x-webhook-secret"] || "").trim();

  if (expectedSecret && providedSecret !== expectedSecret) {
    return response.status(401).json({ error: "Webhook não autorizado." });
  }

  try {
    const instances = new InstanceRegistryService();
    const instanceId =
      String(request.query?.instanceId || "").trim() || (await instances.ensureDefaultInstance());
    const payload = request.body || {};
    const db = getSupabaseAdmin();
    const persistence = new MutationPersistenceService();
    const dedupeKey = buildWebhookDedupeKey(instanceId, payload);

    const inbox = await registerWebhookInboxEvent({
      db,
      instanceId,
      dedupeKey,
      eventType: String(payload.typeWebhook || "unknown"),
      waChatId: String(payload.senderData?.chatId || "").trim() || null,
      waMessageId: String(payload.idMessage || "").trim() || null,
      payload,
    });

    if (!inbox.isNew) {
      return response.status(200).json({
        success: true,
        duplicated: true,
      });
    }

    const mutation = normalizeWebhookPayload(payload);
    await persistence.apply(instanceId, mutation);

    await db
      .from("webhook_events")
      .update({
        process_status: "processed",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", inbox.eventId);

    logger.info("green_webhook_processed", {
      instanceId,
      eventId: inbox.eventId,
      eventType: payload.typeWebhook,
    });

    return response.status(200).json({
      success: true,
      instanceId,
      eventId: inbox.eventId,
    });
  } catch (error) {
    logger.error("green_webhook_failed", error);

    return response.status(500).json({
      error: error instanceof Error ? error.message : "Erro interno ao processar o webhook.",
    });
  }
}
