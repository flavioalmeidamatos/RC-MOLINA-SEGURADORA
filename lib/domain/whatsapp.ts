export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type ChatType = "user" | "group" | "broadcast" | "unknown";
export type MessageDirection = "incoming" | "outgoing" | "system";
export type MessageKind =
  | "text"
  | "extended_text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "contact"
  | "location"
  | "poll"
  | "reaction"
  | "system"
  | "unknown";

export interface ChatCursor {
  sortTs: string;
  id: string;
}

export interface MessageCursor {
  sentAt: string;
  id: string;
}

export interface PaginatedResult<T, C> {
  items: T[];
  nextCursor: C | null;
}

export interface DirectoryEntryInput {
  waId: string;
  phoneE164: string | null;
  type: ChatType;
  profileName: string | null;
  contactName: string | null;
  resolvedName: string;
  avatarUrl?: string | null;
  rawPayload?: Json;
}

export interface ChatShellInput {
  waChatId: string;
  chatType: ChatType;
  resolvedTitle: string;
  subject?: string | null;
  avatarUrl?: string | null;
  sortTs?: string | null;
  isDirectoryOnly?: boolean;
}

export interface MessageUpsertInput {
  externalMessageId: string;
  waChatId: string;
  senderWaId: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  bodyText: string | null;
  previewText: string;
  captionText: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  status?: string | null;
  isFromMe: boolean;
  sentAt: string;
  rawPayload: Json;
}

export interface MessageStatusInput {
  externalMessageId: string;
  status: string;
  occurredAt: string;
  rawPayload: Json;
}

export interface NormalizedMutation {
  directoryEntries: DirectoryEntryInput[];
  chatShells: ChatShellInput[];
  messages: MessageUpsertInput[];
  statuses: MessageStatusInput[];
}

export interface GreenApiContact {
  id?: string;
  name?: string;
  contactName?: string;
  type?: "user" | "group";
}

export interface GreenApiJournalMessage {
  type?: "incoming" | "outgoing";
  idMessage?: string;
  timestamp?: number;
  typeMessage?: string;
  chatId?: string;
  senderId?: string;
  senderName?: string;
  senderContactName?: string;
  textMessage?: string;
  caption?: string;
  fileName?: string;
  downloadUrl?: string;
  jpegThumbnail?: string;
  mimeType?: string;
  statusMessage?: string;
}

export interface GreenApiWebhookPayload {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  status?: string;
  senderData?: {
    chatId?: string;
    sender?: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: {
      text?: string;
      textMessage?: string;
      description?: string;
      title?: string;
    };
    fileMessageData?: {
      caption?: string;
      fileName?: string;
      downloadUrl?: string;
      jpegThumbnail?: string;
      mimeType?: string;
    };
  };
}

export interface ChatListItem {
  id: string;
  chatWaId: string;
  resolvedTitle: string;
  avatarUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageKind: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isArchived: boolean;
  chatType: ChatType;
  sortTs: string;
}

export interface MessageListItem {
  id: string;
  externalMessageId: string;
  direction: MessageDirection;
  kind: MessageKind;
  bodyText: string | null;
  previewText: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  status: string | null;
  isFromMe: boolean;
  senderWaId: string | null;
  sentAt: string;
}

export function encodeCursor<T>(value: T | null): string | null {
  if (!value) return null;
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor<T>(value?: string | null): T | null {
  if (!value) return null;
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

export function guessChatType(waId: string): ChatType {
  if (waId.endsWith("@g.us")) return "group";
  if (waId.includes("broadcast")) return "broadcast";
  if (waId.endsWith("@c.us")) return "user";
  return "unknown";
}

export function toIsoFromUnix(timestamp?: number): string {
  const safe = Number(timestamp || 0);
  return new Date((safe > 0 ? safe : Math.floor(Date.now() / 1000)) * 1000).toISOString();
}

export function normalizePhoneE164(waId: string): string | null {
  const digits = waId.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

export function resolveDisplayName(input: {
  contactName?: string | null;
  profileName?: string | null;
  chatName?: string | null;
  waId: string;
}): string {
  const name =
    input.contactName?.trim() ||
    input.profileName?.trim() ||
    input.chatName?.trim();

  if (name) return name;

  const digits = input.waId.replace(/\D/g, "");
  return digits ? `+${digits}` : input.waId;
}

export function mapMessageKind(raw?: string | null): MessageKind {
  const value = String(raw || "").trim();

  switch (value) {
    case "textMessage":
      return "text";
    case "extendedTextMessage":
      return "extended_text";
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "audioMessage":
      return "audio";
    case "documentMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    case "contactMessage":
      return "contact";
    case "locationMessage":
      return "location";
    case "pollMessage":
      return "poll";
    case "reactionMessage":
      return "reaction";
    default:
      return "unknown";
  }
}

export function buildPreviewText(input: {
  text?: string | null;
  caption?: string | null;
  fileName?: string | null;
  kind?: MessageKind;
}): string {
  const text = input.text?.trim();
  const caption = input.caption?.trim();
  const fileName = input.fileName?.trim();

  if (text) return text;
  if (caption) return caption;
  if (fileName) return fileName;

  switch (input.kind) {
    case "image":
      return "Imagem";
    case "video":
      return "Vídeo";
    case "audio":
      return "Áudio";
    case "document":
      return "Documento";
    case "sticker":
      return "Figurinha";
    case "contact":
      return "Contato";
    case "location":
      return "Localização";
    case "poll":
      return "Enquete";
    default:
      return "Mensagem";
  }
}

export function mapGreenContactToDirectoryEntry(contact: GreenApiContact): DirectoryEntryInput | null {
  const waId = String(contact.id || "").trim();

  if (!waId || waId === "status@broadcast") {
    return null;
  }

  return {
    waId,
    phoneE164: normalizePhoneE164(waId),
    type: guessChatType(waId),
    profileName: contact.name?.trim() || null,
    contactName: contact.contactName?.trim() || null,
    resolvedName: resolveDisplayName({
      contactName: contact.contactName,
      profileName: contact.name,
      waId,
    }),
    rawPayload: contact as unknown as Json,
  };
}

export function normalizeJournalBatch(messages: GreenApiJournalMessage[]): NormalizedMutation {
  const directoryMap = new Map<string, DirectoryEntryInput>();
  const chatMap = new Map<string, ChatShellInput>();
  const normalizedMessages: MessageUpsertInput[] = [];

  for (const item of messages) {
    const waChatId = String(item.chatId || "").trim();
    const externalMessageId = String(item.idMessage || "").trim();

    if (!waChatId || !externalMessageId) {
      continue;
    }

    const senderWaId = String(item.senderId || "").trim() || null;
    const chatType = guessChatType(waChatId);
    const kind = mapMessageKind(item.typeMessage);
    const bodyText = item.textMessage?.trim() || null;
    const captionText = item.caption?.trim() || null;
    const previewText = buildPreviewText({
      text: bodyText,
      caption: captionText,
      fileName: item.fileName,
      kind,
    });

    if (!directoryMap.has(waChatId)) {
      directoryMap.set(waChatId, {
        waId: waChatId,
        phoneE164: normalizePhoneE164(waChatId),
        type: chatType,
        profileName: item.senderName?.trim() || null,
        contactName: item.senderContactName?.trim() || null,
        resolvedName: resolveDisplayName({
          contactName: item.senderContactName,
          profileName: item.senderName,
          waId: waChatId,
        }),
        rawPayload: item as unknown as Json,
      });
    }

    if (!chatMap.has(waChatId)) {
      chatMap.set(waChatId, {
        waChatId,
        chatType,
        resolvedTitle: resolveDisplayName({
          contactName: item.senderContactName,
          profileName: item.senderName,
          waId: waChatId,
        }),
        sortTs: toIsoFromUnix(item.timestamp),
        isDirectoryOnly: false,
      });
    }

    normalizedMessages.push({
      externalMessageId,
      waChatId,
      senderWaId,
      direction: item.type === "outgoing" ? "outgoing" : "incoming",
      kind,
      bodyText,
      previewText,
      captionText,
      mediaUrl: item.downloadUrl?.trim() || null,
      thumbnailUrl: item.jpegThumbnail?.trim()
        ? `data:image/jpeg;base64,${item.jpegThumbnail}`
        : null,
      mimeType: item.mimeType?.trim() || null,
      fileName: item.fileName?.trim() || null,
      status: item.statusMessage?.trim() || null,
      isFromMe: item.type === "outgoing",
      sentAt: toIsoFromUnix(item.timestamp),
      rawPayload: item as unknown as Json,
    });
  }

  return {
    directoryEntries: [...directoryMap.values()],
    chatShells: [...chatMap.values()],
    messages: normalizedMessages,
    statuses: [],
  };
}

export function normalizeWebhookPayload(payload: GreenApiWebhookPayload): NormalizedMutation {
  const typeWebhook = String(payload.typeWebhook || "").trim();
  const waChatId = String(payload.senderData?.chatId || "").trim();
  const externalMessageId = String(payload.idMessage || "").trim();

  const result: NormalizedMutation = {
    directoryEntries: [],
    chatShells: [],
    messages: [],
    statuses: [],
  };

  if (waChatId) {
    const chatType = guessChatType(waChatId);
    const resolvedTitle = resolveDisplayName({
      contactName: payload.senderData?.senderContactName || null,
      profileName: payload.senderData?.senderName || null,
      chatName: payload.senderData?.chatName || null,
      waId: waChatId,
    });

    result.directoryEntries.push({
      waId: waChatId,
      phoneE164: normalizePhoneE164(waChatId),
      type: chatType,
      profileName: payload.senderData?.senderName?.trim() || null,
      contactName: payload.senderData?.senderContactName?.trim() || null,
      resolvedName: resolvedTitle,
      rawPayload: payload as unknown as Json,
    });

    result.chatShells.push({
      waChatId,
      chatType,
      resolvedTitle,
      sortTs: toIsoFromUnix(payload.timestamp),
      isDirectoryOnly: false,
    });
  }

  const kind = mapMessageKind(payload.messageData?.typeMessage);
  const bodyText =
    payload.messageData?.textMessageData?.textMessage?.trim() ||
    payload.messageData?.extendedTextMessageData?.text?.trim() ||
    payload.messageData?.extendedTextMessageData?.textMessage?.trim() ||
    payload.messageData?.extendedTextMessageData?.description?.trim() ||
    payload.messageData?.extendedTextMessageData?.title?.trim() ||
    null;

  const caption = payload.messageData?.fileMessageData?.caption?.trim() || null;
  const fileName = payload.messageData?.fileMessageData?.fileName?.trim() || null;

  if (
    externalMessageId &&
    waChatId &&
    (typeWebhook === "incomingMessageReceived" ||
      typeWebhook === "outgoingMessageReceived" ||
      typeWebhook === "outgoingAPIMessageReceived")
  ) {
    result.messages.push({
      externalMessageId,
      waChatId,
      senderWaId: String(payload.senderData?.sender || "").trim() || null,
      direction: typeWebhook === "incomingMessageReceived" ? "incoming" : "outgoing",
      kind,
      bodyText,
      previewText: buildPreviewText({ text: bodyText, caption, fileName, kind }),
      captionText: caption,
      mediaUrl: payload.messageData?.fileMessageData?.downloadUrl?.trim() || null,
      thumbnailUrl: payload.messageData?.fileMessageData?.jpegThumbnail?.trim()
        ? `data:image/jpeg;base64,${payload.messageData.fileMessageData.jpegThumbnail}`
        : null,
      mimeType: payload.messageData?.fileMessageData?.mimeType?.trim() || null,
      fileName,
      status: null,
      isFromMe: typeWebhook !== "incomingMessageReceived",
      sentAt: toIsoFromUnix(payload.timestamp),
      rawPayload: payload as unknown as Json,
    });
  }

  if (externalMessageId && typeWebhook === "outgoingMessageStatus") {
    result.statuses.push({
      externalMessageId,
      status: String(payload.status || "unknown"),
      occurredAt: toIsoFromUnix(payload.timestamp),
      rawPayload: payload as unknown as Json,
    });
  }

  return result;
}
