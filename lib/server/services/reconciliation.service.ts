import { normalizeWebhookPayload } from "../../domain/whatsapp";
import { getSupabaseAdmin } from "../supabase-admin";
import { logger } from "../utils/logger";
import { BootstrapInitialService } from "./bootstrap-initial.service";
import { IncrementalSyncService } from "./incremental-sync.service";
import { InstanceRegistryService } from "./instance-registry.service";
import { MutationPersistenceService } from "./mutation-persistence.service";

export class ReconciliationService {
  private readonly db = getSupabaseAdmin();
  private readonly instances = new InstanceRegistryService();
  private readonly bootstrap = new BootstrapInitialService();
  private readonly incremental = new IncrementalSyncService();
  private readonly persistence = new MutationPersistenceService();

  async runDefault(): Promise<{ instanceId: string }> {
    const instanceId = await this.instances.ensureDefaultInstance();
    await this.runForInstance(instanceId);
    return { instanceId };
  }

  async runForInstance(instanceId: string): Promise<void> {
    logger.info("reconcile_start", { instanceId });

    const { data: recentState } = await this.db
      .from("sync_state")
      .select("last_success_at")
      .eq("instance_id", instanceId)
      .eq("scope", "messages_recent")
      .eq("entity_key", "_")
      .maybeSingle();

    if (!recentState?.last_success_at) {
      await this.bootstrap.run(instanceId);
    } else {
      await this.incremental.run(instanceId);
    }

    const { data: directoryState } = await this.db
      .from("sync_state")
      .select("last_success_at")
      .eq("instance_id", instanceId)
      .eq("scope", "directory")
      .eq("entity_key", "_")
      .maybeSingle();

    const directoryStale =
      !directoryState?.last_success_at ||
      Date.now() - new Date(directoryState.last_success_at).getTime() > 60 * 60 * 1000;

    if (directoryStale) {
      await this.bootstrap.run(instanceId);
    }

    await this.replayWebhookInbox(instanceId);

    logger.info("reconcile_done", { instanceId });
  }

  private async replayWebhookInbox(instanceId: string): Promise<void> {
    const { data: events, error } = await this.db
      .from("webhook_events")
      .select("id, payload, attempt_count")
      .eq("instance_id", instanceId)
      .in("process_status", ["pending", "failed"])
      .order("received_at", { ascending: true })
      .limit(50);

    if (error) {
      throw error;
    }

    for (const event of events || []) {
      try {
        const mutation = normalizeWebhookPayload(event.payload as any);
        await this.persistence.apply(instanceId, mutation);

        await this.db
          .from("webhook_events")
          .update({
            process_status: "processed",
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", event.id);
      } catch (error) {
        const attemptCount = Number(event.attempt_count || 0) + 1;
        const backoffMs = Math.min(300000, 15000 * attemptCount);
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

        await this.db
          .from("webhook_events")
          .update({
            process_status: "failed",
            processed_at: new Date().toISOString(),
            attempt_count: attemptCount,
            next_retry_at: nextRetryAt,
            error_message: error instanceof Error ? error.message : "erro desconhecido",
          })
          .eq("id", event.id);

        logger.error("replay_webhook_failed", error, {
          instanceId,
          eventId: event.id,
        });
      }
    }
  }
}
