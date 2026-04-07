import type { GreenApiWebhookPayload } from "../../domain/whatsapp.js";
import { normalizeWebhookPayload } from "../../domain/whatsapp.js";
import { ChatRepository } from "../repositories/chat-repository.js";
import { MessageRepository } from "../repositories/message-repository.js";
import { getSupabaseAdmin } from "../supabase-admin.js";
import { logger } from "../utils/logger.js";
import { InstanceRegistryService } from "./instance-registry.service.js";
import { MutationPersistenceService } from "./mutation-persistence.service.js";
import { OpenConversationService } from "./open-conversation.service.js";

type LegacyChatItem = {
  chatId: string;
  title: string;
  subtitle: string;
  preview: string;
  timestamp: number;
  direction: string;
  typeMessage: string;
  statusMessage: string;
  isGroup: boolean;
  unreadCount: number;
  latestIncomingTimestamp: number;
};

type LegacyMessageItem = {
  idMessage: string;
  chatId: string;
  timestamp: number;
  direction: string;
  typeMessage: string;
  text: string;
  statusMessage: string;
  senderName: string;
  sendByApi: boolean;
  fileName?: string;
  mediaUrl?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  isAnimated?: boolean;
};

const toUnixSeconds = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
};

const fallbackSubtitle = (chatType: string, hasTitle: boolean) => {
  if (chatType === "group") {
    return "Grupo";
  }

  if (hasTitle) {
    return "Contato";
  }

  return "";
};

export class WhatsAppLegacyBridgeService {
  private readonly db = getSupabaseAdmin();
  private readonly instances = new InstanceRegistryService();
  private readonly chats = new ChatRepository(this.db);
  private readonly messages = new MessageRepository(this.db);
  private readonly persistence = new MutationPersistenceService();
  private readonly openConversation = new OpenConversationService();

  isAvailable(): boolean {
    return Boolean(
      String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() &&
        (String(process.env.SUPABASE_URL || "").trim() ||
          String(process.env.VITE_SUPABASE_URL || "").trim())
    );
  }

  async ensureInstanceId(): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.instances.ensureDefaultInstance();
    } catch (error) {
      logger.warn("legacy_bridge_instance_unavailable", {
        error: error instanceof Error ? error.message : "erro desconhecido",
      });
      return null;
    }
  }

  private async tablesReady(): Promise<boolean> {
    try {
      const { error } = await this.db.from("instances").select("id").limit(1);
      return !error;
    } catch (_error) {
      return false;
    }
  }

  async canUseStore(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    return this.tablesReady();
  }

  private mapChatRowToLegacy(row: any): LegacyChatItem {
    const timestamp = toUnixSeconds(row.last_message_at || row.sort_ts);
    const latestIncomingTimestamp = toUnixSeconds(row.last_incoming_message_ts || row.last_message_at);
    const title = String(row.resolved_title || row.subject || row.chat_wa_id || "").trim();
    const isGroup = String(row.chat_type || "") === "group" || String(row.chat_wa_id || "").endsWith("@g.us");

    return {
      chatId: String(row.chat_wa_id || "").trim(),
      title,
      subtitle: fallbackSubtitle(String(row.chat_type || ""), Boolean(title)),
      preview: String(row.last_message_preview || "").trim() || (isGroup ? "Grupo disponível" : "Contato disponível"),
      timestamp,
      direction: "incoming",
      typeMessage: String(row.last_message_kind || "textMessage"),
      statusMessage: "",
      isGroup,
      unreadCount: Number(row.unread_count || 0),
      latestIncomingTimestamp,
    };
  }

  private mapMessageRowToLegacy(row: any, waChatId: string): LegacyMessageItem {
    const kind = String(row.kind || row.typeMessage || "text");
    const typeMessageMap: Record<string, string> = {
      text: "textMessage",
      extended_text: "extendedTextMessage",
      image: "imageMessage",
      video: "videoMessage",
      audio: "audioMessage",
      document: "documentMessage",
      sticker: "stickerMessage",
      contact: "contactMessage",
      location: "locationMessage",
      poll: "pollMessage",
      reaction: "reactionMessage",
      system: "systemMessage",
      unknown: "textMessage",
    };

    return {
      idMessage: String(row.external_message_id || row.id),
      chatId: waChatId,
      timestamp: toUnixSeconds(row.sentAt || row.sent_at),
      direction: String(row.direction || "incoming"),
      typeMessage: typeMessageMap[kind] || "textMessage",
      text: String(row.bodyText || row.body_text || row.previewText || row.preview_text || "").trim(),
      statusMessage: String(row.status || "").trim(),
      senderName: String(row.senderWaId || row.sender_wa_id || "").replace(/@.+$/, ""),
      sendByApi: Boolean(row.isFromMe ?? row.is_from_me),
      fileName: String(row.fileName || row.file_name || "").trim(),
      mediaUrl: String(row.mediaUrl || row.media_url || "").trim(),
      mimeType: String(row.mimeType || row.mime_type || "").trim(),
      thumbnailUrl: String(row.thumbnailUrl || row.thumbnail_url || "").trim(),
      isAnimated: false,
    };
  }

  async getLegacyOverview() {
    if (!(await this.canUseStore())) {
      return null;
    }

    const instanceId = await this.ensureInstanceId();

    if (!instanceId) {
      return null;
    }

    const [chatPage, directoryRows] = await Promise.all([
      this.chats.listPage({ instanceId, limit: 120, cursor: null, archived: false }),
      this.db
        .from("chats")
        .select("chat_wa_id, chat_type, resolved_title, subject, last_message_preview, sort_ts, unread_count, last_incoming_message_ts")
        .eq("instance_id", instanceId)
        .order("resolved_title", { ascending: true })
        .limit(500),
    ]);

    const chats = chatPage.items.map((item) =>
      this.mapChatRowToLegacy({
        chat_wa_id: item.chatWaId,
        chat_type: item.chatType,
        resolved_title: item.resolvedTitle,
        last_message_preview: item.lastMessagePreview,
        sort_ts: item.sortTs,
        last_message_at: item.lastMessageAt,
        unread_count: item.unreadCount,
      })
    );

    const contacts = ((directoryRows.data || []) as any[]).map((row) =>
      this.mapChatRowToLegacy(row)
    );

    return {
      instanceId,
      chats,
      contacts,
      hasData: chats.length > 0 || contacts.length > 0,
    };
  }

  async getLegacyDirectory() {
    const overview = await this.getLegacyOverview();
    if (!overview) {
      return null;
    }

    return {
      instanceId: overview.instanceId,
      contacts: overview.contacts,
      hasData: overview.contacts.length > 0,
    };
  }

  async getLegacyChatHistory(params: {
    chatWaId: string;
    count: number;
  }) {
    if (!(await this.canUseStore())) {
      return null;
    }

    const instanceId = await this.ensureInstanceId();

    if (!instanceId) {
      return null;
    }

    const chat = await this.chats.getByWaChatId(instanceId, params.chatWaId);

    if (!chat?.id) {
      return null;
    }

    const page = await this.openConversation.open({
      instanceId,
      chatId: String(chat.id),
      cursor: null,
      limit: params.count,
    });

    return {
      instanceId,
      chatId: params.chatWaId,
      messages: [...page.items]
        .reverse()
        .map((row) => this.mapMessageRowToLegacy(row, params.chatWaId)),
    };
  }

  async ingestNotification(payload: GreenApiWebhookPayload): Promise<void> {
    if (!(await this.canUseStore())) {
      return;
    }

    const instanceId = await this.ensureInstanceId();

    if (!instanceId) {
      return;
    }

    const mutation = normalizeWebhookPayload(payload);
    await this.persistence.apply(instanceId, mutation);
  }

  async updateInstanceSnapshot(snapshot: {
    connected: boolean;
    validated: boolean;
    stateInstance: string;
    statusInstance: string;
    qrCode?: string;
  }): Promise<void> {
    if (!(await this.canUseStore())) {
      return;
    }

    const instanceId = await this.ensureInstanceId();

    if (!instanceId) {
      return;
    }

    const qrHash = snapshot.qrCode
      ? Buffer.from(snapshot.qrCode).toString("base64url").slice(0, 120)
      : null;

    await this.db
      .from("instances")
      .update({
        is_connected: snapshot.connected,
        state: snapshot.stateInstance || "unknown",
        status: snapshot.statusInstance || "unknown",
        last_qr_hash: qrHash,
        last_qr_at: snapshot.qrCode ? new Date().toISOString() : null,
        connected_at: snapshot.connected ? new Date().toISOString() : null,
        disconnected_at: snapshot.connected ? null : new Date().toISOString(),
      })
      .eq("id", instanceId);
  }
}
