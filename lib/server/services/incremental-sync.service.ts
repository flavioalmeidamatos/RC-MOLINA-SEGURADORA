import { normalizeJournalBatch } from "../../domain/whatsapp";
import { GreenApiClient } from "../integrations/green-api.client";
import { getSupabaseAdmin } from "../supabase-admin";
import { logger } from "../utils/logger";
import { MutationPersistenceService } from "./mutation-persistence.service";

const OVERLAP_MINUTES = 10;
const MAX_LOOKBACK_MINUTES = 180;
const DEFAULT_LOOKBACK_MINUTES = 20;

export class IncrementalSyncService {
  private readonly db = getSupabaseAdmin();
  private readonly greenApi = new GreenApiClient();
  private readonly persistence = new MutationPersistenceService();

  async run(instanceId: string): Promise<void> {
    const { data: state, error: stateError } = await this.db
      .from("sync_state")
      .select("cursor_ts")
      .eq("instance_id", instanceId)
      .eq("scope", "messages_recent")
      .eq("entity_key", "_")
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    const now = new Date();
    const lastCursorIso = String(state?.cursor_ts || "").trim();
    const lastCursor = lastCursorIso ? new Date(lastCursorIso) : null;
    const minutesSinceLast = lastCursor
      ? Math.ceil((now.getTime() - lastCursor.getTime()) / 60000) + OVERLAP_MINUTES
      : DEFAULT_LOOKBACK_MINUTES;
    const lookbackMinutes = Math.min(
      Math.max(minutesSinceLast, OVERLAP_MINUTES),
      MAX_LOOKBACK_MINUTES
    );

    logger.info("incremental_sync_start", {
      instanceId,
      lookbackMinutes,
    });

    const [incoming, outgoing] = await Promise.all([
      this.greenApi.lastIncomingMessages(lookbackMinutes),
      this.greenApi.lastOutgoingMessages(lookbackMinutes),
    ]);

    const mutation = normalizeJournalBatch([...incoming, ...outgoing]);
    await this.persistence.apply(instanceId, mutation);

    await this.db.from("sync_state").upsert(
      {
        instance_id: instanceId,
        scope: "messages_recent",
        entity_key: "_",
        cursor_ts: now.toISOString(),
        last_success_at: now.toISOString(),
        retry_count: 0,
        last_error: null,
      },
      { onConflict: "instance_id,scope,entity_key" }
    );

    logger.info("incremental_sync_done", {
      instanceId,
      messageCount: mutation.messages.length,
      directoryCount: mutation.directoryEntries.length,
    });
  }
}
