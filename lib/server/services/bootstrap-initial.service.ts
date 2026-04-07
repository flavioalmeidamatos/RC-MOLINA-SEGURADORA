import {
  mapGreenContactToDirectoryEntry,
  normalizeJournalBatch,
} from "../../domain/whatsapp.js";
import { GreenApiClient } from "../integrations/green-api.client.js";
import { getSupabaseAdmin } from "../supabase-admin.js";
import { logger } from "../utils/logger.js";
import { MutationPersistenceService } from "./mutation-persistence.service.js";

export class BootstrapInitialService {
  private readonly greenApi = new GreenApiClient();
  private readonly db = getSupabaseAdmin();
  private readonly persistence = new MutationPersistenceService();

  async run(instanceId: string): Promise<void> {
    logger.info("bootstrap_initial_start", { instanceId });

    const [contacts, groups, incoming, outgoing] = await Promise.allSettled([
      this.greenApi.getContacts(),
      this.greenApi.getGroups(),
      this.greenApi.lastIncomingMessages(30),
      this.greenApi.lastOutgoingMessages(30),
    ]);

    const directory = [
      ...(contacts.status === "fulfilled" ? contacts.value : []),
      ...(groups.status === "fulfilled" ? groups.value : []),
    ]
      .map(mapGreenContactToDirectoryEntry)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const messagesMutation = normalizeJournalBatch([
      ...(incoming.status === "fulfilled" ? incoming.value : []),
      ...(outgoing.status === "fulfilled" ? outgoing.value : []),
    ]);

    await this.persistence.apply(instanceId, {
      directoryEntries: [...directory, ...messagesMutation.directoryEntries],
      chatShells: messagesMutation.chatShells,
      messages: messagesMutation.messages,
      statuses: messagesMutation.statuses,
    });

    await this.db.from("sync_state").upsert(
      [
        {
          instance_id: instanceId,
          scope: "directory",
          entity_key: "_",
          last_success_at: new Date().toISOString(),
          retry_count: 0,
        },
        {
          instance_id: instanceId,
          scope: "messages_recent",
          entity_key: "_",
          cursor_ts: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          retry_count: 0,
        },
      ],
      { onConflict: "instance_id,scope,entity_key" }
    );

    logger.info("bootstrap_initial_done", {
      instanceId,
      directoryCount: directory.length,
      messageCount: messagesMutation.messages.length,
    });
  }
}
