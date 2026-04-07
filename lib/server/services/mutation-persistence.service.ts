import type { NormalizedMutation } from "../../domain/whatsapp";
import { ChatRepository } from "../repositories/chat-repository";
import { MessageRepository } from "../repositories/message-repository";

export class MutationPersistenceService {
  private readonly chats = new ChatRepository();
  private readonly messages = new MessageRepository();

  async apply(instanceId: string, mutation: NormalizedMutation): Promise<void> {
    if (
      mutation.directoryEntries.length === 0 &&
      mutation.chatShells.length === 0 &&
      mutation.messages.length === 0 &&
      mutation.statuses.length === 0
    ) {
      return;
    }

    await this.chats.upsertDirectoryEntries(instanceId, mutation.directoryEntries);
    const chatIdMap = await this.chats.ensureChatShells(instanceId, mutation.chatShells);
    await this.messages.upsertBatch(instanceId, chatIdMap, mutation.messages);
    await this.messages.upsertStatuses(instanceId, mutation.statuses);
  }
}
