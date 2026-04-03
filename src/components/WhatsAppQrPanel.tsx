import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Check,
  CheckCircle2,
  CheckCheck,
  FileText,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  Smile,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { EMOJI_CATEGORIES, GIF_PRESETS } from "./whatsappComposerData";

const CONNECTED_OVERVIEW_REFRESH_MS = 3000;
const DISCONNECTED_OVERVIEW_REFRESH_MS = 5000;
const SELECTED_CHAT_REFRESH_MS = 2500;
const QUEUE_RECEIVE_TIMEOUT_SECONDS = 20;

type WhatsAppChatItem = {
  chatId: string;
  title: string;
  subtitle: string;
  preview: string;
  timestamp: number;
  direction: string;
  typeMessage: string;
  statusMessage: string;
  isGroup: boolean;
  unreadCount?: number;
  latestIncomingTimestamp?: number;
};

type WhatsAppOverviewApiResponse = {
  success?: boolean;
  connected?: boolean;
  stateInstance?: string;
  statusInstance?: string;
  qrCode?: string;
  chats?: WhatsAppChatItem[];
  contacts?: WhatsAppChatItem[];
  fetchedAt?: string;
  error?: string;
};

type WhatsAppAvatarApiResponse = {
  success?: boolean;
  chatId?: string;
  avatarUrl?: string;
  available?: boolean;
  error?: string;
};

type WhatsAppConversationMessage = {
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

type WhatsAppChatApiResponse = {
  success?: boolean;
  chatId?: string;
  messages?: WhatsAppConversationMessage[];
  idMessage?: string;
  urlFile?: string;
  error?: string;
};

type ComposerOverlayType = "contact" | "poll" | "event" | "sticker" | null;

type MediaIntent = "document" | "media" | "camera" | "audio" | "sticker";

type WhatsAppNotificationMessageData = {
  typeMessage?: string;
  textMessageData?: {
    textMessage?: string;
  };
  extendedTextMessageData?: {
    text?: string;
    textMessage?: string;
    description?: string;
    title?: string;
  };
  fileMessageData?: {
    caption?: string;
    fileName?: string;
  };
  quotedMessage?: {
    typeMessage?: string;
    textMessage?: string;
  };
};

type WhatsAppNotificationBody = {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
  };
  messageData?: WhatsAppNotificationMessageData;
};

type WhatsAppNotificationApiResponse = {
  success?: boolean;
  configured?: boolean;
  changed?: boolean;
  deleted?: boolean;
  notification?: {
    receiptId?: number;
    body?: WhatsAppNotificationBody;
  } | null;
  error?: string;
};

interface WhatsAppQrPanelProps {
  onConnectionChange?: (connected: boolean) => void;
  onSyncActivityChange?: (syncing: boolean) => void;
  embedded?: boolean;
}

export const WhatsAppQrPanel: React.FC<WhatsAppQrPanelProps> = ({
  onConnectionChange,
  onSyncActivityChange,
  embedded = false,
}) => {
  const requestInFlightRef = useRef(false);
  const historyInFlightRef = useRef(false);
  const avatarInFlightRef = useRef(new Set<string>());
  const avatarCacheRef = useRef<Record<string, string | null>>({});
  const readTimestampsRef = useRef<Record<string, number>>({});
  const hasShownInitialSyncNoticeRef = useRef(false);
  const selectedChatRef = useRef<WhatsAppChatItem | null>(null);
  const notificationLoopIdRef = useRef(0);
  const realtimeSyncEnabledRef = useRef(false);
  const [qrCode, setQrCode] = useState("");
  const [chats, setChats] = useState<WhatsAppChatItem[]>([]);
  const [searchContacts, setSearchContacts] = useState<WhatsAppChatItem[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [connected, setConnected] = useState(false);
  const [realtimeWorkerActive, setRealtimeWorkerActive] = useState(false);
  const [stateInstance, setStateInstance] = useState("");
  const [statusInstance, setStatusInstance] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [selectedChat, setSelectedChat] = useState<WhatsAppChatItem | null>(null);
  const [messages, setMessages] = useState<WhatsAppConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "incoming" | "groups">("all");
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [composerTab, setComposerTab] = useState<"emoji" | "gif">("emoji");
  const [emojiCategory, setEmojiCategory] = useState("smileys");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [gifSearch, setGifSearch] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [composerOverlay, setComposerOverlay] = useState<ComposerOverlayType>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    company: "",
  });
  const [pollForm, setPollForm] = useState({
    question: "",
    options: ["", ""],
    multipleAnswers: false,
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    location: "",
    description: "",
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const stickerInputRef = useRef<HTMLInputElement | null>(null);

  const sortChatsByTimestamp = (items: WhatsAppChatItem[]) =>
    [...items].sort((left, right) => {
      const leftHasUnread = Number(left.unreadCount || 0) > 0 ? 1 : 0;
      const rightHasUnread = Number(right.unreadCount || 0) > 0 ? 1 : 0;

      if (leftHasUnread !== rightHasUnread) {
        return rightHasUnread - leftHasUnread;
      }

      const leftSortTimestamp = Math.max(
        Number(left.timestamp || 0),
        Number(left.latestIncomingTimestamp || 0)
      );
      const rightSortTimestamp = Math.max(
        Number(right.timestamp || 0),
        Number(right.latestIncomingTimestamp || 0)
      );

      return rightSortTimestamp - leftSortTimestamp;
    });

  const reconcileOverviewChats = (
    currentChats: WhatsAppChatItem[],
    incomingChats: WhatsAppChatItem[]
  ) => {
    const currentChatsById = new Map(currentChats.map((chat) => [chat.chatId, chat] as const));

    return sortChatsByTimestamp(
      incomingChats.map((chat) => {
        const existingChat = currentChatsById.get(chat.chatId);
        const readTimestamp = Number(readTimestampsRef.current[chat.chatId] || 0);
        const latestIncomingTimestamp = Number(
          chat.latestIncomingTimestamp || existingChat?.latestIncomingTimestamp || 0
        );
        const unreadCount =
          latestIncomingTimestamp > readTimestamp
            ? Number(chat.unreadCount || existingChat?.unreadCount || 0)
            : 0;

        if (!existingChat) {
          return {
            ...chat,
            unreadCount,
            latestIncomingTimestamp,
          };
        }

        if (Number(existingChat.timestamp || 0) > Number(chat.timestamp || 0)) {
          return {
            ...chat,
            preview: existingChat.preview || chat.preview,
            timestamp: existingChat.timestamp,
            direction: existingChat.direction || chat.direction,
            typeMessage: existingChat.typeMessage || chat.typeMessage,
            statusMessage: existingChat.statusMessage || chat.statusMessage,
            unreadCount,
            latestIncomingTimestamp,
          };
        }

        return {
          ...existingChat,
          ...chat,
          unreadCount,
          latestIncomingTimestamp,
        };
      })
    );
  };

  const getConversationPreview = (message: WhatsAppConversationMessage) => {
    const normalizedText = String(message.text || "").trim();

    if (normalizedText) {
      return normalizedText;
    }

    const typeLabels: Record<string, string> = {
      imageMessage: "Imagem",
      videoMessage: "Video",
      audioMessage: "Audio",
      documentMessage: "Documento",
      extendedTextMessage: "Mensagem",
      textMessage: "Mensagem",
      stickerMessage: "Sticker",
    };

    return typeLabels[String(message.typeMessage || "")] || "Mensagem";
  };

  const formatChatIdFallback = (chatId: string) => chatId.replace(/@.+$/, "");

  const getNotificationDirection = (notification?: WhatsAppNotificationBody) => {
    const typeWebhook = String(notification?.typeWebhook || "");

    if (typeWebhook === "incomingMessageReceived") {
      return "incoming";
    }

    if (
      typeWebhook === "outgoingMessageReceived" ||
      typeWebhook === "outgoingAPIMessageReceived"
    ) {
      return "outgoing";
    }

    return "";
  };

  const getNotificationPreview = (notification?: WhatsAppNotificationBody) => {
    const messageData = notification?.messageData;
    const textMessage = String(messageData?.textMessageData?.textMessage || "").trim();
    const extendedText = String(
      messageData?.extendedTextMessageData?.text ||
        messageData?.extendedTextMessageData?.textMessage ||
        messageData?.extendedTextMessageData?.description ||
        messageData?.extendedTextMessageData?.title ||
        ""
    ).trim();
    const fileCaption = String(messageData?.fileMessageData?.caption || "").trim();
    const fileName = String(messageData?.fileMessageData?.fileName || "").trim();

    if (textMessage) {
      return textMessage;
    }

    if (extendedText) {
      return extendedText;
    }

    if (fileCaption) {
      return fileCaption;
    }

    if (fileName) {
      return fileName;
    }

    const typeLabels: Record<string, string> = {
      imageMessage: "Imagem",
      videoMessage: "Vídeo",
      audioMessage: "Áudio",
      documentMessage: "Documento",
      extendedTextMessage: "Mensagem",
      textMessage: "Mensagem",
      stickerMessage: "Sticker",
    };

    return typeLabels[String(messageData?.typeMessage || "")] || "Mensagem";
  };

  const applyRealtimeNotification = (notification?: WhatsAppNotificationBody) => {
    const chatId = String(notification?.senderData?.chatId || "").trim();
    const direction = getNotificationDirection(notification);

    if (!chatId || !direction) {
      return;
    }

    const timestamp = Number(notification?.timestamp || 0);
    const selectedChatId = selectedChatRef.current?.chatId || "";
    const preview = getNotificationPreview(notification);
    const fallbackTitle = String(
      notification?.senderData?.senderContactName ||
        notification?.senderData?.senderName ||
        notification?.senderData?.chatName ||
        ""
    ).trim();
    const isGroup = chatId.endsWith("@g.us");

    setChats((currentChats) => {
      const existingChat = currentChats.find((chat) => chat.chatId === chatId);
      const nextChat: WhatsAppChatItem = {
        chatId,
        title: existingChat?.title || fallbackTitle || formatChatIdFallback(chatId),
        subtitle: existingChat?.subtitle || (isGroup ? "Grupo do WhatsApp" : "Contato do WhatsApp"),
        preview: preview || existingChat?.preview || "Mensagem",
        timestamp: Math.max(Number(existingChat?.timestamp || 0), timestamp),
        direction: direction || existingChat?.direction || "incoming",
        typeMessage:
          String(notification?.messageData?.typeMessage || "").trim() ||
          existingChat?.typeMessage ||
          "",
        statusMessage: existingChat?.statusMessage || "",
        isGroup: existingChat?.isGroup ?? isGroup,
        unreadCount:
          direction === "incoming" && selectedChatId !== chatId
            ? Number(existingChat?.unreadCount || 0) + 1
            : 0,
        latestIncomingTimestamp:
          direction === "incoming"
            ? Math.max(Number(existingChat?.latestIncomingTimestamp || 0), timestamp)
            : Number(existingChat?.latestIncomingTimestamp || 0),
      };

      return sortChatsByTimestamp([
        nextChat,
        ...currentChats.filter((chat) => chat.chatId !== chatId),
      ]);
    });

    setSelectedChat((currentSelectedChat) => {
      if (!currentSelectedChat || currentSelectedChat.chatId !== chatId) {
        return currentSelectedChat;
      }

      return {
        ...currentSelectedChat,
        preview: preview || currentSelectedChat.preview,
        timestamp: Math.max(Number(currentSelectedChat.timestamp || 0), timestamp),
        direction: direction || currentSelectedChat.direction,
        typeMessage:
          String(notification?.messageData?.typeMessage || "").trim() ||
          currentSelectedChat.typeMessage,
        unreadCount: 0,
        latestIncomingTimestamp:
          direction === "incoming"
            ? Math.max(Number(currentSelectedChat.latestIncomingTimestamp || 0), timestamp)
            : Number(currentSelectedChat.latestIncomingTimestamp || 0),
      };
    });
  };

  const syncChatSnapshot = (
    chat: WhatsAppChatItem,
    nextMessages: WhatsAppConversationMessage[]
  ) => {
    if (nextMessages.length === 0) {
      return;
    }

    const latestMessage = nextMessages.reduce((latest, current) =>
      Number(current.timestamp || 0) > Number(latest.timestamp || 0) ? current : latest
    );

    setChats((currentChats) => {
      const currentChat = currentChats.find((item) => item.chatId === chat.chatId) || chat;
      const latestTimestamp = Number(latestMessage.timestamp || 0);
      const shouldPromotePreview = latestTimestamp >= Number(currentChat.timestamp || 0);

      return sortChatsByTimestamp([
        {
          ...currentChat,
          timestamp: Math.max(Number(currentChat.timestamp || 0), latestTimestamp),
          preview: shouldPromotePreview
            ? getConversationPreview(latestMessage) || currentChat.preview
            : currentChat.preview,
          direction: shouldPromotePreview
            ? latestMessage.direction || currentChat.direction
            : currentChat.direction,
          typeMessage: shouldPromotePreview
            ? latestMessage.typeMessage || currentChat.typeMessage
            : currentChat.typeMessage,
          statusMessage: shouldPromotePreview
            ? latestMessage.statusMessage || currentChat.statusMessage
            : currentChat.statusMessage,
          unreadCount:
            latestMessage.direction === "incoming"
              ? Number(currentChat.unreadCount || 0)
              : 0,
          latestIncomingTimestamp:
            latestMessage.direction === "incoming"
              ? latestTimestamp
              : Number(currentChat.latestIncomingTimestamp || 0),
        },
        ...currentChats.filter((item) => item.chatId !== chat.chatId),
      ]);
    });

    setSelectedChat((currentSelectedChat) => {
      if (!currentSelectedChat || currentSelectedChat.chatId !== chat.chatId) {
        return currentSelectedChat;
      }

      const latestTimestamp = Number(latestMessage.timestamp || 0);
      const shouldPromotePreview = latestTimestamp >= Number(currentSelectedChat.timestamp || 0);

      return {
        ...currentSelectedChat,
        timestamp: Math.max(Number(currentSelectedChat.timestamp || 0), latestTimestamp),
        preview: shouldPromotePreview
          ? getConversationPreview(latestMessage) || currentSelectedChat.preview
          : currentSelectedChat.preview,
        direction: shouldPromotePreview
          ? latestMessage.direction || currentSelectedChat.direction
          : currentSelectedChat.direction,
        typeMessage: shouldPromotePreview
          ? latestMessage.typeMessage || currentSelectedChat.typeMessage
          : currentSelectedChat.typeMessage,
        statusMessage: shouldPromotePreview
          ? latestMessage.statusMessage || currentSelectedChat.statusMessage
          : currentSelectedChat.statusMessage,
        unreadCount:
          latestMessage.direction === "incoming"
            ? Number(currentSelectedChat.unreadCount || 0)
            : 0,
        latestIncomingTimestamp:
          latestMessage.direction === "incoming"
            ? latestTimestamp
            : Number(currentSelectedChat.latestIncomingTimestamp || 0),
      };
    });
  };

  const loadChatAvatar = async (chatId: string) => {
    const normalizedChatId = String(chatId || "").trim();

    if (
      !normalizedChatId ||
      Object.prototype.hasOwnProperty.call(avatarCacheRef.current, normalizedChatId) ||
      avatarInFlightRef.current.has(normalizedChatId)
    ) {
      return;
    }

    avatarInFlightRef.current.add(normalizedChatId);

    try {
      const response = await fetch(`/api/whatsapp-avatar?chatId=${encodeURIComponent(normalizedChatId)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as WhatsAppAvatarApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar o avatar do contato.");
      }

      setAvatarUrls((current) => ({
        ...current,
        [normalizedChatId]: String(data.avatarUrl || "").trim() || null,
      }));
      avatarCacheRef.current[normalizedChatId] = String(data.avatarUrl || "").trim() || null;
    } catch (avatarError) {
      console.warn("Não foi possível carregar o avatar do chat:", avatarError);
      setAvatarUrls((current) => ({
        ...current,
        [normalizedChatId]: null,
      }));
      avatarCacheRef.current[normalizedChatId] = null;
    } finally {
      avatarInFlightRef.current.delete(normalizedChatId);
    }
  };

  const loadOverview = async (isManualRefresh = false) => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;

    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/whatsapp-overview", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as WhatsAppOverviewApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar o painel do WhatsApp.");
      }

      const nextConnected = Boolean(data.connected);

      if (nextConnected && !connected) {
        setStatusNote("WhatsApp conectado com sucesso. Conversas carregadas.");
      }
      if (!nextConnected) {
        hasShownInitialSyncNoticeRef.current = false;
      }

      setConnected(nextConnected);
      onConnectionChange?.(nextConnected);
      setStateInstance(data.stateInstance || "");
      setStatusInstance(data.statusInstance || "");
      setQrCode(data.qrCode || "");
      const nextChats = Array.isArray(data.chats) ? data.chats : [];
      const nextContacts = Array.isArray(data.contacts) ? data.contacts : [];
      setChats((currentChats) => reconcileOverviewChats(currentChats, nextChats));
      setSearchContacts(nextContacts);
      setFetchedAt(data.fetchedAt || "");

      if (!isManualRefresh && nextConnected && nextChats.length > 0 && !hasShownInitialSyncNoticeRef.current) {
        hasShownInitialSyncNoticeRef.current = true;
        setStatusNote("Sincronização inicial concluída.");
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Erro inesperado ao buscar o WhatsApp.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInFlightRef.current = false;
    }
  };

  const loadChatHistory = async (chat: WhatsAppChatItem, silent = false) => {
    if (historyInFlightRef.current) {
      return;
    }

    historyInFlightRef.current = true;
    setSelectedChat(chat);
    setChatError("");

    if (!silent) {
      setLoadingMessages(true);
    }

    try {
      const response = await fetch(
        `/api/whatsapp-chat?chatId=${encodeURIComponent(chat.chatId)}&count=50`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = (await response.json()) as WhatsAppChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar a conversa.");
      }

      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      const latestConversationTimestamp = nextMessages.reduce(
        (latestTimestamp, message) => Math.max(latestTimestamp, Number(message.timestamp || 0)),
        0
      );

      readTimestampsRef.current[chat.chatId] = latestConversationTimestamp;
      setMessages(nextMessages);
      syncChatSnapshot(chat, nextMessages);
      setChats((currentChats) =>
        sortChatsByTimestamp(
          currentChats.map((currentChat) =>
            currentChat.chatId === chat.chatId
              ? {
                  ...currentChat,
                  unreadCount: 0,
                }
              : currentChat
          )
        )
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Erro inesperado ao abrir a conversa.";
      setChatError(message);
    } finally {
      setLoadingMessages(false);
      historyInFlightRef.current = false;
    }
  };

  const syncComposerAfterSend = async () => {
    if (!selectedChatRef.current) {
      return;
    }

    await loadChatHistory(selectedChatRef.current, true);
    await loadOverview(true);
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
      reader.readAsDataURL(file);
    });

  const registerRecentEmoji = (emoji: string) => {
    setRecentEmojis((current) => {
      const nextRecent = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 24);
      window.localStorage.setItem("rcmolina_whatsapp_recent_emojis", JSON.stringify(nextRecent));
      return nextRecent;
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessageText((current) => `${current}${emoji}`);
    registerRecentEmoji(emoji);
  };

  const sendStructuredPayload = async (
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!selectedChatRef.current) {
      return;
    }

    setAttachmentLoading(true);
    setChatError("");

    try {
      const response = await fetch("/api/whatsapp-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: selectedChatRef.current.chatId,
          ...payload,
        }),
      });

      const data = (await response.json()) as WhatsAppChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar o conteúdo.");
      }

      await syncComposerAfterSend();
      setStatusNote(successMessage);
      setIsAttachmentMenuOpen(false);
      setComposerOverlay(null);
      setIsEmojiPickerOpen(false);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Erro inesperado ao enviar o conteúdo.";
      setChatError(message);
    } finally {
      setAttachmentLoading(false);
    }
  };

  const sendFileLikePayload = async (
    fileName: string,
    mimeType: string,
    fileBase64: string,
    caption: string,
    successMessage: string,
    typingType = ""
  ) =>
    sendStructuredPayload(
      {
        action: "file",
        fileName,
        mimeType,
        fileBase64,
        caption,
        typingType,
        typingTime: typingType === "recording" ? 4000 : 2000,
      },
      successMessage
    );

  const buildEventIcsBase64 = () => {
    const startDate = String(eventForm.startDate || "").trim();
    const startTime = String(eventForm.startTime || "").trim();
    const endDate = String(eventForm.endDate || startDate).trim();
    const endTime = String(eventForm.endTime || startTime).trim();

    if (!eventForm.title.trim() || !startDate || !startTime || !endDate || !endTime) {
      throw new Error("Preencha título, data e horário do evento.");
    }

    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new Error("Informe um período válido para o evento.");
    }

    const toIcsDate = (value: Date) =>
      value
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");

    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RC MOLINA//WhatsApp//PT-BR",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@rcmolina`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${eventForm.title.trim()}`,
      `LOCATION:${eventForm.location.trim()}`,
      `DESCRIPTION:${eventForm.description.trim()}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter((line) => !line.endsWith(":"))
      .join("\r\n");

    return window.btoa(unescape(encodeURIComponent(content)));
  };

  const convertImageFileToSticker = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Não foi possível preparar a figurinha."));
        nextImage.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Seu navegador não conseguiu preparar a figurinha.");
      }

      context.clearRect(0, 0, size, size);
      const scale = Math.min(size / image.width, size / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const offsetX = (size - drawWidth) / 2;
      const offsetY = (size - drawHeight) / 2;
      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

      const dataUrl = canvas.toDataURL("image/webp", 0.92);

      return {
        fileName: `${file.name.replace(/\.[^.]+$/, "") || "figurinha"}.webp`,
        mimeType: "image/webp",
        fileBase64: dataUrl,
      };
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleSelectedFile = async (intent: MediaIntent, file?: File | null) => {
    if (!file || !selectedChatRef.current) {
      return;
    }

    const defaultCaption =
      intent === "sticker" ? "" : intent === "audio" ? "Áudio enviado" : messageText.trim();

    try {
      if (intent === "sticker") {
        const stickerData = await convertImageFileToSticker(file);
        await sendFileLikePayload(
          stickerData.fileName,
          stickerData.mimeType,
          stickerData.fileBase64,
          "",
          "Figurinha enviada com sucesso."
        );
        return;
      }

      const fileBase64 = await fileToBase64(file);
      const successMap: Record<MediaIntent, string> = {
        document: "Documento enviado com sucesso.",
        media: "Mídia enviada com sucesso.",
        camera: "Foto ou vídeo enviado com sucesso.",
        audio: "Áudio enviado com sucesso.",
        sticker: "Figurinha enviada com sucesso.",
      };

      await sendFileLikePayload(
        file.name,
        file.type || "application/octet-stream",
        fileBase64,
        defaultCaption,
        successMap[intent]
      );
    } finally {
      setMessageText("");
    }
  };

  const triggerFilePicker = (intent: MediaIntent) => {
    setIsAttachmentMenuOpen(false);

    if (intent === "document") {
      documentInputRef.current?.click();
      return;
    }

    if (intent === "media") {
      mediaInputRef.current?.click();
      return;
    }

    if (intent === "camera") {
      cameraInputRef.current?.click();
      return;
    }

    if (intent === "audio") {
      audioInputRef.current?.click();
      return;
    }

    stickerInputRef.current?.click();
  };

  const handleGifSend = async (fileUrl: string, title: string) => {
    await sendStructuredPayload(
      {
        action: "file",
        fileUrl,
        fileName: `${title.toLowerCase().replace(/\s+/g, "-")}.mp4`,
        mimeType: "video/mp4",
        caption: title,
      },
      "GIF enviado com sucesso."
    );
  };

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendStructuredPayload(
      {
        action: "contact",
        contact: contactForm,
      },
      "Contato enviado com sucesso."
    );
    setContactForm({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      company: "",
    });
  };

  const handlePollSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendStructuredPayload(
      {
        action: "poll",
        poll: pollForm,
      },
      "Enquete enviada com sucesso."
    );
    setPollForm({
      question: "",
      options: ["", ""],
      multipleAnswers: false,
    });
  };

  const handleEventSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fileBase64 = buildEventIcsBase64();
    await sendFileLikePayload(
      `${eventForm.title.trim().replace(/\s+/g, "-").toLowerCase() || "evento"}.ics`,
      "text/calendar",
      `data:text/calendar;base64,${fileBase64}`,
      `Convite: ${eventForm.title.trim()}`,
      "Evento enviado com sucesso."
    );
    setEventForm({
      title: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
      description: "",
    });
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const resetRecordingState = () => {
    stopRecordingTimer();
    setRecording(false);
    setRecordingSeconds(0);
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      recordingChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }

    resetRecordingState();
  };

  const finishVoiceRecording = async () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        async () => {
          try {
            const recordedBlob = new Blob(recordingChunksRef.current, {
              type: recorder.mimeType || "audio/ogg",
            });
            const file = new File([recordedBlob], `audio-${Date.now()}.ogg`, {
              type: "audio/ogg",
            });
            const fileBase64 = await fileToBase64(file);
            await sendFileLikePayload(
              file.name,
              "audio/ogg",
              fileBase64,
              "",
              "Mensagem de voz enviada com sucesso.",
              "recording"
            );
          } catch (recordingError) {
            const message =
              recordingError instanceof Error
                ? recordingError.message
                : "Não foi possível enviar a mensagem de voz.";
            setChatError(message);
          } finally {
            resetRecordingState();
            resolve();
          }
        },
        { once: true }
      );

      recorder.stop();
    });
  };

  const startVoiceRecording = async () => {
    if (recording || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";
      const recorder = new MediaRecorder(
        stream,
        preferredMimeType ? { mimeType: preferredMimeType } : undefined
      );

      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener(
        "stop",
        () => {
          stream.getTracks().forEach((track) => track.stop());
        },
        { once: true }
      );

      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
      setStatusNote("Gravação iniciada. Toque novamente no microfone para enviar.");
    } catch (recordingError) {
      const message =
        recordingError instanceof Error
          ? recordingError.message
          : "Não foi possível acessar o microfone.";
      setChatError(message);
      resetRecordingState();
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedChat || !messageText.trim()) {
      return;
    }

    setSendingMessage(true);
    setChatError("");

    try {
      const response = await fetch("/api/whatsapp-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: selectedChat.chatId,
          message: messageText.trim(),
        }),
      });

      const data = (await response.json()) as WhatsAppChatApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar a mensagem.");
      }

      setMessageText("");
      await loadChatHistory(selectedChat, true);
      await loadOverview(true);
      setStatusNote("Mensagem enviada com sucesso.");
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Erro inesperado ao enviar a mensagem.";
      setChatError(message);
    } finally {
      setSendingMessage(false);
    }
  };

  const ensureRealtimeNotifications = async () => {
    if (realtimeSyncEnabledRef.current) {
      return true;
    }

    const response = await fetch("/api/whatsapp-notifications", {
      method: "POST",
      cache: "no-store",
    });

    const data = (await response.json()) as WhatsAppNotificationApiResponse;

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível ativar as notificações em tempo real.");
    }

    realtimeSyncEnabledRef.current = true;
    return true;
  };

  const consumeNotificationQueue = async (signal?: AbortSignal) => {
    const response = await fetch(
      `/api/whatsapp-notifications?receiveTimeout=${QUEUE_RECEIVE_TIMEOUT_SECONDS}`,
      {
        method: "GET",
        cache: "no-store",
        signal,
      }
    );

    const data = (await response.json()) as WhatsAppNotificationApiResponse;

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível ler a fila de notificações.");
    }

    return data.notification?.body || null;
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    const savedRecentEmojis = window.localStorage.getItem("rcmolina_whatsapp_recent_emojis");

    if (!savedRecentEmojis) {
      return;
    }

    try {
      const parsed = JSON.parse(savedRecentEmojis);

      if (Array.isArray(parsed)) {
        setRecentEmojis(parsed.filter((item) => typeof item === "string").slice(0, 24));
      }
    } catch (_error) {
      window.localStorage.removeItem("rcmolina_whatsapp_recent_emojis");
    }
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    const isSyncing =
      loading ||
      refreshing ||
      loadingMessages ||
      sendingMessage ||
      attachmentLoading ||
      (connected && realtimeWorkerActive);

    onSyncActivityChange?.(isSyncing);
  }, [
    attachmentLoading,
    connected,
    loading,
    loadingMessages,
    onSyncActivityChange,
    realtimeWorkerActive,
    refreshing,
    sendingMessage,
  ]);

  useEffect(() => {
    return () => {
      onSyncActivityChange?.(false);
    };
  }, [onSyncActivityChange]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
    };
  }, []);

  useEffect(() => {
    if (!statusNote) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusNote("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [statusNote]);

  useEffect(() => {
    const refreshInterval = connected
      ? CONNECTED_OVERVIEW_REFRESH_MS
      : DISCONNECTED_OVERVIEW_REFRESH_MS;
    const intervalId = window.setInterval(() => {
      void loadOverview(true);
    }, refreshInterval);

    return () => window.clearInterval(intervalId);
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      realtimeSyncEnabledRef.current = false;
      setRealtimeWorkerActive(false);
      return;
    }

    const currentLoopId = ++notificationLoopIdRef.current;
    let activeController: AbortController | null = null;

    const startQueueLoop = async () => {
      try {
        await ensureRealtimeNotifications();
        setRealtimeWorkerActive(true);
      } catch (queueError) {
        if (notificationLoopIdRef.current !== currentLoopId) {
          return;
        }

        setRealtimeWorkerActive(false);
        const message =
          queueError instanceof Error
            ? queueError.message
            : "Não foi possível ativar a sincronização em tempo real.";
        setStatusNote(message);
        return;
      }

      while (notificationLoopIdRef.current === currentLoopId) {
        try {
          activeController = new AbortController();
          const notification = await consumeNotificationQueue(activeController.signal);

          if (notificationLoopIdRef.current !== currentLoopId) {
            return;
          }

          if (!notification) {
            continue;
          }

          const notificationChatId = String(notification.senderData?.chatId || "").trim();
          applyRealtimeNotification(notification);
          await loadOverview(true);

          if (selectedChatRef.current && selectedChatRef.current.chatId === notificationChatId) {
            await loadChatHistory(selectedChatRef.current, true);
          }
        } catch (queueError) {
          if (activeController?.signal.aborted || notificationLoopIdRef.current !== currentLoopId) {
            return;
          }

          console.warn("Falha ao processar fila em tempo real do WhatsApp:", queueError);
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
    };

    void startQueueLoop();

    return () => {
      if (notificationLoopIdRef.current === currentLoopId) {
        notificationLoopIdRef.current += 1;
      }

      activeController?.abort();
    };
  }, [connected]);

  useEffect(() => {
    if (!connected || !selectedChat) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadChatHistory(selectedChat, true);
    }, SELECTED_CHAT_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [connected, selectedChat]);

  useEffect(() => {
    const handleVisibilitySync = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadOverview(true);

      if (selectedChat) {
        void loadChatHistory(selectedChat, true);
      }
    };

    window.addEventListener("focus", handleVisibilitySync);
    document.addEventListener("visibilitychange", handleVisibilitySync);

    return () => {
      window.removeEventListener("focus", handleVisibilitySync);
      document.removeEventListener("visibilitychange", handleVisibilitySync);
    };
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat) {
      return;
    }

    const refreshedChat = chats.find((chat) => chat.chatId === selectedChat.chatId);

    if (refreshedChat && refreshedChat !== selectedChat) {
      setSelectedChat(refreshedChat);
    }
  }, [chats, selectedChat]);

  useEffect(() => {
    if (!connected || chats.length === 0) {
      return;
    }

    const candidateChatIds = Array.from(
      new Set(
        [selectedChat?.chatId, ...chats.map((chat) => chat.chatId)].filter(
          (chatId): chatId is string => Boolean(chatId)
        )
      )
    );

    const timeoutIds = candidateChatIds.map((chatId, index) =>
      window.setTimeout(() => {
        void loadChatAvatar(chatId);
      }, index * 140)
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [chats, connected, selectedChat]);

  const lastUpdatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const connectionLabel = useMemo(() => {
    if (connected) {
      return "Conectado e online";
    }

    if (stateInstance || statusInstance) {
      return `${stateInstance || "aguardando"} / ${statusInstance || "aguardando"}`;
    }

    return "Aguardando autenticação";
  }, [connected, stateInstance, statusInstance]);
  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatConversationDateLabel = (timestamp: number) => {
    const messageDate = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const messageDateKey = messageDate.toLocaleDateString("pt-BR");
    const todayKey = today.toLocaleDateString("pt-BR");
    const yesterdayKey = yesterday.toLocaleDateString("pt-BR");

    if (messageDateKey === todayKey) {
      return "Hoje";
    }

    if (messageDateKey === yesterdayKey) {
      return "Ontem";
    }

    return messageDate.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const getMessageDayKey = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("pt-BR");
  const hasSelectedChat = Boolean(selectedChat);
  const showPanelSkeleton = loading && chats.length === 0 && !qrCode && !error && !fetchedAt;
  const connectedPanelStyle = embedded
    ? undefined
    : ({
        height: "min(960px, calc(100dvh - 8rem))",
      } as const);
  const conversationWallpaper = {
    backgroundColor: "#0b141a",
    backgroundImage:
      "radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.02) 2px, transparent 0), linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
    backgroundSize: "100px 100px, 120px 120px, 36px 36px, 36px 36px",
    backgroundPosition: "0 0, 30px 30px, 0 0, 0 0",
  } as const;
  const chatStats = useMemo(
    () => ({
      all: chats.length,
      incoming: chats.filter((chat) => Number(chat.unreadCount || 0) > 0).length,
      groups: chats.filter((chat) => chat.isGroup).length,
    }),
    [chats]
  );
  const filteredChats = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const searchPool = normalizedSearch
      ? [
          ...chats,
          ...searchContacts.filter(
            (contact) => !chats.some((chat) => chat.chatId === contact.chatId)
          ),
        ]
      : chats;

    return sortChatsByTimestamp(
      searchPool.filter((chat) => {
        if (activeFilter === "incoming" && Number(chat.unreadCount || 0) <= 0) {
          return false;
        }

        if (activeFilter === "groups" && !chat.isGroup) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = `${chat.title} ${chat.subtitle} ${chat.preview}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    );
  }, [activeFilter, chats, searchContacts, searchTerm]);
  const filteredEmojiCategories = useMemo(() => {
    const normalizedSearch = emojiSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return EMOJI_CATEGORIES;
    }

    return EMOJI_CATEGORIES.map((category) => ({
      ...category,
      emojis: category.emojis.filter((emoji) => {
        const alias = `${category.label} ${emoji}`.toLowerCase();
        return alias.includes(normalizedSearch);
      }),
    })).filter((category) => category.emojis.length > 0);
  }, [emojiSearch]);
  const activeEmojiCategoryData = filteredEmojiCategories.find((category) => category.id === emojiCategory)
    || filteredEmojiCategories[0]
    || EMOJI_CATEGORIES[0];
  const filteredGifs = useMemo(() => {
    const normalizedSearch = gifSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return GIF_PRESETS;
    }

    return GIF_PRESETS.filter((gif) =>
      `${gif.title} ${gif.tags.join(" ")}`.toLowerCase().includes(normalizedSearch)
    );
  }, [gifSearch]);
  const recordingTimeLabel = `${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(
    recordingSeconds % 60
  ).padStart(2, "0")}`;
  const attachmentMenuItems = [
    { id: "document" as const, label: "Documento", icon: "📄" },
    { id: "media" as const, label: "Fotos e vídeos", icon: "🖼️" },
    { id: "camera" as const, label: "Câmera", icon: "📸" },
    { id: "audio" as const, label: "Áudio", icon: "🎧" },
    { id: "contact" as const, label: "Contato", icon: "👤" },
    { id: "poll" as const, label: "Enquete", icon: "📊" },
    { id: "event" as const, label: "Evento", icon: "🗓️" },
    { id: "sticker" as const, label: "Nova figurinha", icon: "✨" },
  ];
  const getAvatarLabel = (title: string) =>
    title
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "WA";
  const getAvatarClassName = (chat: WhatsAppChatItem) => {
    if (chat.isGroup) {
      return "bg-gradient-to-br from-[#5b4bdb] to-[#8b5cf6] text-white";
    }

    return chat.direction === "incoming"
      ? "bg-gradient-to-br from-[#0f766e] to-[#14b8a6] text-white"
      : "bg-gradient-to-br from-[#2563eb] to-[#38bdf8] text-white";
  };
  const getChatPreviewMeta = (chat: WhatsAppChatItem) => {
    if (chat.typeMessage === "audioMessage") {
      return {
        icon: <Mic className="h-4 w-4 text-[#25d366]" />,
        textClassName: "text-[#7df0a2]",
      };
    }

    if (chat.direction === "outgoing") {
      return {
        icon: <CheckCheck className="h-4 w-4 text-[#c7d0d4]" />,
        textClassName: "text-[#c7d0d4]",
      };
    }

    return {
      icon: <Check className="h-4 w-4 text-[#25d366]" />,
      textClassName: "text-[#d6e0e4]",
    };
  };
  const renderChatAvatar = (
    chat: WhatsAppChatItem,
    sizeClassName: string,
    textClassName: string
  ) => {
    const avatarUrl = avatarUrls[chat.chatId];

    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${sizeClassName} ${textClassName} ${getAvatarClassName(
          chat
        )}`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Foto de perfil de ${chat.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          getAvatarLabel(chat.title)
        )}
      </div>
    );
  };
  const renderMessageBody = (message: WhatsAppConversationMessage) => {
    const isImage = message.typeMessage === "imageMessage";
    const isSticker = message.typeMessage === "stickerMessage";
    const isAudio = message.typeMessage === "audioMessage";
    const isDocument = message.typeMessage === "documentMessage";
    const isVideo = message.typeMessage === "videoMessage";
    const isContact = message.typeMessage === "contactMessage";
    const isPoll = message.typeMessage === "pollMessage";
    const normalizedMimeType = String(message.mimeType || "").toLowerCase();
    const normalizedFileName = String(message.fileName || message.text || "").trim();
    const isPdf =
      normalizedMimeType.includes("pdf") || normalizedFileName.toLowerCase().endsWith(".pdf");

    if ((isImage || isSticker) && (message.mediaUrl || message.thumbnailUrl)) {
      const source = message.mediaUrl || message.thumbnailUrl || "";
      const imageClassName = isSticker
        ? "h-28 w-28 object-contain"
        : "max-h-72 w-full rounded-2xl object-cover";

      return (
        <div className="space-y-2">
          <img
            src={source}
            alt={message.text || (isSticker ? "Sticker do WhatsApp" : "Imagem do WhatsApp")}
            className={imageClassName}
            loading="lazy"
          />
          {message.text && message.text !== "Imagem" && message.text !== "Sticker" ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          ) : null}
        </div>
      );
    }

    if (isAudio && message.mediaUrl) {
      return (
        <div className="space-y-2">
          <audio controls preload="none" src={message.mediaUrl} className="w-full min-w-[220px]" />
          {message.text && message.text !== "Audio" ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          ) : null}
        </div>
      );
    }

    if (isVideo && message.mediaUrl) {
      return (
        <div className="space-y-2">
          <video
            controls
            loop
            playsInline
            preload="metadata"
            src={message.mediaUrl}
            className="max-h-72 w-full rounded-2xl bg-black/30"
          />
          {message.text && message.text !== "Vídeo" && message.text !== "Video" ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          ) : null}
        </div>
      );
    }

    if (isDocument) {
      const previewSource = message.thumbnailUrl || "";
      const downloadLabel = isPdf ? "Abrir PDF" : "Abrir arquivo";
      const showDescription =
        message.text &&
        message.text !== "Documento" &&
        message.text !== normalizedFileName;

      return (
        <div className="space-y-3">
          {previewSource ? (
            <a
              href={message.mediaUrl || previewSource}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-white/10 bg-[#1b2730]"
            >
              <img
                src={previewSource}
                alt={normalizedFileName || "Miniatura do documento"}
                className="max-h-56 w-full object-cover"
                loading="lazy"
              />
            </a>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-[#7ae3bf]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-current">
                  {normalizedFileName || "Documento do WhatsApp"}
                </p>
                <p className="mt-1 text-xs text-inherit/70">
                  {normalizedMimeType || "Arquivo recebido"}
                </p>
              </div>
            </div>

            {showDescription ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            ) : null}

            {message.mediaUrl ? (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-10 items-center rounded-full bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-current transition-colors hover:bg-white/18"
              >
                {downloadLabel}
              </a>
            ) : null}
          </div>
        </div>
      );
    }

    if (isContact) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="text-sm font-semibold">Contato compartilhado</p>
          <p className="mt-1 text-sm leading-6">{message.text}</p>
        </div>
      );
    }

    if (isPoll) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="text-sm font-semibold">Enquete</p>
          <p className="mt-1 text-sm leading-6">{message.text}</p>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>;
  };

  const renderChatList = () => (
    <aside
      className={`border-r border-white/6 bg-[#111b21] ${
        hasSelectedChat ? "hidden xl:flex" : "flex"
      } h-full min-h-0 flex-col`}
    >
      <div className="flex-shrink-0 border-b border-white/6 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#00a884]">
              WhatsApp
            </p>
            <h2 className="mt-2 text-[30px] font-bold leading-none text-white">Conversas</h2>
          </div>
          <div className="flex items-center gap-2 text-[#aebac1]">
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={refreshing}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-white/4 transition-colors hover:bg-white/8 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-white/4 transition-colors hover:bg-white/8"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-white/10 px-4 py-3">
          <div className="flex items-center gap-3 text-[#aebac1]">
            <Search className="h-4 w-4" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#93a2aa]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-hidden">
          {[
            { id: "all" as const, label: "Tudo", count: chatStats.all },
            { id: "incoming" as const, label: "Entradas", count: chatStats.incoming },
            { id: "groups" as const, label: "Grupos", count: chatStats.groups },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? "border-[#005c4b] bg-[#103529] text-[#d9fdd3]"
                  : "border-white/10 bg-transparent text-[#aebac1] hover:bg-white/6"
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeFilter === filter.id
                    ? "bg-[#00a884] text-[#041a14]"
                    : "bg-white/8 text-[#d0d7db]"
                }`}
              >
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-[#d0d7db]">
          <Archive className="h-4 w-4 text-[#00a884]" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Arquivadas</p>
            <p className="text-xs text-[#8f9da4]">Chats sincronizados com a Green API</p>
          </div>
          <span className="text-xs font-semibold text-[#00a884]">{chatStats.all}</span>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {loading && chats.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-[#aebac1]">
            <Loader2 className="h-9 w-9 animate-spin text-[#00a884]" />
            <p className="text-sm font-medium">Carregando as conversas...</p>
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => {
            const previewMeta = getChatPreviewMeta(chat);

            return (
              <button
                key={chat.chatId}
                type="button"
                onClick={() => void loadChatHistory(chat)}
                className={`mb-2 flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition-all ${
                  selectedChat?.chatId === chat.chatId
                    ? "border-[#4b5257] bg-[#36393c] shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
                    : "border-[#34383c] bg-[#2f3133] hover:border-[#4a5156] hover:bg-[#35383b]"
                }`}
              >
                {renderChatAvatar(chat, "h-14 w-14", "text-sm")}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold leading-tight text-white">
                        {chat.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#97a3a9]">{chat.subtitle}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 pt-0.5">
                      <span className="whitespace-nowrap text-xs font-medium text-[#d5dcdf]">
                        {formatTimestamp(chat.timestamp).slice(-5)}
                      </span>
                      {Number(chat.unreadCount || 0) > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#25d366] px-2 py-0.5 text-[11px] font-bold text-[#082313]">
                          {chat.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                      {previewMeta.icon}
                    </span>
                    <p className={`truncate text-sm leading-5 ${previewMeta.textClassName}`}>
                      {chat.preview}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
            <Search className="h-10 w-10 text-[#00a884]" />
            <p className="text-base font-semibold text-white">Nenhum chat encontrado</p>
            <p className="text-sm leading-6 text-[#8f9da4]">
              Ajuste a pesquisa ou os filtros para localizar a conversa desejada.
            </p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-white/6 px-5 py-3 text-xs text-[#7d8b92]">
        {lastUpdatedLabel ? `Última atualização às ${lastUpdatedLabel}` : "Sincronizando chats"}
      </div>
    </aside>
  );

  const renderConversationPane = () => (
    <section
      className={`${
        hasSelectedChat ? "flex" : "hidden xl:flex"
      } h-full min-h-0 flex-col bg-[#0b141a]`}
    >
      {selectedChat ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-[#202c33] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedChat(null)}
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#d1d7db] transition-colors hover:bg-white/8 xl:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              {renderChatAvatar(selectedChat, "h-11 w-11", "text-sm")}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white sm:text-lg">
                  {selectedChat.title}
                </p>
                <p className="truncate text-xs text-[#aebac1]">
                  {selectedChat.isGroup ? "Grupo em andamento" : connectionLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#aebac1]">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/8"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/8"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
            style={conversationWallpaper}
          >
            {loadingMessages ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-[#d0d7db]">
                <Loader2 className="h-9 w-9 animate-spin text-[#00a884]" />
                <p className="text-sm font-medium">Carregando a conversa...</p>
              </div>
            ) : chatError ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
                <MessageCircle className="h-10 w-10 text-[#00a884]" />
                <p className="max-w-md text-sm leading-6 text-[#d0d7db]">{chatError}</p>
              </div>
            ) : messages.length > 0 ? (
              <div className="flex flex-col gap-2.5 pb-2">
                {messages.map((message, index) => {
                  const isOutgoing = message.direction === "outgoing";
                  const timeLabel = new Date(message.timestamp * 1000).toLocaleTimeString(
                    "pt-BR",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );
                  const previousMessage = index > 0 ? messages[index - 1] : null;
                  const shouldShowDateDivider =
                    !previousMessage ||
                    getMessageDayKey(previousMessage.timestamp) !== getMessageDayKey(message.timestamp);

                  return (
                    <React.Fragment key={message.idMessage}>
                      {shouldShowDateDivider ? (
                        <div className="flex justify-center py-3">
                          <span className="rounded-full bg-[#1f2c33]/90 px-4 py-1.5 text-xs font-medium text-[#dce3e7] shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
                            {formatConversationDateLabel(message.timestamp)}
                          </span>
                        </div>
                      ) : null}

                      <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.18)] sm:max-w-[78%] ${
                            isOutgoing
                              ? "bg-[#005c4b] text-white"
                              : "bg-[#202c33] text-[#e9edef]"
                          }`}
                        >
                          {!isOutgoing && message.senderName && selectedChat.isGroup ? (
                            <p className="mb-1 text-xs font-semibold text-[#7ae3bf]">
                              {message.senderName}
                            </p>
                          ) : null}

                          <div className="text-sm leading-6">{renderMessageBody(message)}</div>

                          <div
                            className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${
                              isOutgoing ? "text-[#d1f4cc]" : "text-[#8696a0]"
                            }`}
                          >
                            <span>{timeLabel}</span>
                            {isOutgoing ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
                <MessageCircle className="h-10 w-10 text-[#00a884]" />
                <p className="text-base font-semibold text-white">Ainda não há histórico disponível</p>
                <p className="max-w-md text-sm leading-6 text-[#aebac1]">
                  Assim que a Green API devolver mensagens desse chat, elas aparecem aqui no mesmo
                  formato da conversa.
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="relative border-t border-white/6 bg-[#202c33] px-3 py-3 sm:px-4"
          >
            {isAttachmentMenuOpen ? (
              <div className="absolute bottom-[calc(100%+0.75rem)] left-3 z-30 w-[220px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111b21] shadow-[0_24px_64px_rgba(0,0,0,0.38)]">
                <div className="border-b border-white/8 px-4 py-2.5">
                  <p className="text-sm font-semibold text-white">Compartilhar</p>
                  <p className="mt-0.5 text-xs text-[#8fa3ad]">Escolha o que deseja enviar</p>
                </div>
                <div className="p-0.5">
                  {attachmentMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (
                          item.id === "contact" ||
                          item.id === "poll" ||
                          item.id === "event" ||
                          item.id === "sticker"
                        ) {
                          setComposerOverlay(item.id);
                          setIsAttachmentMenuOpen(false);
                          return;
                        }

                        triggerFilePicker(item.id);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/6"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isEmojiPickerOpen ? (
              <div className="absolute bottom-[calc(100%+0.75rem)] left-3 right-3 z-30 overflow-hidden rounded-[26px] border border-white/10 bg-[#111b21] shadow-[0_24px_64px_rgba(0,0,0,0.42)] sm:right-4">
                <div className="border-b border-white/8 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setComposerTab("emoji")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                          composerTab === "emoji"
                            ? "bg-[#103529] text-[#d9fdd3]"
                            : "text-[#8fa3ad] hover:bg-white/6"
                        }`}
                      >
                        Emoji
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerTab("gif")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                          composerTab === "gif"
                            ? "bg-[#103529] text-[#d9fdd3]"
                            : "text-[#8fa3ad] hover:bg-white/6"
                        }`}
                      >
                        GIF
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEmojiPickerOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#aebac1] transition-colors hover:bg-white/8"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 rounded-full border border-[#00a884] px-4 py-2.5">
                    <div className="flex items-center gap-3 text-[#9db0b8]">
                      <Search className="h-4 w-4" />
                      <input
                        value={composerTab === "emoji" ? emojiSearch : gifSearch}
                        onChange={(event) =>
                          composerTab === "emoji"
                            ? setEmojiSearch(event.target.value)
                            : setGifSearch(event.target.value)
                        }
                        placeholder={composerTab === "emoji" ? "Pesquisar emoji" : "Pesquisar GIF"}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#81949c]"
                      />
                    </div>
                  </div>
                </div>

                {composerTab === "emoji" ? (
                  <div className="custom-scrollbar max-h-[360px] overflow-y-auto px-4 py-4">
                    {recentEmojis.length > 0 ? (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-[#cbd5db]">Recentes</p>
                        <div className="mt-1.5 flex flex-wrap gap-0">
                          {recentEmojis.map((emoji) => (
                            <button
                              key={`recent-${emoji}`}
                              type="button"
                              onClick={() => handleInsertEmoji(emoji)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-white/8"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mb-2.5 flex gap-1 overflow-x-auto pb-1">
                      {filteredEmojiCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setEmojiCategory(category.id)}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            activeEmojiCategoryData?.id === category.id
                              ? "bg-[#103529] text-[#d9fdd3]"
                              : "bg-white/6 text-[#aebac1] hover:bg-white/10"
                          }`}
                        >
                          <span>{category.icon}</span>
                          <span>{category.label}</span>
                        </button>
                      ))}
                    </div>

                    {activeEmojiCategoryData ? (
                      <div>
                        <p className="text-sm font-semibold text-[#cbd5db]">
                          {activeEmojiCategoryData.label}
                        </p>
                        <div className="mt-2 grid grid-cols-7 gap-x-1 gap-y-2 sm:grid-cols-9 lg:grid-cols-10">
                          {activeEmojiCategoryData.emojis.map((emoji) => (
                            <button
                              key={`${activeEmojiCategoryData.id}-${emoji}`}
                              type="button"
                              onClick={() => handleInsertEmoji(emoji)}
                              className="inline-flex h-9 w-full items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-white/8"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center text-sm text-[#8fa3ad]">
                        Nenhum emoji encontrado para a busca.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="custom-scrollbar max-h-[360px] overflow-y-auto px-4 py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {filteredGifs.map((gif) => (
                        <button
                          key={gif.id}
                          type="button"
                          onClick={() => void handleGifSend(gif.fileUrl, gif.title)}
                          className="overflow-hidden rounded-[22px] border border-white/8 bg-[#1a252c] text-left transition-colors hover:border-[#00a884]/40 hover:bg-[#213039]"
                        >
                          <img
                            src={gif.previewUrl}
                            alt={gif.title}
                            className="h-36 w-full object-cover"
                            loading="lazy"
                          />
                          <div className="px-3 py-3">
                            <p className="text-sm font-semibold text-white">{gif.title}</p>
                            <p className="mt-1 text-xs text-[#8fa3ad]">{gif.tags.join(" • ")}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {filteredGifs.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[#8fa3ad]">
                        Nenhum GIF encontrado para essa busca.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {composerOverlay ? (
              <div className="absolute bottom-[calc(100%+0.75rem)] left-3 right-3 z-30 overflow-hidden rounded-[26px] border border-white/10 bg-[#111b21] shadow-[0_24px_64px_rgba(0,0,0,0.42)] sm:left-auto sm:right-4 sm:w-[420px]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {composerOverlay === "contact"
                        ? "Enviar contato"
                        : composerOverlay === "poll"
                          ? "Criar enquete"
                          : composerOverlay === "event"
                            ? "Criar evento"
                            : "Nova figurinha"}
                    </p>
                    <p className="mt-1 text-xs text-[#8fa3ad]">
                      {composerOverlay === "contact"
                        ? "Compartilhe um contato do jeito que faria no WhatsApp."
                        : composerOverlay === "poll"
                          ? "Monte a pergunta e as opções da enquete."
                          : composerOverlay === "event"
                            ? "Envie um convite de calendário em formato compatível."
                            : "Escolha uma imagem para virar figurinha."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposerOverlay(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#aebac1] transition-colors hover:bg-white/8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {composerOverlay === "contact" ? (
                  <form onSubmit={handleContactSubmit} className="space-y-3 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={contactForm.firstName}
                        onChange={(event) =>
                          setContactForm((current) => ({ ...current, firstName: event.target.value }))
                        }
                        placeholder="Nome"
                        className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                      />
                      <input
                        value={contactForm.lastName}
                        onChange={(event) =>
                          setContactForm((current) => ({ ...current, lastName: event.target.value }))
                        }
                        placeholder="Sobrenome"
                        className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                      />
                    </div>
                    <input
                      value={contactForm.phoneNumber}
                      onChange={(event) =>
                        setContactForm((current) => ({ ...current, phoneNumber: event.target.value }))
                      }
                      placeholder="Telefone com DDD"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    <input
                      value={contactForm.company}
                      onChange={(event) =>
                        setContactForm((current) => ({ ...current, company: event.target.value }))
                      }
                      placeholder="Empresa ou observação"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    <button
                      type="submit"
                      disabled={attachmentLoading}
                      className="inline-flex min-h-11 items-center rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:opacity-60"
                    >
                      {attachmentLoading ? "Enviando..." : "Enviar contato"}
                    </button>
                  </form>
                ) : null}

                {composerOverlay === "poll" ? (
                  <form onSubmit={handlePollSubmit} className="space-y-3 px-4 py-4">
                    <input
                      value={pollForm.question}
                      onChange={(event) =>
                        setPollForm((current) => ({ ...current, question: event.target.value }))
                      }
                      placeholder="Pergunta da enquete"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    {pollForm.options.map((option, index) => (
                      <div key={`option-${index}`} className="flex items-center gap-2">
                        <input
                          value={option}
                          onChange={(event) =>
                            setPollForm((current) => ({
                              ...current,
                              options: current.options.map((currentOption, currentIndex) =>
                                currentIndex === index ? event.target.value : currentOption
                              ),
                            }))
                          }
                          placeholder={`Opção ${index + 1}`}
                          className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                        />
                        {pollForm.options.length > 2 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPollForm((current) => ({
                                ...current,
                                options: current.options.filter((_, currentIndex) => currentIndex !== index),
                              }))
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#fca5a5] transition-colors hover:bg-white/8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      {pollForm.options.length < 5 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPollForm((current) => ({
                              ...current,
                              options: [...current.options, ""],
                            }))
                          }
                          className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d0d7db] transition-colors hover:bg-white/8"
                        >
                          Adicionar opção
                        </button>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm text-[#d0d7db]">
                        <input
                          type="checkbox"
                          checked={pollForm.multipleAnswers}
                          onChange={(event) =>
                            setPollForm((current) => ({
                              ...current,
                              multipleAnswers: event.target.checked,
                            }))
                          }
                        />
                        Permitir múltiplas respostas
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={attachmentLoading}
                      className="inline-flex min-h-11 items-center rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:opacity-60"
                    >
                      {attachmentLoading ? "Enviando..." : "Enviar enquete"}
                    </button>
                  </form>
                ) : null}

                {composerOverlay === "event" ? (
                  <form onSubmit={handleEventSubmit} className="space-y-3 px-4 py-4">
                    <input
                      value={eventForm.title}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Título do evento"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="date"
                        value={eventForm.startDate}
                        onChange={(event) =>
                          setEventForm((current) => ({ ...current, startDate: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none"
                      />
                      <input
                        type="time"
                        value={eventForm.startTime}
                        onChange={(event) =>
                          setEventForm((current) => ({ ...current, startTime: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none"
                      />
                      <input
                        type="date"
                        value={eventForm.endDate}
                        onChange={(event) =>
                          setEventForm((current) => ({ ...current, endDate: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none"
                      />
                      <input
                        type="time"
                        value={eventForm.endTime}
                        onChange={(event) =>
                          setEventForm((current) => ({ ...current, endTime: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none"
                      />
                    </div>
                    <input
                      value={eventForm.location}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, location: event.target.value }))
                      }
                      placeholder="Local"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    <textarea
                      value={eventForm.description}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Descrição"
                      rows={3}
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-[#8fa3ad]"
                    />
                    <button
                      type="submit"
                      disabled={attachmentLoading}
                      className="inline-flex min-h-11 items-center rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:opacity-60"
                    >
                      {attachmentLoading ? "Enviando..." : "Enviar evento"}
                    </button>
                  </form>
                ) : null}

                {composerOverlay === "sticker" ? (
                  <div className="px-4 py-4">
                    <p className="text-sm leading-6 text-[#d0d7db]">
                      Escolha uma imagem e eu preparo uma figurinha em `webp` para envio.
                    </p>
                    <button
                      type="button"
                      onClick={() => triggerFilePicker("sticker")}
                      className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-[#041a14] transition-colors hover:bg-[#14c38e]"
                    >
                      Selecionar imagem
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <div className="flex min-h-14 flex-1 items-center rounded-[30px] bg-[#262827] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setComposerOverlay(null);
                    setIsEmojiPickerOpen(false);
                    setIsAttachmentMenuOpen((current) => !current);
                  }}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#d0d7db] transition-colors hover:bg-white/8"
                >
                  <Plus className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(false);
                    setComposerOverlay(null);
                    setIsEmojiPickerOpen((current) => !current);
                  }}
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#d0d7db] transition-colors hover:bg-white/8"
                >
                  <Smile className="h-5 w-5" />
                </button>

                {recording ? (
                  <div className="flex min-h-[36px] flex-1 items-center justify-between gap-3 px-2 text-sm text-white">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span>Gravando mensagem de voz</span>
                    </div>
                    <span className="font-mono text-[#7ef0a8]">{recordingTimeLabel}</span>
                  </div>
                ) : (
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Digite uma mensagem"
                    rows={1}
                    className="max-h-32 min-h-[36px] w-full resize-none bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-[#8696a0]"
                  />
                )}
              </div>

              {messageText.trim() ? (
                <button
                  type="submit"
                  disabled={sendingMessage || attachmentLoading || !messageText.trim()}
                  className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-5 w-5" />
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {recording ? (
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void (recording ? finishVoiceRecording() : startVoiceRecording())}
                    disabled={attachmentLoading}
                    className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {attachmentLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={(event) => {
                void handleSelectedFile("document", event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(event) => {
                void handleSelectedFile("media", event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void handleSelectedFile("camera", event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                void handleSelectedFile("audio", event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={stickerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleSelectedFile("sticker", event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </form>
        </>
      ) : (
        <div className="flex h-full min-h-0 flex-1 flex-col justify-between" style={conversationWallpaper}>
          <div className="border-b border-white/6 bg-[#202c33] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00a884]">
                  Painel conectado
                </p>
                <p className="mt-1 text-sm text-[#d0d7db]">{connectionLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadOverview(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#d0d7db] transition-colors hover:bg-white/8 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#d0d7db] transition-colors hover:bg-white/8"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="rounded-[30px] border border-white/8 bg-[#111b21]/80 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#103529] text-[#00d37f]">
                <MessageCircle className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">Selecione um chat</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#aebac1]">
                Toque em uma conversa na lateral para abrir o histórico, visualizar imagens,
                stickers e áudios e responder sem sair do painel.
              </p>
            </div>
          </div>

          <div className="border-t border-white/6 bg-[#111b21] px-5 py-3 text-xs text-[#7d8b92]">
            {lastUpdatedLabel ? `Última atualização às ${lastUpdatedLabel}` : "Sincronizando chats"}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div
      className={`flex min-h-0 flex-1 bg-[#eef3f7] ${
        embedded ? "h-full overflow-hidden p-0" : "overflow-y-auto p-3 sm:p-4 md:p-6"
      }`}
    >
      <div
        className={`flex w-full min-h-0 flex-col gap-4 ${
          embedded ? "h-full flex-1 overflow-hidden mx-0 max-w-none" : "mx-auto max-w-6xl"
        }`}
      >
        {statusNote ? (
          <div className="rounded-2xl border border-[#b7efc5] bg-[#effcf3] px-4 py-3 text-sm font-medium text-[#166534]">
            {statusNote}
          </div>
        ) : null}

        {showPanelSkeleton ? (
          <section
            className={`overflow-hidden rounded-[32px] border border-white/6 bg-[#0b141a] shadow-[0_32px_80px_rgba(6,18,23,0.28)] ${
              embedded ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
            style={connectedPanelStyle}
          >
            <div className="grid h-full min-h-0 xl:grid-cols-[410px_minmax(0,1fr)]">
              <aside className="flex h-full min-h-0 flex-col border-r border-white/6 bg-[#111b21]">
                <div className="flex-shrink-0 border-b border-white/6 px-5 py-5">
                  <div className="h-5 w-28 rounded-full bg-white/8" />
                  <div className="mt-3 h-9 w-44 rounded-full bg-white/10" />
                  <div className="mt-5 h-14 rounded-3xl bg-white/8" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-11 w-24 rounded-full bg-white/8" />
                    <div className="h-11 w-28 rounded-full bg-white/8" />
                    <div className="h-11 w-24 rounded-full bg-white/8" />
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-2">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-[22px] bg-white/6 px-3 py-3">
                      <div className="h-14 w-14 rounded-full bg-white/10" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-2/3 rounded-full bg-white/10" />
                        <div className="mt-2 h-3 w-full rounded-full bg-white/8" />
                        <div className="mt-2 h-3 w-1/2 rounded-full bg-white/8" />
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
              <section className="hidden h-full min-h-0 flex-col bg-[#0b141a] xl:flex">
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-[#d0d7db]">
                    <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                    <p className="text-sm font-medium">Validando a instância e carregando os chats...</p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        ) : connected ? (
          <section
            className={`overflow-hidden rounded-[32px] border border-white/6 bg-[#0b141a] shadow-[0_32px_80px_rgba(6,18,23,0.28)] ${
              embedded ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
            style={connectedPanelStyle}
          >
            <div className="grid h-full min-h-0 xl:grid-cols-[410px_minmax(0,1fr)]">
              {renderChatList()}
              {renderConversationPane()}
            </div>
          </section>
        ) : (
          <div
            className={`flex w-full flex-col gap-4 ${
              embedded
                ? "min-h-0 flex-1 overflow-hidden gap-3"
                : "lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] lg:items-stretch lg:gap-6"
            }`}
          >
            <section
              className={`rounded-[28px] border border-[#d7e2ea] bg-white shadow-sm ${
                embedded ? "p-4 sm:p-4" : "p-5 sm:p-6 lg:p-8"
              }`}
            >
              <span
                className={`inline-flex rounded-full bg-[#25D366]/10 px-3 py-1 font-semibold uppercase tracking-[0.22em] text-[#128C7E] ${
                  embedded ? "text-[10px]" : "text-[11px]"
                }`}
              >
                Conexão interna
              </span>
              <h2
                className={`mt-3 font-bold leading-tight text-[#0c1826] ${
                  embedded ? "text-xl sm:text-[22px]" : "text-2xl sm:text-3xl"
                }`}
              >
                Conecte o WhatsApp sem sair do painel
              </h2>
              <p
                className={`mt-2 max-w-2xl text-[#516072] ${
                  embedded ? "text-xs leading-5 sm:text-[13px]" : "text-sm leading-6 sm:text-base"
                }`}
              >
                A tela acompanha a conexão em tempo real. Assim que a instância ficar autorizada e
                online, o QR desaparece e os chats em andamento assumem o lugar automaticamente.
              </p>

              <div
                className={`rounded-2xl border border-[#dce6ed] bg-[#f8fbfd] ${
                  embedded ? "mt-4 p-3" : "mt-5 p-4"
                }`}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={`mt-0.5 flex-shrink-0 text-[#128C7E] ${
                      embedded ? "h-4 w-4" : "h-5 w-5"
                    }`}
                  />
                  <p className={`${embedded ? "text-xs leading-5" : "text-sm leading-6"} text-[#334155]`}>
                    Status atual da instância: <strong>{connectionLabel}</strong>.
                  </p>
                </div>
              </div>

              {embedded ? (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { title: "Abra", text: "Dispositivos conectados" },
                    { title: "Leia", text: "Aponte para o QR" },
                    { title: "Entre", text: "O chat assume sozinho" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[#dce6ed] bg-[#f7fafc] px-2 py-2.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a8ea3]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#334155]">{item.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#dce6ed] bg-[#f7fafc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8ea3]">
                      1. Abra o app
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#334155]">
                      Entre no WhatsApp do celular e abra o menu de dispositivos conectados.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#dce6ed] bg-[#f7fafc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8ea3]">
                      2. Leia o QR
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#334155]">
                      Mire a câmera no código. A checagem de conexão acontece sozinha a cada poucos
                      segundos.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#dce6ed] bg-[#f7fafc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8ea3]">
                      3. Continue no painel
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#334155]">
                      Depois da leitura, a tela troca automaticamente para a lista de conversas.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <aside
              className={`rounded-[28px] border border-[#d7e2ea] bg-white shadow-sm ${
                embedded ? "flex min-h-0 flex-1 flex-col p-4 sm:p-4" : "p-5 sm:p-6 lg:p-7"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a8ea3]">
                    QR Code
                  </p>
                  <h3 className={`mt-1 font-semibold text-[#0c1826] ${embedded ? "text-base" : "text-lg"}`}>
                    Leia com o celular
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOverview(true)}
                  disabled={refreshing}
                  className={`inline-flex items-center gap-2 rounded-full border border-[#d5e3db] bg-[#f4fbf7] font-semibold text-[#128C7E] transition-colors hover:bg-[#e8f8ee] disabled:cursor-not-allowed disabled:opacity-70 ${
                    embedded ? "min-h-9 px-3 py-1.5 text-xs" : "min-h-11 px-4 py-2 text-sm"
                  }`}
                >
                  <RefreshCw className={`${embedded ? "h-3.5 w-3.5" : "h-4 w-4"} ${refreshing ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>

              <div
                className={`rounded-[24px] border border-dashed border-[#cfe0d5] bg-[#f7fbf8] ${
                  embedded ? "mt-3 flex min-h-0 flex-1 flex-col p-3" : "mt-5 p-4 sm:p-5"
                }`}
              >
                {loading ? (
                  <div className={`flex flex-col items-center justify-center gap-3 text-center text-[#516072] ${embedded ? "min-h-0 flex-1" : "min-h-[300px]"}`}>
                    <Loader2 className={`${embedded ? "h-7 w-7" : "h-9 w-9"} animate-spin text-[#128C7E]`} />
                    <p className={`${embedded ? "text-xs" : "text-sm"} font-medium`}>
                      Verificando a conexão do WhatsApp...
                    </p>
                  </div>
                ) : error ? (
                  <div className={`flex flex-col items-center justify-center gap-3 text-center ${embedded ? "min-h-0 flex-1" : "min-h-[300px]"}`}>
                    <div className={`rounded-full bg-red-50 text-red-500 ${embedded ? "p-2.5" : "p-3"}`}>
                      <Smartphone className={`${embedded ? "h-6 w-6" : "h-7 w-7"}`} />
                    </div>
                    <div className="space-y-2">
                      <p className={`${embedded ? "text-xs" : "text-sm"} font-semibold text-[#0c1826]`}>
                        Não foi possível validar a conexão
                      </p>
                      <p className={`${embedded ? "text-xs leading-5" : "text-sm leading-6"} text-[#64748b]`}>
                        {error}
                      </p>
                    </div>
                  </div>
                ) : qrCode ? (
                  <div className={`flex flex-col items-center ${embedded ? "min-h-0 flex-1 justify-center gap-3" : "gap-4"}`}>
                    <img
                      src={qrCode}
                      alt="QR Code do WhatsApp"
                      className={`h-auto w-full rounded-[22px] bg-white shadow-sm ${
                        embedded ? "max-w-[220px] p-2.5" : "max-w-[320px] p-3"
                      }`}
                    />
                    <div className={`w-full rounded-2xl bg-white text-center shadow-sm ${embedded ? "px-3 py-2.5" : "px-4 py-3"}`}>
                      <p className={`${embedded ? "text-xs" : "text-sm"} font-medium text-[#0c1826]`}>
                        Escaneie com o WhatsApp do aparelho que será conectado.
                      </p>
                      {lastUpdatedLabel ? (
                        <p className={`mt-1 text-[#64748b] ${embedded ? "text-[11px]" : "text-xs"}`}>
                          Última atualização às {lastUpdatedLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col items-center justify-center gap-3 text-center ${embedded ? "min-h-0 flex-1" : "min-h-[300px]"}`}>
                    <Smartphone className={`${embedded ? "h-7 w-7" : "h-9 w-9"} text-[#128C7E]`} />
                    <p className={`${embedded ? "text-xs leading-5" : "text-sm leading-6"} text-[#64748b]`}>
                      O QR Code ainda não está disponível. A tela segue verificando automaticamente.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};
