import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MessageCursor,
  MessageListItem,
  MessageStatusInput,
  MessageUpsertInput,
  PaginatedResult,
} from "../../domain/whatsapp";
import { getSupabaseAdmin } from "../supabase-admin";

export class MessageRepository {
  constructor(private readonly db: SupabaseClient<any> = getSupabaseAdmin()) {}

  async upsertBatch(
    instanceId: string,
    chatIdByWaChatId: Map<string, string>,
    messages: MessageUpsertInput[]
  ): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    const rows = messages
      .map((message) => {
        const chatId = chatIdByWaChatId.get(message.waChatId);

        if (!chatId) {
          return null;
        }

        return {
          instance_id: instanceId,
          chat_id: chatId,
          external_message_id: message.externalMessageId,
          wa_chat_id: message.waChatId,
          sender_wa_id: message.senderWaId,
          direction: message.direction,
          kind: message.kind,
          body_text: message.bodyText,
          preview_text: message.previewText,
          caption_text: message.captionText,
          media_url: message.mediaUrl ?? null,
          thumbnail_url: message.thumbnailUrl ?? null,
          mime_type: message.mimeType ?? null,
          file_name: message.fileName ?? null,
          status: message.status ?? null,
          is_from_me: message.isFromMe,
          sent_at: message.sentAt,
          raw_payload: message.rawPayload,
        };
      })
      .filter((row): row is Exclude<typeof row, null> => Boolean(row));

    if (rows.length === 0) {
      return;
    }

    const { error } = await this.db
      .from("messages")
      .upsert(rows, { onConflict: "instance_id,external_message_id" });

    if (error) {
      throw error;
    }
  }

  async upsertStatuses(instanceId: string, statuses: MessageStatusInput[]): Promise<void> {
    if (statuses.length === 0) {
      return;
    }

    const externalIds = [...new Set(statuses.map((item) => item.externalMessageId))];

    const { data: messages, error: selectError } = await this.db
      .from("messages")
      .select("id, external_message_id")
      .eq("instance_id", instanceId)
      .in("external_message_id", externalIds);

    if (selectError) {
      throw selectError;
    }

    const messageIdByExternalId = new Map(
      (messages || []).map((row: any) => [row.external_message_id as string, row.id as string])
    );

    const rows = statuses
      .map((status) => {
        const messageId = messageIdByExternalId.get(status.externalMessageId);

        if (!messageId) {
          return null;
        }

        return {
          instance_id: instanceId,
          message_id: messageId,
          status: status.status,
          occurred_at: status.occurredAt,
          raw_payload: status.rawPayload,
        };
      })
      .filter((row): row is Exclude<typeof row, null> => Boolean(row));

    if (rows.length === 0) {
      return;
    }

    const { error } = await this.db
      .from("message_status")
      .upsert(rows, { onConflict: "message_id,status" });

    if (error) {
      throw error;
    }
  }

  async listByChatPage(params: {
    chatId: string;
    limit: number;
    cursor: MessageCursor | null;
  }): Promise<PaginatedResult<MessageListItem, MessageCursor>> {
    const limit = Math.min(Math.max(params.limit, 1), 200);

    let query = this.db
      .from("messages")
      .select(`
        id,
        external_message_id,
        direction,
        kind,
        body_text,
        preview_text,
        media_url,
        thumbnail_url,
        mime_type,
        file_name,
        status,
        is_from_me,
        sender_wa_id,
        sent_at
      `)
      .eq("chat_id", params.chatId)
      .order("sent_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (params.cursor) {
      query = query.or(
        `sent_at.lt.${params.cursor.sentAt},and(sent_at.eq.${params.cursor.sentAt},id.lt.${params.cursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      externalMessageId: row.external_message_id,
      direction: row.direction,
      kind: row.kind,
      bodyText: row.body_text,
      previewText: row.preview_text,
      mediaUrl: row.media_url,
      thumbnailUrl: row.thumbnail_url,
      mimeType: row.mime_type,
      fileName: row.file_name,
      status: row.status,
      isFromMe: Boolean(row.is_from_me),
      senderWaId: row.sender_wa_id,
      sentAt: row.sent_at,
    })) satisfies MessageListItem[];

    const pageItems = items.slice(0, limit);
    const lastItem = pageItems.at(-1) || null;

    return {
      items: pageItems,
      nextCursor:
        items.length > limit && lastItem
          ? { sentAt: lastItem.sentAt, id: lastItem.id }
          : null,
    };
  }
}
