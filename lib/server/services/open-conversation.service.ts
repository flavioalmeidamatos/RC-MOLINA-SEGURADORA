import type { MessageCursor } from "../../domain/whatsapp";
import { normalizeJournalBatch } from "../../domain/whatsapp";
import { GreenApiClient } from "../integrations/green-api.client";
import { ChatRepository } from "../repositories/chat-repository";
import { MessageRepository } from "../repositories/message-repository";
import { logger } from "../utils/logger";
import { MutationPersistenceService } from "./mutation-persistence.service";

export class OpenConversationService {
  private readonly greenApi = new GreenApiClient();
  private readonly chats = new ChatRepository();
  private readonly messages = new MessageRepository();
  private readonly persistence = new MutationPersistenceService();

  async open(params: {
    instanceId: string;
    chatId: string;
    cursor: MessageCursor | null;
    limit: number;
  }) {
    const initialPage = await this.messages.listByChatPage({
      chatId: params.chatId,
      cursor: params.cursor,
      limit: params.limit,
    });

    if (initialPage.items.length >= params.limit || params.cursor) {
      return initialPage;
    }

    const chat = await this.chats.getById(params.chatId);

    if (!chat?.chat_wa_id) {
      throw new Error("Chat não encontrado.");
    }

    logger.info("open_conversation_history_fetch", {
      instanceId: params.instanceId,
      chatId: params.chatId,
      chatWaId: chat.chat_wa_id,
    });

    const history = await this.greenApi.getChatHistory(
      chat.chat_wa_id,
      Math.max(params.limit * 3, 100)
    );
    const mutation = normalizeJournalBatch(history);
    await this.persistence.apply(params.instanceId, mutation);

    return this.messages.listByChatPage({
      chatId: params.chatId,
      cursor: params.cursor,
      limit: params.limit,
    });
  }
}
