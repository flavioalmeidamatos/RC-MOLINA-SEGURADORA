import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Banknote,
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Info,
  Lightbulb,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClientRegistrationMultipage } from "../clientes/client_registration_multipage";
import { SistemaQuerImportModal, type SistemaQuerLeadData } from "./sistema_quer_import_modal";
import { Agenda } from "../agenda/agenda";

interface DashboardProps {
  session?: any;
  perfil?: any;
  onLogout?: () => void;
}

type SimulatorMode = "idle" | "loading" | "embedded" | "external";

const SIMULATOR_LOGIN_URL = "https://app.simuladoronline.com/login/4602";
const SIMULATOR_LOGOUT_URL = "https://app.simuladoronline.com/logout";
const SIMULATOR_FALLBACK_WINDOW_NAME = "simulador_online_fallback_window";
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32C100.5 32 .4 132.3 .4 256c0 39.5 10.3 78.1 29.6 112.2L0 480l114.7-30.1c33.5 18.3 71.4 27.9 109.2 27.9h.1c123.3 0 223.9-100.4 223.9-224c0-59.3-25.5-115-67-156.7zm-157 341.5h-.1c-33.4 0-66.1-8.9-94.7-25.7l-6.8-4l-68.1 17.9l18.2-66.3l-4.4-6.9c-18-28.7-27.5-61.9-27.5-96.1c0-98.3 80-178.3 178.4-178.3c47.7 0 92.5 18.5 126.2 52.3c33.7 33.7 52.2 78.5 52.2 126.3c-.1 98.3-80.1 178.3-178.4 178.3zm101.7-138.2c-5.5-2.8-32.8-16.1-37.9-18c-5.1-1.9-8.8-2.8-12.5 2.8c-3.7 5.6-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4c-32.6-16.3-54-29.1-75.5-66c-5.7-9.8 5.7-9.1 16.3-30.3c1.8-3.7 .9-6.9-.5-9.7c-1.4-2.8-12.5-30.1-17.1-41.3c-4.5-10.8-9.1-9.3-12.5-9.5c-3.2-.2-6.9-.2-10.6-.2c-3.7 0-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3c0 27.3 19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.8 94.8 83.8c35.2 15.2 49 16.5 66.6 13.9c10.7-1.6 32.8-13.4 37.4-26.4c4.6-13 4.6-24.1 3.2-26.4c-1.3-2.4-5-3.8-10.5-6.6z" />
  </svg>
);

export const SCR_MENUPRINCIPAL: React.FC<DashboardProps> = ({
  session,
  perfil,
  onLogout,
}) => {
  const navigate = useNavigate();
  const userName =
    perfil?.nome_completo ||
    session?.user?.email?.split("@")[0] ||
    "Nome do Usuário";
  const avatarUrl = perfil?.avatar_url || null;

  const [activeMenu, setActiveMenu] = useState("Home");
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [simulatorMode, setSimulatorMode] = useState<SimulatorMode>("idle");
  const [simulatorFrameKey, setSimulatorFrameKey] = useState(0);
  const [simulatorStatusMessage, setSimulatorStatusMessage] = useState("");
  const [simulatorAutoOpenedExternally, setSimulatorAutoOpenedExternally] = useState(false);

  const simulatorTimeoutRef = useRef<number | null>(null);
  const simulatorWindowRef = useRef<Window | null>(null);
  const simulatorIframeLoadedRef = useRef(false);

  const [credential, setCredential] = useState({
    login: "Rosilene Rodrigues de Carvalho Molina",
    senha: "123",
    leadUrl: "",
  });
  const [pendingImportedLead, setPendingImportedLead] = useState<SistemaQuerLeadData | null>(null);
  const clearPendingImportedLead = useCallback(() => setPendingImportedLead(null), []);
  const clearSimulatorTimeout = () => {
    if (simulatorTimeoutRef.current !== null) {
      window.clearTimeout(simulatorTimeoutRef.current);
      simulatorTimeoutRef.current = null;
    }
  };

  const writeFallbackWindowLoadingContent = (popup: Window) => {
    try {
      popup.document.title = "Simulador";
      popup.document.body.innerHTML = `
        <div style="font-family:sans-serif;font-size:12px;padding:5px;">
           Preparando...
        </div>
      `;
    } catch (_error) {
      // Ignora falha de escrita na janela.
    }
  };

  const reserveSimulatorFallbackWindow = () => {
    try {
      // Abre a janela de fallback no menor tamanho possível e fora da tela principal (oculta)
      const popup = window.open(
        "",
        SIMULATOR_FALLBACK_WINDOW_NAME,
        "width=100,height=100,left=-9999,top=-9999,resizable=yes,scrollbars=yes"
      );

      if (popup) {
        writeFallbackWindowLoadingContent(popup);
        
        // Tenta jogar a janela de preparação para o fundo, mantendo o foco na aplicação principal
        try {
          popup.blur();
          window.focus();
        } catch (_blurError) {}

        simulatorWindowRef.current = popup;
      }
    } catch (_error) {
      simulatorWindowRef.current = null;
    }
  };

  const closeReservedSimulatorWindowIfStillIdle = () => {
    const popup = simulatorWindowRef.current;
    if (!popup || popup.closed) {
      simulatorWindowRef.current = null;
      return;
    }

    try {
      if (popup.location.href === "about:blank") {
        popup.close();
      }
    } catch (_error) {
      // Se já navegou para domínio externo, não força fechamento aqui.
    }
  };

  const openSimulatorExternally = () => {
    const popup = simulatorWindowRef.current;

    setSimulatorMode("external");
    setSimulatorAutoOpenedExternally(true);
    setSimulatorStatusMessage(
      "O navegador não estabilizou o simulador incorporado a tempo. O sistema foi aberto automaticamente em uma nova janela."
    );

    try {
      if (popup && !popup.closed) {
        // Restaura as dimensões caso tenha vindo do fallback oculto
        try {
          popup.resizeTo(1280, 900);
          popup.moveTo(
            Math.max(0, (window.screen.width - 1280) / 2),
            Math.max(0, (window.screen.height - 900) / 2)
          );
        } catch (_resizeError) {}

        popup.location.href = SIMULATOR_LOGIN_URL;
        popup.focus();
        return;
      }
    } catch (_error) {
      // Se falhar, abre nova aba/janela normalmente.
    }

    const newWindow = window.open(
      SIMULATOR_LOGIN_URL,
      SIMULATOR_FALLBACK_WINDOW_NAME,
      "width=1280,height=900,resizable=yes,scrollbars=yes"
    );

    if (!newWindow) {
      window.location.href = SIMULATOR_LOGIN_URL;
    } else {
      simulatorWindowRef.current = newWindow;
      newWindow.focus();
    }
  };

  const startSimulatorAttempt = () => {
    simulatorIframeLoadedRef.current = false;
    setSimulatorAutoOpenedExternally(false);
    setSimulatorStatusMessage("Tentando carregar o simulador dentro da aplicação...");
    setSimulatorMode("loading");
    setActiveMenu("Simulador");
    setSimulatorFrameKey((prev) => prev + 1);

    clearSimulatorTimeout();
  };

  const enterSimulator = () => {
    reserveSimulatorFallbackWindow();
    startSimulatorAttempt();
  };

  const retrySimulatorInsideApp = () => {
    reserveSimulatorFallbackWindow();
    startSimulatorAttempt();
  };

  const handleSimulatorIframeLoad = () => {
    if (simulatorMode === "external") {
      return;
    }

    simulatorIframeLoadedRef.current = true;
    clearSimulatorTimeout();
    setSimulatorMode("embedded");
    setSimulatorStatusMessage("Simulador carregado dentro da aplicação.");
    setSimulatorAutoOpenedExternally(false);
    closeReservedSimulatorWindowIfStillIdle();
  };

  const handleSimulatorIframeError = () => {
    clearSimulatorTimeout();
    openSimulatorExternally();
  };

  const cleanupSimulatorUi = () => {
    clearSimulatorTimeout();
    simulatorIframeLoadedRef.current = false;
    setSimulatorMode("idle");
    setSimulatorStatusMessage("");
    setSimulatorAutoOpenedExternally(false);
  };

  const clearLocalUiState = () => {
    cleanupSimulatorUi();
  };

  const logoutRemoteSimulator = async () => {
    clearSimulatorTimeout();

    const popup = simulatorWindowRef.current;

    if (popup && !popup.closed) {
      try {
        popup.location.href = SIMULATOR_LOGOUT_URL;
        await wait(1600);
        try {
          popup.close();
        } catch (_error) {
          // sem ação
        }
        simulatorWindowRef.current = null;
        return;
      } catch (_error) {
        // segue para fallback
      }
    }

    try {
      const logoutWindow = window.open(
        SIMULATOR_LOGOUT_URL,
        "simulador_online_logout_window",
        "width=100,height=100,left=-9999,top=-9999,resizable=yes,scrollbars=yes"
      );

      if (logoutWindow) {
        try {
          logoutWindow.blur();
          window.focus();
        } catch (_blurError) {}

        await wait(1600);
        try {
          logoutWindow.close();
        } catch (_error) {
          // sem ação
        }
        return;
      }
    } catch (_error) {
      // segue para fallback
    }

    // Último fallback: iframe oculto.
    try {
      const logoutIframe = document.createElement("iframe");
      logoutIframe.style.display = "none";
      logoutIframe.src = SIMULATOR_LOGOUT_URL;
      document.body.appendChild(logoutIframe);
      await wait(1500);
      document.body.removeChild(logoutIframe);
    } catch (_error) {
      console.warn("Não foi possível deslogar do simulador automaticamente.");
    }
  };

  useEffect(() => {
    return () => {
      clearSimulatorTimeout();
      closeReservedSimulatorWindowIfStillIdle();
    };
  }, []);


  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      // Executa todas as tarefas de limpeza em paralelo para reduzir o tempo total de espera.
      // A lentidão anterior era causada pela execução sequencial (um após o outro).
      await logoutRemoteSimulator();

      clearLocalUiState();
      onLogout?.();
      navigate("/login", { replace: true });
    } catch (_error) {
      clearLocalUiState();
      onLogout?.();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMenuClick = (title: string) => {
    if (title === "Simulador") {
      enterSimulator();
      return;
    }

    if (activeMenu === "Simulador") {
      cleanupSimulatorUi();
    }

    setActiveMenu(title);
  };

  const handleCardClick = (line1: string, line2: string) => {
    if (line1 === "Simulador") {
      enterSimulator();
      return;
    }

    if (line1 === "Meus" && line2 === "clientes") {
      if (activeMenu === "Simulador") {
        cleanupSimulatorUi();
      }
      setActiveMenu("Meus clientes");
      return;
    }

    if (line1 === "Agenda") {
      setActiveMenu("Agenda");
      return;
    }
  };

  const menuItems = [
    { title: "Home", icon: Home },
    { title: "Meus clientes", icon: Briefcase },
    { title: "Agenda", icon: Calendar },
    { title: "Simulador", icon: FolderOpen },
    { title: "Webmail", icon: Mail },
    { title: "Financeiro", icon: Banknote },
    { title: "Configurações", icon: Wrench },
  ];

  const cards = [
    { line1: "Sugestões", line2: "", icon: Lightbulb },
    { line1: "Meus", line2: "clientes", icon: Briefcase },
    { line1: "Agenda", line2: "", icon: Calendar },
    { line1: "Simulador", line2: "", icon: FolderOpen },
    { line1: "Financeiro", line2: "", icon: Banknote },
    { line1: "Configurar", line2: "", icon: Wrench },
  ];

  const agendaItems = [
    {
      name: "Ana cristina",
      phone: "24998366001",
      time: "14:00",
      status: "ligarei novamente",
      highlight: true,
    },
  ];

  const showSimulator = activeMenu === "Simulador";
  const showClientArea = activeMenu === "Meus clientes";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F0F4F8] font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="w-full flex-shrink-0 bg-[#0c1826] shadow-xl lg:w-64 lg:z-20">
        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[#b58c2a] to-[#806117] px-4 py-6 shadow-inner lg:h-44 lg:pt-4 lg:pb-2">
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/50 bg-white shadow-md transition-all hover:border-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User size={32} className="text-gray-400" />
            )}
          </div>
          <span className="px-4 text-center text-sm font-medium text-white">{userName}</span>
        </div>

        <div className="custom-scrollbar flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-0 lg:overflow-y-auto lg:px-0 lg:py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.title;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => handleMenuClick(item.title)}
                className={`flex min-w-max items-center justify-between gap-3 rounded-2xl border-l-4 px-4 py-3 text-left transition-colors lg:w-full lg:rounded-none lg:px-6 ${
                  isActive
                    ? "border-[#b58c2a] bg-[#152a42] text-white"
                    : "border-transparent text-gray-400 hover:bg-[#112338] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? "text-[#b58c2a]" : "text-gray-500"} />
                  <span className="text-sm">{item.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col relative">
        <header className="flex flex-col gap-4 bg-white px-4 py-4 shadow-sm sm:px-6 md:px-8 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col items-start bg-white px-2 py-1">
              <div className="text-xl font-bold leading-none tracking-widest text-[#d4af37]">
                RC MOLINA
              </div>
              <div className="mt-1 text-center text-[10px] font-bold tracking-[0.3em] text-[#0c1826]">
                SEGUROS
              </div>
            </div>

            <span className="border-l border-gray-200 pl-4 text-sm text-gray-400">
              {activeMenu === "Home" ? "Painel Administrativo" : activeMenu}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              aria-label="WhatsApp"
              className="flex min-h-11 items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-4 py-2 text-[#128C7E]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">WhatsApp</span>
            </button>

            <button 
              onClick={() => handleMenuClick("Agenda")}
              className={`flex min-h-11 items-center gap-2 transition-colors hover:text-[#b58c2a] ${activeMenu === "Agenda" ? "text-[#b58c2a]" : "text-gray-500"}`}
            >
              <Calendar size={18} />
              <span className="text-sm">Agenda</span>
            </button>

            <div className="hidden h-8 w-px bg-gray-200 sm:block" />

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={16} className="text-gray-400" />
                )}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 md:inline">
                {userName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex min-h-11 items-center gap-2 text-gray-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              <span className="text-sm">{isLoggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden transition-all duration-300">
          <div className="flex min-w-0 flex-1 flex-col">
            {showSimulator ? (
              <div
                className="flex flex-1 flex-col bg-white"
                style={{ height: "calc(100vh - 120px)" }}
              >
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <FolderOpen size={14} />
                    {simulatorMode === "embedded"
                      ? "Simulador Online em execução"
                      : simulatorMode === "loading"
                        ? "Tentando carregar o Simulador Online"
                        : simulatorMode === "external"
                          ? "Simulador Online aberto externamente"
                          : "Simulador Online"}
                  </span>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        cleanupSimulatorUi();
                        setActiveMenu("Home");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      Voltar ao dashboard
                    </button>

                    <button
                      type="button"
                      onClick={retrySimulatorInsideApp}
                      className="font-medium text-[#b58c2a] hover:underline"
                    >
                      Tentar novamente aqui
                    </button>

                    <button
                      type="button"
                      onClick={openSimulatorExternally}
                      className="flex items-center gap-1 font-medium text-[#b58c2a] hover:underline"
                    >
                      Abrir em nova janela <ExternalLink size={12} />
                    </button>
                  </div>
                </div>

                {simulatorMode === "loading" || simulatorMode === "embedded" ? (
                  <div className="relative w-full flex-1 overflow-hidden bg-gray-100">
                    {simulatorMode === "loading" ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-[1px]">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#b58c2a] border-t-transparent" />
                        <div className="max-w-md px-6 text-center text-sm text-gray-600">
                          {simulatorStatusMessage ||
                            "Tentando abrir o simulador dentro da aplicação..."}
                        </div>
                      </div>
                    ) : null}

                    <iframe
                      key={simulatorFrameKey}
                      src={SIMULATOR_LOGIN_URL}
                      title="Simulador Online"
                      className="h-full w-full border-none shadow-inner"
                      style={{
                        minHeight: "800px",
                        height: "100%",
                        width: "100%",
                        display: "block",
                        position: "relative",
                        zIndex: 10,
                      }}
                      allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
                      allowFullScreen
                      onLoad={handleSimulatorIframeLoad}
                      onError={handleSimulatorIframeError}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-6">
                    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
                      <div className="h-2 bg-gradient-to-r from-[#b58c2a] to-[#d4af37]" />
                      
                      <div className="p-10 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#b58c2a]/10 text-[#b58c2a] ring-8 ring-[#b58c2a]/5">
                          <ExternalLink size={44} strokeWidth={1.5} />
                        </div>

                        <h3 className="mb-4 text-2xl font-black tracking-tight text-[#0c1826]">
                          Simulador Ativo em Janela Externa
                        </h3>
                        
                        <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-gray-600">
                          {simulatorStatusMessage ||
                            "O Simulador Online implementou novas políticas de segurança que impedem sua visualização dentro de iframes."}
                        </p>

                        <div className="mb-10 rounded-2xl border border-amber-100 bg-amber-50/50 p-6 text-left">
                          <div className="flex gap-3">
                            <Info className="mt-0.5 flex-shrink-0 text-amber-600" size={18} />
                            <div className="space-y-2 text-sm text-amber-900">
                              <p className="font-semibold">Por que isso aconteceu?</p>
                              <p className="opacity-80">
                                Navegadores modernos como Firefox e Chrome bloqueiam sites que possuem a política 
                                <code className="mx-1 rounded bg-amber-100 px-1 font-mono text-xs">X-Frame-Options: DENY</code>. 
                                Isso garante que seus dados de login no simulador fiquem protegidos contra ataques de sequestro de clique.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                          <button
                            type="button"
                            onClick={openSimulatorExternally}
                            className="group flex items-center gap-3 rounded-xl bg-[#0c1826] px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-[#152a42] active:scale-95"
                          >
                            <span>Abrir Simulador Agora</span>
                            <ExternalLink size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={retrySimulatorInsideApp}
                            className="rounded-xl border border-gray-200 px-8 py-4 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                          >
                            Tentar incorporar (Legacy)
                          </button>
                        </div>
                        
                        <p className="mt-8 text-xs font-medium text-gray-400">
                          ID da Sessão: {simulatorFrameKey}-{Date.now().toString(36)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : showClientArea ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <ClientRegistrationMultipage
                  importedLead={pendingImportedLead}
                  onImportedLeadUsed={clearPendingImportedLead}
                />
              </div>
            ) : activeMenu === "Agenda" ? (
              <Agenda />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row">
                  <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <button
                          key={`${card.line1}-${card.line2}`}
                          type="button"
                          onClick={() => handleCardClick(card.line1, card.line2)}
                          className="group flex h-auto min-h-[112px] overflow-hidden bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex w-2/3 flex-col justify-center border-l-4 border-transparent p-5 transition-all group-hover:border-[#b58c2a]">
                            <span className="text-sm leading-tight text-[#a48641] transition-colors group-hover:text-[#8e733b]">
                              {card.line1}
                            </span>
                            {card.line2 ? (
                              <span className="text-sm font-bold leading-tight text-[#8e733b]">
                                {card.line2}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex w-1/3 items-center justify-center bg-[#a2812a] text-white transition-colors group-hover:bg-[#8f7124]">
                            <Icon
                              size={34}
                              strokeWidth={1.5}
                              className="transition-transform duration-300 group-hover:scale-110"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <aside className="h-fit w-full max-h-full flex-shrink-0 overflow-hidden rounded-sm border border-gray-100 bg-white shadow-sm lg:w-80">
                    <div className="bg-[#0c1826] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-white">
                      Agenda do dia
                    </div>

                    <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <input
                        type="text"
                        placeholder="Nova tarefa..."
                        className="w-full bg-transparent italic text-gray-500 outline-none placeholder-gray-400 sm:w-2/3"
                      />
                      <div className="flex items-center gap-1 text-gray-400">
                        <input
                          type="text"
                          placeholder="Hora"
                          className="w-12 bg-transparent text-center outline-none"
                        />
                        <span>:</span>
                        <input
                          type="text"
                          placeholder="Min."
                          className="w-12 bg-transparent text-center outline-none"
                        />
                      </div>
                    </div>

                    <div className="custom-scrollbar flex-1 overflow-y-auto">
                      {agendaItems.map((item) => (
                        <div
                          key={`${item.name}-${item.time}`}
                          className={`flex cursor-pointer items-start gap-4 border-b border-gray-100 p-4 transition-colors hover:bg-gray-50 ${
                            item.highlight ? "text-red-500" : "text-gray-600"
                          }`}
                        >
                          <div className="mt-1 flex flex-col items-center gap-2">
                            <User
                              fill="currentColor"
                              size={14}
                              className={item.highlight ? "text-red-500" : "text-gray-500"}
                            />
                            <Phone
                              fill="currentColor"
                              size={14}
                              className={item.highlight ? "text-red-500" : "text-gray-500"}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div
                              className={`text-sm font-semibold ${
                                item.highlight ? "text-red-500" : "text-[#555]"
                              }`}
                            >
                              {item.name}
                            </div>
                            <div
                              className={`text-xs ${
                                item.highlight ? "text-red-500" : "text-gray-500"
                              }`}
                            >
                              {item.phone}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className={item.highlight ? "font-medium text-red-400" : ""}>
                                {item.time}
                              </span>
                              <span className={item.highlight ? "text-red-400" : ""}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <SistemaQuerImportModal
        open={showImportModal}
        initialLeadUrl={credential.leadUrl}
        onClose={() => {
          setShowImportModal(false);
        }}
        onUseLeadData={(data) => {
          setPendingImportedLead(data);
          setActiveMenu("Meus clientes");
          setShowImportModal(false);
        }}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
      `}</style>
    </div>
  );
};
