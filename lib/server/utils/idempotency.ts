import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function buildWebhookDedupeKey(instanceId: string, payload: unknown): string {
  return sha256(`${instanceId}:${JSON.stringify(payload)}`);
}

export async function registerWebhookInboxEvent(params: {
  db: SupabaseClient<any>;
  instanceId: string;
  dedupeKey: string;
  eventType: string;
  waChatId: string | null;
  waMessageId: string | null;
  payload: unknown;
}): Promise<{ isNew: boolean; eventId: string }> {
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await params.db
    .from("webhook_events")
    .upsert(
      {
        instance_id: params.instanceId,
        provider: "green_api",
        event_type: params.eventType,
        dedupe_key: params.dedupeKey,
        wa_chat_id: params.waChatId,
        wa_message_id: params.waMessageId,
        payload: params.payload,
        process_status: "pending",
        received_at: now,
      },
      {
        onConflict: "instance_id,dedupe_key",
        ignoreDuplicates: true,
      }
    )
    .select("id")
    .maybeSingle();

  if (insertError) {
    throw insertError;
  }

  if (inserted?.id) {
    return {
      isNew: true,
      eventId: inserted.id,
    };
  }

  const { data: existing, error } = await params.db
    .from("webhook_events")
    .select("id")
    .eq("instance_id", params.instanceId)
    .eq("dedupe_key", params.dedupeKey)
    .single();

  if (error) {
    throw error;
  }

  return {
    isNew: false,
    eventId: existing.id,
  };
}
