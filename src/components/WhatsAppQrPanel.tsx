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
  RefreshCw,
  Search,
  SendHorizontal,
  Smartphone,
} from "lucide-react";

const CONNECTED_OVERVIEW_REFRESH_MS = 4000;
const DISCONNECTED_OVERVIEW_REFRESH_MS = 5000;
const SELECTED_CHAT_REFRESH_MS = 4000;

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
  error?: string;
};

interface WhatsAppQrPanelProps {
  onConnectionChange?: (connected: boolean) => void;
}

export const WhatsAppQrPanel: React.FC<WhatsAppQrPanelProps> = ({
  onConnectionChange,
}) => {
  const requestInFlightRef = useRef(false);
  const historyInFlightRef = useRef(false);
  const avatarInFlightRef = useRef(new Set<string>());
  const avatarCacheRef = useRef<Record<string, string | null>>({});
  const readTimestampsRef = useRef<Record<string, number>>({});
  const [qrCode, setQrCode] = useState("");
  const [chats, setChats] = useState<WhatsAppChatItem[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [connected, setConnected] = useState(false);
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

  const sortChatsByTimestamp = (items: WhatsAppChatItem[]) =>
    [...items].sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));

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

      setConnected(nextConnected);
      onConnectionChange?.(nextConnected);
      setStateInstance(data.stateInstance || "");
      setStatusInstance(data.statusInstance || "");
      setQrCode(data.qrCode || "");
      const nextChats = Array.isArray(data.chats) ? data.chats : [];
      setChats((currentChats) => reconcileOverviewChats(currentChats, nextChats));
      setFetchedAt(data.fetchedAt || "");
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

  useEffect(() => {
    void loadOverview();
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
  const hasSelectedChat = Boolean(selectedChat);
  const showPanelSkeleton = loading && chats.length === 0 && !qrCode && !error && !fetchedAt;
  const connectedPanelStyle = {
    height: "min(960px, calc(100dvh - 8rem))",
  } as const;
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

    return sortChatsByTimestamp(
      chats.filter((chat) => {
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
  }, [activeFilter, chats, searchTerm]);
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
                {messages.map((message) => {
                  const isOutgoing = message.direction === "outgoing";
                  const timeLabel = new Date(message.timestamp * 1000).toLocaleTimeString(
                    "pt-BR",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <div
                      key={message.idMessage}
                      className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
                    >
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
            className="border-t border-white/6 bg-[#202c33] px-3 py-3 sm:px-4"
          >
            <div className="flex items-end gap-2">
              <div className="flex min-h-14 flex-1 items-end rounded-[28px] bg-[#2a3942] px-4 py-2">
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Digite uma mensagem"
                  rows={1}
                  className="max-h-32 min-h-[36px] w-full resize-none bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-[#8696a0]"
                />
              </div>
              <button
                type="submit"
                disabled={sendingMessage || !messageText.trim()}
                className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#041a14] transition-colors hover:bg-[#14c38e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingMessage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SendHorizontal className="h-5 w-5" />
                )}
              </button>
            </div>
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
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-[#eef3f7] p-3 sm:p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-col gap-4">
        {statusNote ? (
          <div className="rounded-2xl border border-[#b7efc5] bg-[#effcf3] px-4 py-3 text-sm font-medium text-[#166534]">
            {statusNote}
          </div>
        ) : null}

        {showPanelSkeleton ? (
          <section
            className="overflow-hidden rounded-[32px] border border-white/6 bg-[#0b141a] shadow-[0_32px_80px_rgba(6,18,23,0.28)]"
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
            className="overflow-hidden rounded-[32px] border border-white/6 bg-[#0b141a] shadow-[0_32px_80px_rgba(6,18,23,0.28)]"
            style={connectedPanelStyle}
          >
            <div className="grid h-full min-h-0 xl:grid-cols-[410px_minmax(0,1fr)]">
              {renderChatList()}
              {renderConversationPane()}
            </div>
          </section>
        ) : (
          <div className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] lg:items-stretch lg:gap-6">
            <section className="rounded-[28px] border border-[#d7e2ea] bg-white p-5 shadow-sm sm:p-6 lg:p-8">
              <span className="inline-flex rounded-full bg-[#25D366]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#128C7E]">
                Conexão interna
              </span>
              <h2 className="mt-4 text-2xl font-bold leading-tight text-[#0c1826] sm:text-3xl">
                Conecte o WhatsApp sem sair do painel
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#516072] sm:text-base">
                A tela acompanha a conexão em tempo real. Assim que a instância ficar autorizada e
                online, o QR desaparece e os chats em andamento assumem o lugar automaticamente.
              </p>

              <div className="mt-5 rounded-2xl border border-[#dce6ed] bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#128C7E]" />
                  <p className="text-sm leading-6 text-[#334155]">
                    Status atual da instância: <strong>{connectionLabel}</strong>.
                  </p>
                </div>
              </div>

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
            </section>

            <aside className="rounded-[28px] border border-[#d7e2ea] bg-white p-5 shadow-sm sm:p-6 lg:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a8ea3]">
                    QR Code
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[#0c1826]">
                    Leia com o celular
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOverview(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d5e3db] bg-[#f4fbf7] px-4 py-2 text-sm font-semibold text-[#128C7E] transition-colors hover:bg-[#e8f8ee] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              </div>

              <div className="mt-5 rounded-[24px] border border-dashed border-[#cfe0d5] bg-[#f7fbf8] p-4 sm:p-5">
                {loading ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center text-[#516072]">
                    <Loader2 className="h-9 w-9 animate-spin text-[#128C7E]" />
                    <p className="text-sm font-medium">Verificando a conexão do WhatsApp...</p>
                  </div>
                ) : error ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
                    <div className="rounded-full bg-red-50 p-3 text-red-500">
                      <Smartphone className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#0c1826]">
                        Não foi possível validar a conexão
                      </p>
                      <p className="text-sm leading-6 text-[#64748b]">{error}</p>
                    </div>
                  </div>
                ) : qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <img
                      src={qrCode}
                      alt="QR Code do WhatsApp"
                      className="h-auto w-full max-w-[320px] rounded-[22px] bg-white p-3 shadow-sm"
                    />
                    <div className="w-full rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                      <p className="text-sm font-medium text-[#0c1826]">
                        Escaneie com o WhatsApp do aparelho que será conectado.
                      </p>
                      {lastUpdatedLabel ? (
                        <p className="mt-1 text-xs text-[#64748b]">
                          Última atualização às {lastUpdatedLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
                    <Smartphone className="h-9 w-9 text-[#128C7E]" />
                    <p className="text-sm leading-6 text-[#64748b]">
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
