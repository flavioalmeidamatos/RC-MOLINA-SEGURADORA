import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatCursor,
  ChatListItem,
  ChatShellInput,
  DirectoryEntryInput,
  PaginatedResult,
} from "../../domain/whatsapp";
import { getSupabaseAdmin } from "../supabase-admin";

export class ChatRepository {
  constructor(private readonly db: SupabaseClient<any> = getSupabaseAdmin()) {}

  private chunkValues<T>(values: T[], size = 150): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }

    return chunks;
  }

  private async fetchContactsByWaIds(instanceId: string, waIds: string[]) {
    const rows: any[] = [];

    for (const chunk of this.chunkValues([...new Set(waIds)])) {
      const { data, error } = await this.db
        .from("contacts")
        .select("id, wa_id, type, resolved_name, avatar_url")
        .eq("instance_id", instanceId)
        .in("wa_id", chunk);

      if (error) {
        throw error;
      }

      rows.push(...(data || []));
    }

    return rows;
  }

  private async fetchChatsByWaIds(instanceId: string, waIds: string[]) {
    const rows: any[] = [];

    for (const chunk of this.chunkValues([...new Set(waIds)])) {
      const { data, error } = await this.db
        .from("chats")
        .select("id, chat_wa_id")
        .eq("instance_id", instanceId)
        .in("chat_wa_id", chunk);

      if (error) {
        throw error;
      }

      rows.push(...(data || []));
    }

    return rows;
  }

  async upsertDirectoryEntries(
    instanceId: string,
    entries: DirectoryEntryInput[]
  ): Promise<Map<string, string>> {
    if (entries.length === 0) {
      return new Map();
    }

    const normalizedEntries = [...new Map(entries.map((entry) => [entry.waId, entry])).values()];

    const contactRows = normalizedEntries.map((entry) => ({
      instance_id: instanceId,
      wa_id: entry.waId,
      phone_e164: entry.phoneE164,
      type: entry.type,
      profile_name: entry.profileName,
      contact_name: entry.contactName,
      resolved_name: entry.resolvedName,
      avatar_url: entry.avatarUrl ?? null,
      raw_payload: entry.rawPayload ?? {},
      last_synced_at: new Date().toISOString(),
    }));

    const { error: contactError } = await this.db
      .from("contacts")
      .upsert(contactRows, { onConflict: "instance_id,wa_id" });

    if (contactError) {
      throw contactError;
    }

    const waIds = normalizedEntries.map((entry) => entry.waId);

    const contacts = await this.fetchContactsByWaIds(instanceId, waIds);

    const contactByWaId = new Map(
      (contacts || []).map((row: any) => [row.wa_id as string, row] as const)
    );

    const chatRows = normalizedEntries.map((entry) => ({
      instance_id: instanceId,
      contact_id: contactByWaId.get(entry.waId)?.id ?? null,
      chat_wa_id: entry.waId,
      chat_type: entry.type,
      resolved_title: entry.resolvedName,
      avatar_url: entry.avatarUrl ?? contactByWaId.get(entry.waId)?.avatar_url ?? null,
      sort_ts: new Date(0).toISOString(),
      is_directory_only: true,
    }));

    const { error: chatError } = await this.db
      .from("chats")
      .upsert(chatRows, { onConflict: "instance_id,chat_wa_id" });

    if (chatError) {
      throw chatError;
    }

    const chats = await this.fetchChatsByWaIds(instanceId, waIds);

    return new Map((chats || []).map((row: any) => [row.chat_wa_id as string, row.id as string]));
  }

  async ensureChatShells(
    instanceId: string,
    chatShells: ChatShellInput[]
  ): Promise<Map<string, string>> {
    if (chatShells.length === 0) {
      return new Map();
    }

    const normalizedShells = [...new Map(chatShells.map((chat) => [chat.waChatId, chat])).values()];
    const waIds = normalizedShells.map((item) => item.waChatId);

    const contacts = await this.fetchContactsByWaIds(instanceId, waIds);

    const contactByWaId = new Map((contacts || []).map((row: any) => [row.wa_id as string, row.id as string]));

    const rows = normalizedShells.map((chat) => ({
      instance_id: instanceId,
      contact_id: contactByWaId.get(chat.waChatId) ?? null,
      chat_wa_id: chat.waChatId,
      chat_type: chat.chatType,
      subject: chat.subject ?? null,
      resolved_title: chat.resolvedTitle,
      avatar_url: chat.avatarUrl ?? null,
      sort_ts: chat.sortTs ?? new Date().toISOString(),
      is_directory_only: chat.isDirectoryOnly ?? false,
    }));

    const { error } = await this.db
      .from("chats")
      .upsert(rows, { onConflict: "instance_id,chat_wa_id" });

    if (error) {
      throw error;
    }

    const data = await this.fetchChatsByWaIds(instanceId, waIds);

    return new Map((data || []).map((row: any) => [row.chat_wa_id as string, row.id as string]));
  }

  async getById(chatId: string) {
    const { data, error } = await this.db
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async getByWaChatId(instanceId: string, waChatId: string) {
    const { data, error } = await this.db
      .from("chats")
      .select("*")
      .eq("instance_id", instanceId)
      .eq("chat_wa_id", waChatId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async listPage(params: {
    instanceId: string;
    limit: number;
    cursor: ChatCursor | null;
    archived?: boolean;
  }): Promise<PaginatedResult<ChatListItem, ChatCursor>> {
    const limit = Math.min(Math.max(params.limit, 1), 100);

    let query = this.db
      .from("chats")
      .select(`
        id,
        chat_wa_id,
        resolved_title,
        avatar_url,
        last_message_preview,
        last_message_kind,
        last_message_at,
        unread_count,
        is_archived,
        chat_type,
        sort_ts
      `)
      .eq("instance_id", params.instanceId)
      .eq("is_archived", Boolean(params.archived))
      .order("sort_ts", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (params.cursor) {
      query = query.or(
        `sort_ts.lt.${params.cursor.sortTs},and(sort_ts.eq.${params.cursor.sortTs},id.lt.${params.cursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      chatWaId: row.chat_wa_id,
      resolvedTitle: row.resolved_title,
      avatarUrl: row.avatar_url,
      lastMessagePreview: row.last_message_preview,
      lastMessageKind: row.last_message_kind,
      lastMessageAt: row.last_message_at,
      unreadCount: Number(row.unread_count || 0),
      isArchived: Boolean(row.is_archived),
      chatType: row.chat_type,
      sortTs: row.sort_ts,
    })) satisfies ChatListItem[];

    const pageItems = items.slice(0, limit);
    const lastItem = pageItems.at(-1) || null;

    return {
      items: pageItems,
      nextCursor:
        items.length > limit && lastItem
          ? { sortTs: lastItem.sortTs, id: lastItem.id }
          : null,
    };
  }

  async markRead(chatId: string, atIso = new Date().toISOString()): Promise<void> {
    const { error } = await this.db.rpc("mark_chat_read", {
      p_chat_id: chatId,
      p_last_read_ts: atIso,
    });

    if (error) {
      throw error;
    }
  }
}
