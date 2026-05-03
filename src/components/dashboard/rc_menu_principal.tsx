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
  ShieldCheck,
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
type SimulatorBrowser = "chrome" | "edge" | "firefox" | "safari" | "other";
type SimulatorExternalReason = "manual" | "iframe-error" | "timeout";

const SIMULATOR_LOGIN_URL = "https://app.simuladoronline.com/login/4602";
const SIMULATOR_ENTRY_URL = "https://app.simuladoronline.com/inicio";
const SIMULATOR_LOGOUT_URL = "https://app.simuladoronline.com/logout";
const SIMULATOR_PROXY_LOGIN_URL = "/simulador-proxy/login/4602";
const SIMULATOR_FALLBACK_WINDOW_NAME = "simulador_online_fallback_window";
const CHROME_SIMULATOR_LOAD_TIMEOUT_MS = 18000;
const BASE_SIMULATOR_IFRAME_ALLOW =
  "geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb";
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const detectSimulatorBrowser = (): SimulatorBrowser => {
  const userAgent = window.navigator.userAgent;

  if (/Firefox\//i.test(userAgent)) {
    return "firefox";
  }

  if (/Edg\//i.test(userAgent)) {
    return "edge";
  }

  if (/Chrome\//i.test(userAgent) && !/OPR\/|Opera|SamsungBrowser/i.test(userAgent)) {
    return "chrome";
  }

  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return "safari";
  }

  return "other";
};

const isSimulatorSupportedBrowser = (browser: SimulatorBrowser) =>
  browser === "chrome" || browser === "edge" || browser === "firefox";

const usesSimulatorProxy = (browser: SimulatorBrowser) =>
  browser === "chrome" || browser === "edge";

const getSimulatorBrowserLabel = (browser: SimulatorBrowser) => {
  const labels: Record<SimulatorBrowser, string> = {
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    safari: "Safari",
    other: "este navegador",
  };

  return labels[browser];
};

const getSimulatorIframeAllow = (browser: SimulatorBrowser) =>
  usesSimulatorProxy(browser)
    ? `${BASE_SIMULATOR_IFRAME_ALLOW}; storage-access`
    : BASE_SIMULATOR_IFRAME_ALLOW;

const getSimulatorLoadingMessage = (browser: SimulatorBrowser) =>
  usesSimulatorProxy(browser)
    ? `Tentando carregar o simulador dentro da aplicação pelo proxy experimental do ${getSimulatorBrowserLabel(browser)}...`
    : "Tentando carregar o simulador dentro da aplicação...";

const getSimulatorFrameUrl = (browser: SimulatorBrowser) =>
  usesSimulatorProxy(browser) ? SIMULATOR_PROXY_LOGIN_URL : SIMULATOR_LOGIN_URL;

const getSimulatorExternalMessage = (
  reason: SimulatorExternalReason,
  browser: SimulatorBrowser
) => {
  if (reason === "manual") {
    return `O simulador foi aberto em uma janela propria do ${getSimulatorBrowserLabel(browser)}.`;
  }

  if (!isSimulatorSupportedBrowser(browser)) {
    return "O Simulador dentro do app esta disponivel somente no Chrome, Edge e Firefox.";
  }

  if (usesSimulatorProxy(browser)) {
    return `${getSimulatorBrowserLabel(browser)} não manteve o simulador incorporado de forma estável. Use o botão abaixo para abrir o simulador em uma janela própria.`;
  }

  if (reason === "timeout") {
    return `${getSimulatorBrowserLabel(browser)} não confirmou o carregamento estável do simulador incorporado. O sistema foi aberto automaticamente em uma nova janela.`;
  }

  return `Não foi possível manter o simulador incorporado no ${getSimulatorBrowserLabel(browser)}. O sistema foi aberto automaticamente em uma nova janela.`;
};

const getSimulatorExternalExplanation = (browser: SimulatorBrowser) =>
  !isSimulatorSupportedBrowser(browser)
    ? "Para evitar falhas de login e sessao, o acesso incorporado ao Simulador foi limitado aos navegadores Chrome, Edge e Firefox."
    : usesSimulatorProxy(browser)
    ? `O ${getSimulatorBrowserLabel(browser)} pode tratar cookies e armazenamento de sites externos dentro de iframes de forma mais restritiva. O proxy experimental tenta manter o simulador dentro do app usando o mesmo dominio local.`
    : "Esse fallback é acionado quando o navegador ou o próprio simulador restringe algum recurso necessário para manter o site externo incorporado.";

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
  const [simulatorBrowser, setSimulatorBrowser] = useState<SimulatorBrowser>("other");

  const simulatorTimeoutRef = useRef<number | null>(null);
  const simulatorWindowRef = useRef<Window | null>(null);
  const simulatorIframeRef = useRef<HTMLIFrameElement | null>(null);
  const simulatorIframeLoadedRef = useRef(false);

  const [credential, setCredential] = useState({
    login: "Rosilene Rodrigues",
    senha: "123",
    leadUrl: "",
  });
  const [isAuthorizingBridge, setIsAuthorizingBridge] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "popup_open" | "success">("idle");
  const [bridgeProgress, setBridgeProgress] = useState(0);
  const bridgeCheckIntervalRef = useRef<number | null>(null);
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
      const popup = window.open(
        "",
        SIMULATOR_FALLBACK_WINDOW_NAME,
        "width=100,height=100,left=-9999,top=-9999,resizable=yes,scrollbars=yes"
      );

      if (popup) {
        writeFallbackWindowLoadingContent(popup);
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
    }
  };

  const openSimulatorExternally = (
    reason: SimulatorExternalReason = "manual",
    browser: SimulatorBrowser = detectSimulatorBrowser()
  ) => {
    const popup = simulatorWindowRef.current;

    clearSimulatorTimeout();
    setSimulatorBrowser(browser);
    setSimulatorMode("external");
    const shouldOpenWindowNow = reason === "manual" && isSimulatorSupportedBrowser(browser);
    setSimulatorAutoOpenedExternally(shouldOpenWindowNow);
    setSimulatorStatusMessage(getSimulatorExternalMessage(reason, browser));

    if (!shouldOpenWindowNow) {
      return;
    }

    try {
      if (popup && !popup.closed) {
        try {
          popup.resizeTo(1280, 900);
          popup.moveTo(
            Math.max(0, (window.screen.width - 1280) / 2),
            Math.max(0, (window.screen.height - 900) / 2)
          );
        } catch (_resizeError) {}

        popup.location.href = SIMULATOR_ENTRY_URL;
        popup.focus();
        return;
      }
    } catch (_error) {
    }

    const newWindow = window.open(
      SIMULATOR_ENTRY_URL,
      SIMULATOR_FALLBACK_WINDOW_NAME,
      "width=1280,height=900,resizable=yes,scrollbars=yes"
    );

    if (!newWindow) {
      window.location.href = SIMULATOR_ENTRY_URL;
    } else {
      simulatorWindowRef.current = newWindow;
      newWindow.focus();
    }
  };

  const startSimulatorAttempt = (browser: SimulatorBrowser) => {
    simulatorIframeLoadedRef.current = false;
    setSimulatorBrowser(browser);
    setSimulatorAutoOpenedExternally(false);
    setActiveMenu("Simulador");
    setSimulatorFrameKey((prev) => prev + 1);

    clearSimulatorTimeout();

    if (!isSimulatorSupportedBrowser(browser)) {
      setSimulatorStatusMessage(getSimulatorExternalMessage("iframe-error", browser));
      setSimulatorMode("external");
      return;
    }

    setSimulatorStatusMessage(getSimulatorLoadingMessage(browser));
    setSimulatorMode("loading");

    if (browser === "chrome") {
      simulatorTimeoutRef.current = window.setTimeout(() => {
        if (!simulatorIframeLoadedRef.current) {
          openSimulatorExternally("timeout", browser);
        }
      }, CHROME_SIMULATOR_LOAD_TIMEOUT_MS);
    }
  };

  const startBridgeAuthorization = () => {
    setIsAuthorizingBridge(true);
    setBridgeStatus("popup_open");

    const bridgeUrl = SIMULATOR_LOGIN_URL;

    // Abre o simulador como site principal para o navegador aceitar login e cookies.
    const width = 1280;
    const height = 900;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      bridgeUrl,
      "SimulatorBridge",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,location=no,toolbar=no,menubar=no`
    );

    if (popup) {
      simulatorWindowRef.current = popup;
      popup.focus();
      setBridgeProgress(50);

      // Monitora o fechamento da janela para automatizar o retorno
      if (bridgeCheckIntervalRef.current) clearInterval(bridgeCheckIntervalRef.current);

      bridgeCheckIntervalRef.current = window.setInterval(() => {
        // Incrementa o progresso lentamente até 92% para mostrar atividade
        setBridgeProgress(prev => (prev < 92 ? prev + 0.5 : prev));

        if (!popup || popup.closed) {
          if (bridgeCheckIntervalRef.current) {
            clearInterval(bridgeCheckIntervalRef.current);
            bridgeCheckIntervalRef.current = null;
          }
          setBridgeProgress(100);
          setBridgeStatus("success");
          // Pequeno delay para garantir que o navegador processou os cookies.
          setTimeout(() => {
            completeBridgeAuthorization();
          }, 800);
        }
      }, 800);
    }
  };

  const completeBridgeAuthorization = async () => {
    if (bridgeCheckIntervalRef.current) {
      clearInterval(bridgeCheckIntervalRef.current);
      bridgeCheckIntervalRef.current = null;
    }

    setBridgeProgress(100);
    setBridgeStatus("success");
    setIsAuthorizingBridge(false);
    setSimulatorMode("external");
    setSimulatorAutoOpenedExternally(true);
    setSimulatorStatusMessage("Continue usando o simulador na janela propria do navegador. Se ela fechou, use o botao abaixo para abrir novamente.");

    const popup = simulatorWindowRef.current;
    if (popup && !popup.closed) {
      try {
        popup.location.href = SIMULATOR_ENTRY_URL;
        popup.focus();
        return;
      } catch (_error) {}
    }

    openSimulatorExternally("manual", detectSimulatorBrowser());
  };

  const enterSimulator = async () => {
    const browser = detectSimulatorBrowser();
    setSimulatorBrowser(browser);
    setActiveMenu("Simulador");

    if (usesSimulatorProxy(browser)) {
      startSimulatorAttempt(browser);
      return;
    }

    // Para outros navegadores suportados, carrega direto.
    startSimulatorAttempt(browser);
  };

  const retrySimulatorInsideApp = () => {
    const browser = detectSimulatorBrowser();
    startSimulatorAttempt(browser);
  };

  const fillSimulatorProxyCredentials = () => {
    if (!usesSimulatorProxy(simulatorBrowser)) {
      return;
    }

    const frame = simulatorIframeRef.current;
    if (!frame) {
      return;
    }

    const applyCredentials = () => {
      try {
        const frameDocument = frame.contentDocument;
        const loginInput = frameDocument?.querySelector<HTMLInputElement>("#login_usuario");
        const senhaInput = frameDocument?.querySelector<HTMLInputElement>("#login_senha");

        if (!loginInput || !senhaInput) {
          return;
        }

        loginInput.value = credential.login;
        senhaInput.value = credential.senha;
        loginInput.setAttribute("autocomplete", "off");
        senhaInput.setAttribute("autocomplete", "off");
        loginInput.setAttribute("data-lpignore", "true");
        senhaInput.setAttribute("data-lpignore", "true");
        loginInput.dispatchEvent(new Event("input", { bubbles: true }));
        senhaInput.dispatchEvent(new Event("input", { bubbles: true }));
        loginInput.dispatchEvent(new Event("change", { bubbles: true }));
        senhaInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_error) {}
    };

    applyCredentials();
    [150, 600, 1500].forEach((delay) => window.setTimeout(applyCredentials, delay));
  };

  const handleSimulatorIframeLoad = () => {
    if (simulatorMode === "external") {
      return;
    }

    fillSimulatorProxyCredentials();
    simulatorIframeLoadedRef.current = true;
    clearSimulatorTimeout();
    setSimulatorMode("embedded");
    setSimulatorStatusMessage("Simulador carregado dentro da aplicação.");
    setSimulatorAutoOpenedExternally(false);
    closeReservedSimulatorWindowIfStillIdle();
  };

  const handleSimulatorIframeError = () => {
    openSimulatorExternally("iframe-error", simulatorBrowser);
  };

  const cleanupSimulatorUi = () => {
    clearSimulatorTimeout();
    simulatorIframeLoadedRef.current = false;
    setSimulatorMode("idle");
    setSimulatorStatusMessage("");
    setSimulatorAutoOpenedExternally(false);
    setSimulatorBrowser("other");
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
        } catch (_error) {}
        simulatorWindowRef.current = null;
        return;
      } catch (_error) {}
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
        } catch (_error) {}
        return;
      }
    } catch (_error) {}

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
      if (bridgeCheckIntervalRef.current) {
        clearInterval(bridgeCheckIntervalRef.current);
        bridgeCheckIntervalRef.current = null;
      }
    };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
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
                <div className="flex flex-col border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <FolderOpen size={14} />
                      {simulatorMode === "embedded"
                        ? "Simulador Online em execução"
                        : simulatorMode === "loading"
                          ? "Tentando carregar o Simulador Online"
                          : simulatorMode === "external"
                            ? isSimulatorSupportedBrowser(simulatorBrowser)
                              ? "Simulador Online aberto externamente"
                              : "Simulador Online disponivel no Chrome, Edge e Firefox"
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

                      {isSimulatorSupportedBrowser(simulatorBrowser) ? (
                        <button
                          type="button"
                          onClick={() => openSimulatorExternally("manual", simulatorBrowser)}
                          className="flex items-center gap-1 font-medium text-[#b58c2a] hover:underline"
                        >
                          Abrir em nova janela <ExternalLink size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {(simulatorBrowser === "chrome" || simulatorBrowser === "edge") && simulatorMode !== "embedded" && (
                    <div className="mt-6 flex flex-col overflow-hidden rounded-[2.5rem] border border-amber-200 bg-white shadow-[0_25px_60px_rgba(181,140,42,0.15)] transition-all duration-700 max-w-3xl mx-auto w-full animate-in zoom-in-95 duration-500">
                      <div className="bg-gradient-to-r from-amber-50/50 via-white to-amber-50/30 px-8 py-6 border-b border-amber-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-8 transition-all duration-500 ${isAuthorizingBridge ? 'bg-green-500 ring-green-50 animate-pulse' : 'bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-amber-50'}`}>
                            {isAuthorizingBridge ? <ShieldCheck size={28} className="text-white" /> : <User size={28} />}
                          </div>
                          <div className="text-left">
                            <h4 className="text-sm font-black text-amber-900 uppercase tracking-[0.2em]">Ponte de Autorização</h4>
                            <p className="text-[11px] text-amber-600 font-bold opacity-75">Otimizado para {getSimulatorBrowserLabel(simulatorBrowser)} no {window.location.hostname}</p>
                          </div>
                        </div>

                        {!isAuthorizingBridge ? (
                          <button
                            type="button"
                            onClick={startBridgeAuthorization}
                            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-[#0c1826] px-8 py-4 text-xs font-black text-white shadow-2xl transition-all hover:scale-105 hover:bg-[#152a42] active:scale-95"
                          >
                            <span className="relative z-10 uppercase tracking-widest">Abrir Login do Simulador</span>
                            <ExternalLink size={16} className="relative z-10 opacity-70 transition-transform group-hover:translate-x-1" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-100 px-5 py-3 shadow-inner">
                             <div className="flex h-2 w-2 rounded-full bg-green-500 animate-ping" />
                             <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Aguardando Login...</span>
                          </div>
                        )}
                      </div>

                      <div className="p-8 bg-white relative overflow-hidden">
                        {!isAuthorizingBridge ? (
                          <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 w-full space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Perfil de Acesso</p>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50/50 px-3 py-1 rounded-full border border-amber-100">
                                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                  Automático
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="group flex flex-col gap-1.5">
                                  <span className="text-[9px] font-black text-gray-300 uppercase ml-2">Usuário</span>
                                  <div className="h-12 flex items-center rounded-2xl bg-gray-50/50 px-5 text-xs font-bold text-gray-700 border border-gray-100 shadow-sm group-hover:border-amber-200 transition-colors">
                                    {credential.login}
                                  </div>
                                </div>
                                <div className="group flex flex-col gap-1.5">
                                  <span className="text-[9px] font-black text-gray-300 uppercase ml-2">Senha</span>
                                  <div className="h-12 flex items-center rounded-2xl bg-gray-50/50 px-5 text-xs font-bold text-gray-700 border border-gray-100 shadow-sm group-hover:border-amber-200 transition-colors">
                                    {credential.senha}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-gray-100 to-transparent" />
                            <div className="md:max-w-[240px] space-y-3">
                              <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                                Este navegador funciona melhor quando o simulador abre em janela propria ou pelo proxy experimental. Use as credenciais ao lado se precisar.
                              </p>
                              <div className="flex items-start gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-blue-600/80 font-semibold leading-snug">
                                  Depois de clicar em "Entrar", mantenha a janela aberta. Se voltar ao painel, clique em concluir para focar o simulador.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95 duration-500">
                            <div className="relative mb-8">
                              <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-20" />
                              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-green-600 ring-[12px] ring-green-50/30">
                                <Loader2 size={40} className="animate-spin text-green-500" />
                              </div>
                            </div>

                            <h5 className="mb-3 text-xl font-black text-gray-900 tracking-tight">
                               {bridgeProgress < 90 ? "Sincronização Ativa" : "Aguardando Conclusão"}
                             </h5>
                             <p className="mb-10 max-w-md text-sm text-gray-500 leading-relaxed font-medium">
                               {bridgeProgress < 85
                                 ? "Estamos estabelecendo a conexão segura com o servidor do simulador..."
                                  : "Login concluido? Mantenha a janela do simulador aberta e conclua aqui."}
                               <br/>
                               <span className="text-gray-900 font-bold">Não feche esta página do dashboard.</span>
                             </p>

                             <div className="w-full max-w-lg space-y-4">
                               <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                                 <span>Progresso da Ponte</span>
                                 <span>{Math.floor(bridgeProgress)}%</span>
                               </div>
                               <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner">
                                 <div
                                   className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700 shadow-sm"
                                   style={{ width: `${bridgeProgress}%` }}
                                 />
                               </div>

                               <p className="text-[11px] text-gray-400 italic">
                                 Se o login já foi feito e a janela não fechou sozinha, <button onClick={completeBridgeAuthorization} className="text-green-600 font-bold hover:underline">clique aqui para concluir agora</button>.
                               </p>
                             </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50/50 px-8 py-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-400" />
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Sistema de Ponte Inteligente v2.0
                          </p>
                        </div>
                        {isAuthorizingBridge && (
                           <button
                             onClick={completeBridgeAuthorization}
                             className="text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest transition-colors flex items-center gap-2"
                           >
                             Forçar Conclusão <ShieldCheck size={14} />
                           </button>
                        )}
                      </div>
                    </div>
                  )}
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
                      ref={simulatorIframeRef}
                      key={simulatorFrameKey}
                      src={getSimulatorFrameUrl(simulatorBrowser)}
                      title="Simulador Online"
                      className="h-full w-full border-none"
                      style={{
                        display: "block",
                        position: "relative",
                        zIndex: 10,
                      }}
                      allow={getSimulatorIframeAllow(simulatorBrowser)}
                      allowFullScreen
                      onLoad={handleSimulatorIframeLoad}
                      onError={handleSimulatorIframeError}
                    />
                  </div>
                ) : simulatorMode === "idle" && (simulatorBrowser === "chrome" || simulatorBrowser === "edge") ? (
                  <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                  </div>
                ) : (
                  <div
                    className={
                      "flex flex-1 items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-6"
                    }
                  >
                    <div
                      className={
                        "w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl"
                      }
                    >
                      <div className="h-2 bg-gradient-to-r from-[#b58c2a] to-[#d4af37]" />

                      <div
                        className={
                          "p-10 text-center"
                        }
                      >
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#b58c2a]/10 text-[#b58c2a] ring-8 ring-[#b58c2a]/5">
                          <ExternalLink size={44} strokeWidth={1.5} />
                        </div>

                        <h3 className="mb-4 text-2xl font-black tracking-tight text-[#0c1826]">
                          {isSimulatorSupportedBrowser(simulatorBrowser)
                            ? "Simulador Ativo em Janela Externa"
                            : "Use Chrome, Edge ou Firefox para acessar o Simulador"}
                        </h3>

                        <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-gray-600">
                          {simulatorStatusMessage ||
                            "Não foi possível manter o simulador incorporado neste navegador."}
                        </p>

                        {!isSimulatorSupportedBrowser(simulatorBrowser) ? (
                          <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm">
                              <p className="text-xs font-semibold uppercase text-gray-400">Compatibilidade</p>
                              <p className="mt-1 font-bold text-[#0c1826]">Chrome, Edge e Firefox</p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm">
                              <p className="text-xs font-semibold uppercase text-gray-400">Navegador atual</p>
                              <p className="mt-1 font-bold text-[#0c1826]">
                                {getSimulatorBrowserLabel(simulatorBrowser)}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div className="mb-10 rounded-2xl border border-amber-100 bg-amber-50/50 p-6 text-left">
                          <div className="flex gap-3">
                            <Info className="mt-0.5 flex-shrink-0 text-amber-600" size={18} />
                            <div className="space-y-2 text-sm text-amber-900">
                              <p className="font-semibold">Por que isso aconteceu?</p>
                              <p className="opacity-80">
                                {getSimulatorExternalExplanation(simulatorBrowser)}
                              </p>
                              {usesSimulatorProxy(simulatorBrowser) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (typeof document.requestStorageAccess === "function") {
                                      try {
                                        await document.requestStorageAccess();
                                        retrySimulatorInsideApp();
                                      } catch (_e) {
                                        alert(`Por favor, habilite cookies de terceiros nas configurações do ${getSimulatorBrowserLabel(simulatorBrowser)} para este site.`);
                                      }
                                    }
                                  }}
                                  className="mt-2 text-xs font-bold underline text-amber-700 hover:text-amber-900"
                                >
                                  Tentar liberar acesso ao armazenamento ({getSimulatorBrowserLabel(simulatorBrowser)})
                                </button>
                              )}

                              <div className="mt-4 pt-4 border-t border-amber-200/50">
                                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-2">Credenciais de Acesso</p>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] text-amber-600">LOGIN</p>
                                    <p className="font-mono font-bold text-amber-950">Rosilene Rodrigues</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-amber-600">SENHA</p>
                                    <p className="font-mono font-bold text-amber-950">123</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                          {isSimulatorSupportedBrowser(simulatorBrowser) ? (
                            <button
                              type="button"
                              onClick={() => openSimulatorExternally("manual", simulatorBrowser)}
                              className="group flex items-center gap-3 rounded-xl bg-[#0c1826] px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-[#152a42] active:scale-95"
                            >
                              <span>Abrir Simulador Agora</span>
                              <ExternalLink size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                cleanupSimulatorUi();
                                setActiveMenu("Home");
                              }}
                              className="rounded-xl bg-[#0c1826] px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-[#152a42] active:scale-95"
                            >
                              Voltar ao dashboard
                            </button>
                          )}

                          {isSimulatorSupportedBrowser(simulatorBrowser) ? (
                            <button
                              type="button"
                              onClick={retrySimulatorInsideApp}
                              className="rounded-xl border border-gray-200 px-8 py-4 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                            >
                              Tentar incorporar (Legacy)
                            </button>
                          ) : null}
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
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.5);
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
