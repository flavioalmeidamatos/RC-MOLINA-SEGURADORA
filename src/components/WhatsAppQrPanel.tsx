import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

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

export const WhatsAppQrPanel: React.FC = () => {
  const requestInFlightRef = useRef(false);
  const [qrCode, setQrCode] = useState("");
  const [chats, setChats] = useState<WhatsAppChatItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [stateInstance, setStateInstance] = useState("");
  const [statusInstance, setStatusInstance] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");

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
        throw new Error(data.error || "Nao foi possivel carregar o painel do WhatsApp.");
      }

      const nextConnected = Boolean(data.connected);

      if (nextConnected && !connected) {
        setStatusNote("WhatsApp conectado com sucesso. Conversas carregadas.");
      }

      setConnected(nextConnected);
      setStateInstance(data.stateInstance || "");
      setStatusInstance(data.statusInstance || "");
      setQrCode(data.qrCode || "");
      setChats(Array.isArray(data.chats) ? data.chats : []);
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
    const refreshInterval = connected ? 15000 : 5000;
    const intervalId = window.setInterval(() => {
      void loadOverview(true);
    }, refreshInterval);

    return () => window.clearInterval(intervalId);
  }, [connected]);

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

    return "Aguardando autenticacao";
  }, [connected, stateInstance, statusInstance]);
  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex flex-1 overflow-y-auto bg-[#eef3f7] p-4 sm:p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {statusNote ? (
          <div className="rounded-2xl border border-[#b7efc5] bg-[#effcf3] px-4 py-3 text-sm font-medium text-[#166534]">
            {statusNote}
          </div>
        ) : null}

        {connected ? (
          <section className="rounded-[28px] border border-[#d7e2ea] bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-[#25D366]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#128C7E]">
                  WhatsApp conectado
                </span>
                <h2 className="mt-4 text-2xl font-bold leading-tight text-[#0c1826] sm:text-3xl">
                  Conversas em andamento
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#516072] sm:text-base">
                  A conexao foi validada com sucesso. A tela de autenticacao foi substituida pela
                  lista dos chats mais recentes da instancia.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d5e3db] bg-[#f4fbf7] px-4 py-2 text-sm font-semibold text-[#128C7E]">
                  <ShieldCheck className="h-4 w-4" />
                  {connectionLabel}
                </div>
                <button
                  type="button"
                  onClick={() => void loadOverview(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d5e3db] bg-[#f4fbf7] px-4 py-2 text-sm font-semibold text-[#128C7E] transition-colors hover:bg-[#e8f8ee] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Atualizar chats
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {loading && chats.length === 0 ? (
                <div className="col-span-full flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-[#d7e2ea] bg-[#f8fbfd] text-center text-[#516072]">
                  <Loader2 className="h-9 w-9 animate-spin text-[#128C7E]" />
                  <p className="text-sm font-medium">Carregando os chats em andamento...</p>
                </div>
              ) : chats.length > 0 ? (
                chats.map((chat) => (
                  <article
                    key={chat.chatId}
                    className="rounded-[24px] border border-[#dce6ed] bg-[#f8fbfd] p-4 shadow-sm transition-colors hover:border-[#c8d9e3] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#0c1826]">
                          {chat.title}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7a8ea3]">
                          {chat.isGroup ? "Grupo" : "Contato"} • {chat.subtitle}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-[#64748b]">
                        {formatTimestamp(chat.timestamp)}
                      </span>
                    </div>

                    <div className="mt-4 flex items-start gap-3">
                      <div className="rounded-full bg-white p-2 text-[#128C7E] shadow-sm">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-3 text-sm leading-6 text-[#334155]">
                          {chat.preview}
                        </p>
                        <p className="mt-3 text-xs text-[#7a8ea3]">
                          {chat.direction === "outgoing" ? "Saida" : "Entrada"} • {chat.typeMessage}
                          {chat.statusMessage ? ` • ${chat.statusMessage}` : ""}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="col-span-full flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-[#d7e2ea] bg-[#f8fbfd] text-center">
                  <MessageCircle className="h-9 w-9 text-[#128C7E]" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#0c1826]">
                      Nenhum chat recente encontrado
                    </p>
                    <p className="text-sm leading-6 text-[#64748b]">
                      Assim que houver conversas recentes na instancia, elas aparecem aqui
                      automaticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {lastUpdatedLabel ? (
              <p className="mt-4 text-right text-xs text-[#7a8ea3]">
                Ultima atualizacao as {lastUpdatedLabel}
              </p>
            ) : null}
          </section>
        ) : (
          <div className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] lg:items-stretch lg:gap-6">
            <section className="rounded-[28px] border border-[#d7e2ea] bg-white p-5 shadow-sm sm:p-6 lg:p-8">
              <span className="inline-flex rounded-full bg-[#25D366]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#128C7E]">
                Conexao interna
              </span>
              <h2 className="mt-4 text-2xl font-bold leading-tight text-[#0c1826] sm:text-3xl">
                Conecte o WhatsApp sem sair do painel
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#516072] sm:text-base">
                A tela acompanha a conexao em tempo real. Assim que a instancia ficar autorizada e
                online, o QR desaparece e os chats em andamento assumem o lugar automaticamente.
              </p>

              <div className="mt-5 rounded-2xl border border-[#dce6ed] bg-[#f8fbfd] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#128C7E]" />
                  <p className="text-sm leading-6 text-[#334155]">
                    Status atual da instancia: <strong>{connectionLabel}</strong>.
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
                    Mire a camera no codigo. A checagem de conexao acontece sozinha a cada poucos
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
                    <p className="text-sm font-medium">Verificando a conexao do WhatsApp...</p>
                  </div>
                ) : error ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
                    <div className="rounded-full bg-red-50 p-3 text-red-500">
                      <Smartphone className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[#0c1826]">
                        Nao foi possivel validar a conexao
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
                        Escaneie com o WhatsApp do aparelho que sera conectado.
                      </p>
                      {lastUpdatedLabel ? (
                        <p className="mt-1 text-xs text-[#64748b]">
                          Ultima atualizacao as {lastUpdatedLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
                    <Smartphone className="h-9 w-9 text-[#128C7E]" />
                    <p className="text-sm leading-6 text-[#64748b]">
                      O QR Code ainda nao esta disponivel. A tela segue verificando automaticamente.
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
