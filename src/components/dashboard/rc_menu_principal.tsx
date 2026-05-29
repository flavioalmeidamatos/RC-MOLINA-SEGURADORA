import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Banknote,
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Info,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  PartyPopper,
  User,
  Users,
  Layers,
  Link2,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClientRegistrationMultipage } from "../clientes/client_registration_multipage";
import { Agenda } from "../agenda/agenda";
import type { Agendamento } from "../agenda/agenda";
import { CampanhasShell } from "../campanhas/campanhas_shell";
import { apiListVisibleUsers } from "../../lib/local_api";
import type { LocalAuthSession, UsuarioPerfil } from "../../lib/local_auth";
import { createGmailApi, type MessageSummary } from "../../lib/gmail_api";
import { APP_VERSION } from "../../version";

const RCWebmail = React.lazy(async () => ({
  default: (await import("../webmail/rc_webmail")).RCWebmail,
}));

const DESKTOP_AGENT_ORIGIN = "http://127.0.0.1:43125";

interface DashboardProps {
  session?: LocalAuthSession | null;
  perfil?: UsuarioPerfil | null;
  onLogout?: () => void;
  forcedMenu?: string | null;
}

export interface AniversarianteMes {
  codigo: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string;
  cidade: string | null;
  uf: string | null;
  status_cliente: string | null;
}

type SimulatorMode = "idle" | "loading" | "embedded" | "external";
type SimulatorBrowser = "chrome" | "edge" | "firefox" | "safari" | "other";
type SimulatorExternalReason = "manual" | "iframe-error" | "timeout";

const USERS_VIEWER_FULL_NAME = "ROSILENE RODRIGUES DE CARVALHO MOLINA";
const normalizeFullName = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

const SIMULATOR_ENTRY_URL = "https://app.simuladoronline.com/inicio";
const SIMULATOR_LOGOUT_URL = "https://app.simuladoronline.com/logout";
const SIMULATOR_PROXY_LOGIN_URL = "/simulador-proxy/login/4602";
const SULAMERICA_SIMULATOR_URL = "https://os11.sulamerica.com.br/SaudeCotador/LoginVendedor.aspx";
const SULAMERICA_PROXY_LOGIN_URL = "/sulamerica-proxy/SaudeCotador/LoginVendedor.aspx";
const AMIL_SIMULATOR_URL = "https://portalcorretor.amil.com.br/portal/web/servicos/usuario/corretor/login";
const AMIL_PROXY_LOGIN_URL = "/amil-proxy/portal/web/servicos/usuario/corretor/login";
const MEDSENIOR_SIMULATOR_URL = "https://vendadigital.medsenior.com.br/";
const KLINI_SIMULATOR_URL = "https://klinisaude.hcommerce.com.br/corretora/login";
const AMIL_LOGIN = "77915445715";
const AMIL_PASSWORD = "sqn0y3zqmo";
const SIMULATOR_FALLBACK_WINDOW_NAME = "simulador_online_fallback_window";
const CHROME_SIMULATOR_LOAD_TIMEOUT_MS = 18000;
const GMAIL_INBOX_POLL_INTERVAL_MS = 5000;
const AGENDA_REMINDER_POLL_INTERVAL_MS = 30000;
const AGENDA_REFRESH_INTERVAL_MS = 30000;
const AGENDA_REMINDER_LEAD_MINUTES = 5;
const AGENDA_REMINDER_STORAGE_KEY = "rc_molina_agenda_reminders";
const BASE_SIMULATOR_IFRAME_ALLOW =
  "geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb";
const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
const formatBirthDate = (value: string) => {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}` : "";
};

const currentMonthName = () =>
  new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date()).replace(/^./, (letter) => letter.toUpperCase());

type AgendaReminderState = Record<
  string,
  {
    dismissedPhases?: string[];
    snoozedUntil?: number;
  }
>;

type AgendaReminderPhase = "before" | "due" | "snoozed";

type ActiveAgendaReminder = {
  agendamento: Agendamento;
  appointmentAt: Date;
  phase: AgendaReminderPhase;
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseAgendamentoDateTime = (agendamento: Agendamento) => {
  const date = String(agendamento.data_agendamento || "").slice(0, 10);
  const time = String(agendamento.hora_inicio || "00:00").slice(0, 5);
  const parsed = new Date(`${date}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatReminderDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const loadAgendaReminderState = (): AgendaReminderState => {
  try {
    return JSON.parse(window.localStorage.getItem(AGENDA_REMINDER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveAgendaReminderState = (state: AgendaReminderState) => {
  window.localStorage.setItem(AGENDA_REMINDER_STORAGE_KEY, JSON.stringify(state));
};

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
  browser === "chrome" || browser === "edge" || browser === "firefox";

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

const getSimulatorFrameUrl = () => SIMULATOR_PROXY_LOGIN_URL;

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
    ? "Para evitar falhas de login e sessão, o acesso incorporado ao Simulador foi limitado aos navegadores Chrome, Edge e Firefox."
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
  forcedMenu,
}) => {
  const navigate = useNavigate();
  const userName =
    perfil?.nome_completo ||
    session?.user?.email?.split("@")[0] ||
    "Nome do Usuário";
  const avatarUrl = perfil?.avatar_url || null;
  const canViewSystemUsers = normalizeFullName(perfil?.nome_completo || "") === USERS_VIEWER_FULL_NAME;

  const [activeMenu, setActiveMenu] = useState(forcedMenu || "Home");
  const [campanhaInitialMessage, setCampanhaInitialMessage] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [aniversariantesMes, setAniversariantesMes] = useState<AniversarianteMes[]>([]);
  const [isLoadingAniversariantes, setIsLoadingAniversariantes] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendaReminderState, setAgendaReminderState] = useState<AgendaReminderState>({});
  const [activeAgendaReminder, setActiveAgendaReminder] = useState<ActiveAgendaReminder | null>(null);
  const [reminderSnoozeMinutes, setReminderSnoozeMinutes] = useState("5");
  const [clientStats, setClientStats] = useState({ total: 0, ativos: 0, inativos: 0 });
  const [isLoadingClientStats, setIsLoadingClientStats] = useState(false);
  const [systemUsers, setSystemUsers] = useState<UsuarioPerfil[]>([]);
  const [isLoadingSystemUsers, setIsLoadingSystemUsers] = useState(false);
  const [systemUsersError, setSystemUsersError] = useState("");

  const [simulatorMode, setSimulatorMode] = useState<SimulatorMode>("idle");
  const [simulatorFrameKey, setSimulatorFrameKey] = useState(0);
  const [sulamericaFrameKey, setSulamericaFrameKey] = useState(0);
  const [simulatorStatusMessage, setSimulatorStatusMessage] = useState("");
  const [simulatorBrowser, setSimulatorBrowser] = useState<SimulatorBrowser>("other");
  const [showSimulatorChooser, setShowSimulatorChooser] = useState(false);
  const [showSistemasChooser, setShowSistemasChooser] = useState(false);
  const [showLinksChooser, setShowLinksChooser] = useState(false);
  const [linksDesktopStatus, setLinksDesktopStatus] = useState("");


  const simulatorTimeoutRef = useRef<number | null>(null);
  const simulatorWindowRef = useRef<Window | null>(null);
  const simulatorIframeRef = useRef<HTMLIFrameElement | null>(null);
  const simulatorIframeLoadedRef = useRef(false);
  const amilIframeRef = useRef<HTMLIFrameElement | null>(null);
  const amilLoginSubmittedRef = useRef(false);


  const [credential, setCredential] = useState({
    login: "Rosilene Rodrigues",
    senha: "123",
  });

  // Webmail global redirection and updates
  const [webmailRedirectMessageId, setWebmailRedirectMessageId] = useState<string | null>(null);
  const [lastInboxUpdateTimestamp, setLastInboxUpdateTimestamp] = useState(0);
  const [inboxNotifications, setInboxNotifications] = useState<MessageSummary[]>([]);
  const knownInboxMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedAccountsRef = useRef<Set<string>>(new Set());
  const inboxPollInFlightRef = useRef(false);

  function compactSender(value: string) {
    return value.replace(/<[^>]+>/g, "").trim() || value;
  }

  function senderInitial(value: string) {
    const normalized = compactSender(value).trim();
    const firstAlphaNumeric = Array.from(normalized).find((character) => /[\p{L}\p{N}]/u.test(character));
    return firstAlphaNumeric?.toLocaleUpperCase("pt-BR") || "?";
  }

  async function waitForDesktopAgent(timeoutMs = 7000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const response = await fetch(`${DESKTOP_AGENT_ORIGIN}/health`, { cache: "no-store" });
        if (response.ok) return true;
      } catch {
        // O agente ainda pode estar subindo.
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    return false;
  }

  function getDesktopScreenHint(anchorRect?: DOMRect) {
    const cardEl = document.getElementById("card-meus-clientes");
    const dpr = window.devicePixelRatio || 1;
    let x = window.screenLeft + Math.round(192 * dpr);
    let y = window.screenTop + Math.round(64 * dpr);

    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      x = Math.round(window.screenLeft + rect.left * dpr);
      y = Math.round(window.screenTop + rect.top * dpr);
    } else {
      const sidebarEl = document.querySelector("aside");
      const sidebarWidth = sidebarEl ? Math.round(sidebarEl.getBoundingClientRect().width) : 192;
      const headerEl = document.querySelector("header");
      const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 64;
      x = window.screenLeft + Math.round(sidebarWidth * dpr);
      y = window.screenTop + Math.round(headerHeight * dpr);
    }

    const sidebarEl = document.querySelector("aside");
    const sidebarWidth = sidebarEl ? Math.round(sidebarEl.getBoundingClientRect().width) : 192;
    const width = window.innerWidth - sidebarWidth;
    const height = window.innerHeight - 64;

    return {
      x,
      y,
      width,
      height,
      anchorSource: "links",
    };
  }

  async function requestDesktopOpen(url: string, anchorRect?: DOMRect) {
    const response = await fetch(`${DESKTOP_AGENT_ORIGIN}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        screen: getDesktopScreenHint(anchorRect),
      }),
    });

    if (!response.ok) {
      throw new Error("O cliente desktop recusou a abertura da URL.");
    }
  }

  async function openPortalInDesktop(url: string, anchorRect?: DOMRect) {
    setLinksDesktopStatus("Abrindo portal no aplicativo desktop...");

    try {
      await requestDesktopOpen(url, anchorRect);
      setLinksDesktopStatus("");
      return;
    } catch (err) {
      console.warn("[Links] Falha ao conectar ao agente local via HTTP. Usando deep link...", err);
    }

    try {
      const screen = getDesktopScreenHint(anchorRect);
      const deepLinkUrl = `urlembeddiag://?url=${encodeURIComponent(url)}&x=${screen.x}&y=${screen.y}&width=${screen.width}&height=${screen.height}`;
      
      setLinksDesktopStatus("Iniciando/Integrando com o aplicativo desktop...");
      window.location.href = deepLinkUrl;
      
      // Wait a little and clear status
      await wait(2000);
      setLinksDesktopStatus("");
    } catch (error) {
      console.warn("[Links] Falha ao abrir via deep link; usando nova aba como contingencia.", error);
      setLinksDesktopStatus("Não foi possível iniciar o desktop automaticamente. Abrindo em nova aba.");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  useEffect(() => {
    const actorUserId = perfil?.id || session?.user?.id || null;
    const actorUserEmail = perfil?.email || session?.user?.email || null;
    if (!actorUserId || !actorUserEmail) return;

    knownInboxMessageIdsRef.current = new Set();
    initializedAccountsRef.current = new Set();
    inboxPollInFlightRef.current = false;
    setInboxNotifications([]);

    const gmailApi = createGmailApi({ userId: actorUserId, userEmail: actorUserEmail });

    const checkNewMessages = async () => {
      if (inboxPollInFlightRef.current) return;
      inboxPollInFlightRef.current = true;

      try {
        const accountsResult = await gmailApi.accounts();
        if (!accountsResult || !accountsResult.accounts || accountsResult.accounts.length === 0) {
          return;
        }

        for (const account of accountsResult.accounts) {
          // If the account status is not connected, skip
          if (account.status !== "connected") continue;

          const result = await gmailApi.messages(account.email, "inbox", {});
          if (result && result.messages) {
            const hasBeenInitialized = initializedAccountsRef.current.has(account.email);

            if (!hasBeenInitialized) {
              // Initialize existing message IDs so we don't notify them
              result.messages.forEach((msg) => knownInboxMessageIdsRef.current.add(msg.id));
              initializedAccountsRef.current.add(account.email);
              continue;
            }

            // Subsequent polls
            const newMails: MessageSummary[] = [];
            result.messages.forEach((msg) => {
              if (!knownInboxMessageIdsRef.current.has(msg.id)) {
                newMails.push(msg);
                knownInboxMessageIdsRef.current.add(msg.id);
              }
            });

            if (newMails.length > 0) {
              setInboxNotifications((prev) => {
                const existingIds = new Set(prev.map((item) => item.id));
                const uniqueNewMails = newMails.filter((item) => !existingIds.has(item.id));
                return uniqueNewMails.length > 0 ? [...prev, ...uniqueNewMails] : prev;
              });
              setLastInboxUpdateTimestamp(Date.now());
            }
          }
        }
      } catch (err) {
        console.error("Erro no auto-refresh global:", err);
      } finally {
        inboxPollInFlightRef.current = false;
      }
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void checkNewMessages();
      }
    };

    const handleWindowFocus = () => {
      void checkNewMessages();
    };

    // Run immediately once, then poll in short intervals.
    void checkNewMessages();
    const intervalId = window.setInterval(() => {
      void checkNewMessages();
    }, GMAIL_INBOX_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("focus", handleWindowFocus);
      inboxPollInFlightRef.current = false;
    };
  }, [perfil?.id, perfil?.email, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (forcedMenu) {
      setActiveMenu(forcedMenu);
      setShowSimulatorChooser(false);
    }
  }, [forcedMenu]);


  useEffect(() => {
    let ignore = false;

    const loadAniversariantes = async () => {
      setIsLoadingAniversariantes(true);
      try {
        const response = await fetch("/api/clientes/aniversariantes-mes");
        if (!response.ok) throw new Error("Falha ao carregar aniversariantes.");
        const data = (await response.json()) as AniversarianteMes[];
        if (!ignore) setAniversariantesMes(data);
      } catch (error) {
        console.error("Erro ao carregar aniversariantes do mes:", error);
        if (!ignore) setAniversariantesMes([]);
      } finally {
        if (!ignore) setIsLoadingAniversariantes(false);
      }
    };

    const loadClientStats = async () => {
      setIsLoadingClientStats(true);
      try {
        const response = await fetch("/api/clientes/stats");
        if (!response.ok) throw new Error("Falha ao carregar estatísticas de clientes.");
        const data = await response.json();
        if (!ignore) setClientStats(data);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        if (!ignore) setIsLoadingClientStats(false);
      }
    };

    void loadAniversariantes();
    void loadClientStats();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setAgendaReminderState(loadAgendaReminderState());
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadAgendamentos = async (options?: { allowAfterUnmount?: boolean }) => {
      try {
        const response = await fetch("/api/agendamentos");
        if (!response.ok) throw new Error("Falha ao carregar agendamentos.");
        const json = await response.json();
        if (!ignore || options?.allowAfterUnmount) setAgendamentos(Array.isArray(json.data) ? json.data : []);
      } catch (error) {
        console.error("Erro ao carregar agendamentos:", error);
        if (!ignore || options?.allowAfterUnmount) setAgendamentos([]);
      }
    };

    (window as any).__rcMolinaRefreshAgendamentos = () => loadAgendamentos({ allowAfterUnmount: true });

    void loadAgendamentos();
    const intervalId = window.setInterval(() => {
      void loadAgendamentos();
    }, AGENDA_REFRESH_INTERVAL_MS);
    const handleFocus = () => {
      void loadAgendamentos();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadAgendamentos();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if ((window as any).__rcMolinaRefreshAgendamentos) {
        delete (window as any).__rcMolinaRefreshAgendamentos;
      }
    };
  }, []);

  useEffect(() => {
    const findDueReminder = () => {
      if (activeAgendaReminder) return;

      const now = Date.now();
      const todayKey = getLocalDateKey();

      for (const agendamento of agendamentos) {
        if (String(agendamento.data_agendamento || "").slice(0, 10) !== todayKey) continue;

        const appointmentAt = parseAgendamentoDateTime(agendamento);
        if (!appointmentAt) continue;

        const appointmentTime = appointmentAt.getTime();
        const reminderTime = appointmentTime - AGENDA_REMINDER_LEAD_MINUTES * 60 * 1000;
        const state = agendaReminderState[agendamento.id_agendamento] || {};
        const dismissedPhases = new Set(state.dismissedPhases || []);

        if (state.snoozedUntil && now >= state.snoozedUntil) {
          setActiveAgendaReminder({ agendamento, appointmentAt, phase: "snoozed" });
          return;
        }

        if (state.snoozedUntil && now < state.snoozedUntil) continue;

        if (now >= appointmentTime && !dismissedPhases.has("due")) {
          setActiveAgendaReminder({ agendamento, appointmentAt, phase: "due" });
          return;
        }

        if (now >= reminderTime && now < appointmentTime && !dismissedPhases.has("before")) {
          setActiveAgendaReminder({ agendamento, appointmentAt, phase: "before" });
          return;
        }
      }
    };

    findDueReminder();
    const intervalId = window.setInterval(findDueReminder, AGENDA_REMINDER_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeAgendaReminder, agendaReminderState, agendamentos]);

  useEffect(() => {
    let ignore = false;

    const loadSystemUsers = async () => {
      if (!canViewSystemUsers || !perfil?.id || !perfil?.email) {
        setSystemUsers([]);
        setSystemUsersError("");
        setIsLoadingSystemUsers(false);
        return;
      }

      setIsLoadingSystemUsers(true);
      setSystemUsersError("");

      try {
        const { data, error } = await apiListVisibleUsers({ id: perfil.id, email: perfil.email });
        if (ignore) {
          return;
        }

        if (error) {
          setSystemUsers([]);
          setSystemUsersError(error);
          return;
        }

        setSystemUsers(data || []);
      } catch (error) {
        console.error("Erro ao carregar usuários do sistema:", error);
        if (!ignore) {
          setSystemUsers([]);
          setSystemUsersError("Não foi possível carregar os usuários do sistema.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingSystemUsers(false);
        }
      }
    };

    void loadSystemUsers();

    return () => {
      ignore = true;
    };
  }, [canViewSystemUsers, perfil?.email, perfil?.id]);

  const clearSimulatorTimeout = () => {
    if (simulatorTimeoutRef.current !== null) {
      window.clearTimeout(simulatorTimeoutRef.current);
      simulatorTimeoutRef.current = null;
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
    setActiveMenu("Simuladores");
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

  const enterSimulator = async () => {
    const browser = detectSimulatorBrowser();
    setSimulatorBrowser(browser);
    setShowSimulatorChooser(false);
    setActiveMenu("Simuladores");

    if (usesSimulatorProxy(browser)) {
      startSimulatorAttempt(browser);
      return;
    }

    startSimulatorAttempt(browser);
  };

  const openSimulatorChooser = () => {
    setShowSimulatorChooser(true);
  };

  const enterSulamericaSimulator = () => {
    cleanupSimulatorUi();
    setShowSimulatorChooser(false);
    setSulamericaFrameKey((prev) => prev + 1);
    setActiveMenu("Simulador SulAmerica");
  };

  const enterAmilSimulator = () => {
    cleanupSimulatorUi();
    amilLoginSubmittedRef.current = false;
    setShowSimulatorChooser(false);
    setActiveMenu("Simulador Amil");
  };

  const enterMedseniorSimulator = () => {
    cleanupSimulatorUi();
    setShowSimulatorChooser(false);
    setActiveMenu("Simulador Medsenior");
  };

  const enterKliniSimulator = () => {
    cleanupSimulatorUi();
    setShowSimulatorChooser(false);
    setActiveMenu("Simulador Klini");
  };



  const fillAndSubmitAmilLogin = () => {
    const frame = amilIframeRef.current;
    if (!frame) {
      return;
    }

    const applyCredentials = () => {
      try {
        const frameDocument = frame.contentDocument;
        if (!frameDocument) {
          return;
        }

        // Auto-accept cookies
        try {
          const oneTrustBtn = frameDocument.querySelector<HTMLElement>("#onetrust-accept-btn-handler");
          if (oneTrustBtn) oneTrustBtn.click();

          const buttons = Array.from(frameDocument.querySelectorAll("button, a"));
          buttons.forEach((btn) => {
            const htmlBtn = btn as HTMLElement;
            const text = (htmlBtn.textContent || "").toLowerCase().trim();
            if (
              text === "aceitar todos" ||
              text === "aceitar cookies" ||
              text === "concordar e fechar"
            ) {
              htmlBtn.click();
            }
          });
        } catch (e) {}

        const loginInput = frameDocument.querySelector<HTMLInputElement>("#login");
        const senhaInput = frameDocument.querySelector<HTMLInputElement>("#senha");
        const perfilInput = frameDocument.querySelector<HTMLInputElement>("#perfilUsuario");
        const entrarButton = frameDocument.querySelector<HTMLButtonElement>("#efetuarLogin");

        if (!loginInput || !senhaInput) {
          return;
        }

        const updateInput = (input: HTMLInputElement, value: string) => {
          input.value = value;
          input.setAttribute("autocomplete", "off");
          input.setAttribute("data-lpignore", "true");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };

        updateInput(loginInput, AMIL_LOGIN);
        updateInput(senhaInput, AMIL_PASSWORD);

        if (perfilInput && !perfilInput.value) {
          updateInput(perfilInput, "CORRETOR");
        }

        if (amilLoginSubmittedRef.current) {
          return;
        }

        amilLoginSubmittedRef.current = true;
        senhaInput.focus();
        ["keydown", "keypress", "keyup"].forEach((eventName) => {
          senhaInput.dispatchEvent(
            new KeyboardEvent(eventName, {
              bubbles: true,
              cancelable: true,
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
            })
          );
        });

        window.setTimeout(() => {
          entrarButton?.click();
        }, 250);

        window.setTimeout(() => {
          const form = frameDocument.querySelector<HTMLFormElement>("#formLoginCorretor");
          if (form && frame.contentWindow?.location.href.includes("/login")) {
            form.submit();
          }
        }, 1400);
      } catch (_error) {}
    };

    applyCredentials();
    [350, 900, 1800, 3200].forEach((delay) => window.setTimeout(applyCredentials, delay));
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
  };

  const handleSimulatorIframeError = () => {
    openSimulatorExternally("iframe-error", simulatorBrowser);
  };

  const cleanupSimulatorUi = () => {
    clearSimulatorTimeout();
    simulatorIframeLoadedRef.current = false;
    setSimulatorMode("idle");
    setSimulatorStatusMessage("");
    setSimulatorBrowser("other");
  };

  const resetSulamericaProxySession = async () => {
    try {
      await fetch("/sulamerica-proxy/__reset__", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (error) {
      console.warn("Não foi possível resetar a sessão do proxy SulAmerica.", error);
    } finally {
      setSulamericaFrameKey((prev) => prev + 1);
    }
  };

  const shouldResetSulamericaSession = (nextMenu?: string) =>
    activeMenu === "Simulador SulAmerica" && nextMenu !== "Simulador SulAmerica";

  const clearLocalUiState = () => {
    setShowSimulatorChooser(false);
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
    };
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      if (shouldResetSulamericaSession()) {
        await resetSulamericaProxySession();
      }
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

  const handleMenuClick = async (title: string) => {
    if (title === "Simuladores") {
      if (shouldResetSulamericaSession("Simuladores")) {
        await resetSulamericaProxySession();
      }
      cleanupSimulatorUi();
      openSimulatorChooser();
      return;
    }

    if (shouldResetSulamericaSession(title)) {
      await resetSulamericaProxySession();
    }

    if (activeMenu === "Simuladores" || activeMenu === "Simulador SulAmerica" || activeMenu === "Simulador Amil" || activeMenu === "Simulador Medsenior" || activeMenu === "Simulador Klini") {
      cleanupSimulatorUi();
    }

    setShowSimulatorChooser(false);
    setActiveMenu(title);
  };

  const handleCardClick = async (line1: string, line2: string) => {
    if (line1 === "Sistemas") {
      setShowSistemasChooser(true);
      return;
    }

    if (line1 === "Links") {
      setLinksDesktopStatus("");
      setShowLinksChooser(true);
      return;
    }

    if (line1 === "Simuladores") {
      if (shouldResetSulamericaSession("Simuladores")) {
        await resetSulamericaProxySession();
      }
      cleanupSimulatorUi();
      openSimulatorChooser();
      return;
    }

    if (line1 === "Meus" && line2 === "clientes") {
      if (shouldResetSulamericaSession("Meus clientes")) {
        await resetSulamericaProxySession();
      }
      if (activeMenu === "Simuladores" || activeMenu === "Simulador SulAmerica" || activeMenu === "Simulador Amil" || activeMenu === "Simulador Medsenior" || activeMenu === "Simulador Klini") {
        cleanupSimulatorUi();
      }
      setShowSimulatorChooser(false);
      setActiveMenu("Meus clientes");
      return;
    }

    if (line1 === "Agenda") {
      if (shouldResetSulamericaSession("Agenda")) {
        await resetSulamericaProxySession();
      }
      setShowSimulatorChooser(false);
      setActiveMenu("Agenda");
      return;
    }

    if (line1 === "Webmail") {
      if (shouldResetSulamericaSession("Webmail")) {
        await resetSulamericaProxySession();
      }
      setShowSimulatorChooser(false);
      setActiveMenu("Webmail");
      return;
    }

    if (line1 === "Campanhas") {
      if (shouldResetSulamericaSession("Campanhas")) {
        await resetSulamericaProxySession();
      }
      setShowSimulatorChooser(false);
      setActiveMenu("Campanhas");
      return;
    }
  };

  const menuItems = [
    { title: "Home", icon: Home },
    { title: "Meus clientes", icon: Briefcase },
    { title: "Agenda", icon: Calendar },
    { title: "Simuladores", icon: FolderOpen },
    { title: "Webmail", icon: Mail },
    { title: "Campanhas", icon: Megaphone },
    { title: "Financeiro", icon: Banknote },
    { title: "Configurações", icon: Wrench },
  ];

  const cards = [
    { line1: "Meus", line2: "clientes", icon: Briefcase },
    { line1: "Agenda", line2: "", icon: Calendar },
    { line1: "Simuladores", line2: "", icon: FolderOpen },
    { line1: "Sistemas", line2: "", icon: Layers },
    { line1: "Links", line2: "", icon: Link2 },
    { line1: "Webmail", line2: "", icon: Mail },
    { line1: "Campanhas", line2: "", icon: Megaphone },
    { line1: "Financeiro", line2: "", icon: Banknote },
    { line1: "Configurar", line2: "", icon: Wrench },
  ];

  const updateAgendaReminderState = (updater: (state: AgendaReminderState) => AgendaReminderState) => {
    setAgendaReminderState((current) => {
      const next = updater(current);
      saveAgendaReminderState(next);
      return next;
    });
  };

  const closeAgendaReminder = () => {
    if (!activeAgendaReminder) return;

    const phase = activeAgendaReminder.phase === "before" ? "before" : "due";
    updateAgendaReminderState((state) => {
      const current = state[activeAgendaReminder.agendamento.id_agendamento] || {};
      return {
        ...state,
        [activeAgendaReminder.agendamento.id_agendamento]: {
          ...current,
          dismissedPhases: Array.from(new Set([...(current.dismissedPhases || []), phase])),
          snoozedUntil: undefined,
        },
      };
    });
    setActiveAgendaReminder(null);
  };

  const snoozeAgendaReminder = () => {
    if (!activeAgendaReminder) return;

    const minutes = Number(reminderSnoozeMinutes) || 5;
    const snoozedUntil = Date.now() + minutes * 60 * 1000;

    updateAgendaReminderState((state) => ({
      ...state,
      [activeAgendaReminder.agendamento.id_agendamento]: {
        ...(state[activeAgendaReminder.agendamento.id_agendamento] || {}),
        snoozedUntil,
      },
    }));
    setActiveAgendaReminder(null);
  };

  const discardAllAgendaReminders = () => {
    const todayKey = getLocalDateKey();
    updateAgendaReminderState((state) => {
      const next = { ...state };
      agendamentos.forEach((agendamento) => {
        if (String(agendamento.data_agendamento || "").slice(0, 10) !== todayKey) return;
        next[agendamento.id_agendamento] = {
          ...(next[agendamento.id_agendamento] || {}),
          dismissedPhases: ["before", "due"],
          snoozedUntil: undefined,
        };
      });
      return next;
    });
    setActiveAgendaReminder(null);
  };

  const agendaItems = agendamentos
    .filter((agendamento) => String(agendamento.data_agendamento || "").slice(0, 10) === getLocalDateKey())
    .map((agendamento) => {
      const appointmentAt = parseAgendamentoDateTime(agendamento);
      const reminderState = agendaReminderState[agendamento.id_agendamento] || {};
      const isLate = appointmentAt ? appointmentAt.getTime() < Date.now() : false;
      const hasBeenSnoozed = Boolean(reminderState.snoozedUntil);

      return {
        id: agendamento.id_agendamento,
        name: agendamento.cliente_nome || "Cliente",
        phone: agendamento.telefone_celular || agendamento.telefone_residencial || "-",
        time: agendamento.hora_inicio?.slice(0, 5) || "--:--",
        endTime: agendamento.hora_fim?.slice(0, 5) || "",
        status: agendamento.observacao || "compromisso",
        highlight: isLate && hasBeenSnoozed,
        sortTime: appointmentAt?.getTime() || 0,
      };
    })
    .sort((a, b) => a.sortTime - b.sortTime);

  const showSimulator = activeMenu === "Simuladores";
  const showSulamericaSimulator = activeMenu === "Simulador SulAmerica";
  const showAmilSimulator = activeMenu === "Simulador Amil";
  const showMedseniorSimulator = activeMenu === "Simulador Medsenior";
  const showKliniSimulator = activeMenu === "Simulador Klini";
  const showClientArea = activeMenu === "Meus clientes";
  const showAgendaArea = activeMenu === "Agenda";
  const showWebmailArea = activeMenu === "Webmail";
  const showCampanhasArea = activeMenu === "Campanhas";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F0F4F8] font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="w-full flex-shrink-0 bg-[#0c1826] shadow-xl lg:w-48 lg:z-20 lg:flex lg:flex-col lg:justify-between lg:h-screen">
        <div className="lg:flex lg:flex-col lg:min-h-0 lg:flex-1">
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

          <div className="custom-scrollbar flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-0 lg:overflow-y-auto lg:px-0 lg:py-4 lg:flex-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeMenu === item.title ||
                (item.title === "Simuladores" &&
                  (activeMenu === "Simulador SulAmerica" || activeMenu === "Simulador Amil" || activeMenu === "Simulador Medsenior" || activeMenu === "Simulador Klini"));

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => void handleMenuClick(item.title)}
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
        </div>

        {/* Sidebar Footer with Version */}
        <div className="hidden border-t border-slate-800 px-6 py-4 text-center lg:block bg-[#09111c] shrink-0">
          <span className="text-xs font-semibold text-gray-500 tracking-wider">
            Versão: {APP_VERSION}
          </span>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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
            {showClientArea || showSimulator || showSulamericaSimulator || showAmilSimulator || showMedseniorSimulator || showKliniSimulator || showAgendaArea || showWebmailArea || showCampanhasArea ? (
              <button
                type="button"
                onClick={() => void handleMenuClick("Home")}
                className="flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 transition-colors hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
              >
                <Home size={18} />
                <span className="text-sm font-semibold">Menu Principal</span>
              </button>
            ) : null}

            <button
              type="button"
              aria-label="WhatsApp"
              onClick={() => void handleMenuClick("Campanhas")}
              className={`flex min-h-11 items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-4 py-2 text-[#128C7E] transition-all hover:bg-[#25D366]/20 active:scale-95 cursor-pointer ${
                activeMenu === "Campanhas" ? "ring-2 ring-[#25D366] ring-offset-2" : ""
              }`}
            >
              <WhatsAppIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">WhatsApp</span>
            </button>

            <button
              onClick={() => void handleMenuClick("Agenda")}
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                      ref={simulatorIframeRef}
                      key={simulatorFrameKey}
                      src={getSimulatorFrameUrl()}
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
                      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
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
                          <button
                            type="button"
                            onClick={() => {
                              cleanupSimulatorUi();
                              setActiveMenu("Home");
                            }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <Home size={17} />
                            Menu Principal
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
            ) : showSulamericaSimulator ? (
              <div className="flex flex-1 flex-col bg-white" style={{ height: "calc(100vh - 120px)" }}>
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <ExternalLink size={14} />
                    Simulador SulAmerica
                  </span>
                  <a
                    href={SULAMERICA_SIMULATOR_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                  >
                    Abrir em nova janela
                    <ExternalLink size={13} />
                  </a>
                </div>
                <iframe
                  key={sulamericaFrameKey}
                  src={SULAMERICA_PROXY_LOGIN_URL}
                  title="Simulador SulAmerica"
                  className="h-full w-full flex-1 border-none"
                  allow="geolocation; microphone; camera; payment; encrypted-media"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
                />
              </div>
            ) : showAmilSimulator ? (
              <div className="flex flex-1 flex-col bg-white" style={{ height: "calc(100vh - 120px)" }}>
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <ExternalLink size={14} />
                    Simulador Amil
                  </span>
                  <a
                    href={AMIL_SIMULATOR_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                  >
                    Abrir portal Amil
                    <ExternalLink size={13} />
                  </a>
                </div>
                <iframe
                  ref={amilIframeRef}
                  src={AMIL_PROXY_LOGIN_URL}
                  title="Simulador Amil"
                  className="h-full w-full flex-1 border-none"
                  allow="geolocation; microphone; camera; payment; encrypted-media"
                  onLoad={fillAndSubmitAmilLogin}
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
                />
              </div>
            ) : showMedseniorSimulator ? (
              <div className="flex flex-1 flex-col bg-white" style={{ height: "calc(100vh - 120px)" }}>
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <ExternalLink size={14} />
                    Simulador Medsenior
                  </span>
                  <a
                    href={MEDSENIOR_SIMULATOR_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                  >
                    Abrir portal Medsenior
                    <ExternalLink size={13} />
                  </a>
                </div>
                <iframe
                  src={MEDSENIOR_SIMULATOR_URL}
                  title="Simulador Medsenior"
                  className="h-full w-full flex-1 border-none bg-white"
                  allow="geolocation; microphone; camera; payment; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : showKliniSimulator ? (
              <div className="flex flex-1 flex-col bg-white" style={{ height: "calc(100vh - 120px)" }}>
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    <ExternalLink size={14} />
                    Simulador Klini
                  </span>
                  <a
                    href={KLINI_SIMULATOR_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                  >
                    Abrir portal Klini
                    <ExternalLink size={13} />
                  </a>
                </div>
                <iframe
                  src={KLINI_SIMULATOR_URL}
                  title="Simulador Klini"
                  className="h-full w-full flex-1 border-none bg-white"
                  allow="geolocation; microphone; camera; payment; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : showClientArea ? (
              <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
                <ClientRegistrationMultipage />
              </div>
            ) : showWebmailArea ? (
              <React.Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center bg-white">
                    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                      <Loader2 size={18} className="animate-spin text-[#b58c2a]" />
                      Carregando Webmail...
                    </div>
                  </div>
                }
              >
                <RCWebmail
                  userId={perfil?.id || session?.user?.id || null}
                  userEmail={perfil?.email || session?.user?.email || null}
                  redirectMessageId={webmailRedirectMessageId}
                  onClearRedirectMessageId={() => setWebmailRedirectMessageId(null)}
                  lastInboxUpdateTimestamp={lastInboxUpdateTimestamp}
                />
              </React.Suspense>
            ) : showCampanhasArea ? (
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden h-[calc(100vh-120px)] lg:h-[calc(100vh-64px)]">
                <CampanhasShell
                  userId={perfil?.id || session?.user?.id || null}
                  userEmail={perfil?.email || session?.user?.email || null}
                  initialMessage={campanhaInitialMessage}
                />
                {/*
              <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-6">
                <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
                  <div className="h-2 bg-gradient-to-r from-[#b58c2a] to-[#d4af37]" />
                  <div className="p-10 text-center">
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#b58c2a]/10 text-[#b58c2a] ring-8 ring-[#b58c2a]/5">
                      <Megaphone size={44} strokeWidth={1.5} />
                    </div>
                    <h3 className="mb-4 text-2xl font-black tracking-tight text-[#0c1826]">
                      Campanhas
                    </h3>
                    <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-gray-500">
                      O módulo de campanhas está em desenvolvimento. Em breve você poderá criar e gerenciar campanhas de marketing direto para seus clientes.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-[#b58c2a]">E-mail Marketing</p>
                        <p className="mt-1 text-sm text-slate-500">Envio em massa para sua base de clientes</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-[#b58c2a]">WhatsApp</p>
                        <p className="mt-1 text-sm text-slate-500">Disparos automáticos via WhatsApp Business</p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-[#b58c2a]">Aniversários</p>
                        <p className="mt-1 text-sm text-slate-500">Parabéns automático para clientes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                */}
              </div>
            ) : activeMenu === "Agenda" ? (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <Agenda
                  aniversariantesMes={aniversariantesMes}
                  onAgendamentosChanged={() => {
                    void (window as any).__rcMolinaRefreshAgendamentos?.();
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
                <div className="flex flex-col gap-3">
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
                    {cards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <button
                          key={`${card.line1}-${card.line2}`}
                          type="button"
                          id={card.line1 === "Meus" && card.line2 === "clientes" ? "card-meus-clientes" : undefined}
                          onClick={() => void handleCardClick(card.line1, card.line2)}
                          className="group flex h-auto min-h-[76px] overflow-hidden bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex w-2/3 flex-col justify-center border-l-4 border-transparent p-3 transition-all group-hover:border-[#b58c2a]">
                            <span className="text-xs leading-tight text-[#a48641] transition-colors group-hover:text-[#8e733b]">
                              {card.line1}
                            </span>
                            {card.line2 ? (
                              <span className="text-xs font-bold leading-tight text-[#8e733b]">
                                {card.line2}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex w-1/3 items-center justify-center bg-[#a2812a] text-white transition-colors group-hover:bg-[#8f7124]">
                            <Icon
                              size={24}
                              strokeWidth={1.5}
                              className="transition-transform duration-300 group-hover:scale-110"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row">
                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        {/* Header Section */}
                        <div className="relative overflow-hidden bg-[#0c1826] p-3 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Aniversariantes do mês
                              </p>
                              <h2 className="mt-0.5 text-xl font-black tracking-tight">{currentMonthName()}</h2>
                              <p className="mt-0.5 text-[10px] font-medium text-white/50">
                                {isLoadingAniversariantes
                                  ? "Carregando registros..."
                                  : `${aniversariantesMes.filter(c => {
                                      const d = new Date(c.data_nascimento);
                                      return !isNaN(d.getTime()) && d.getUTCMonth() === new Date().getMonth();
                                    }).length} clientes celebram este mês`}
                              </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <PartyPopper size={20} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        {/* List Section */}
                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2">
                          {(() => {
                            const currentMonth = new Date().getMonth();
                            const filtered = aniversariantesMes
                              .filter(c => {
                                const d = new Date(c.data_nascimento);
                                return !isNaN(d.getTime()) && d.getUTCMonth() === currentMonth;
                              })
                              .sort((a, b) => {
                                const dayA = new Date(a.data_nascimento).getUTCDate();
                                const dayB = new Date(b.data_nascimento).getUTCDate();
                                const today = new Date().getDate();
                                
                                const distA = Math.abs(dayA - today);
                                const distB = Math.abs(dayB - today);
                                
                                if (distA === distB) {
                                  return dayA >= today ? -1 : 1;
                                }
                                
                                return distA - distB;
                              });

                            if (filtered.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                                    <PartyPopper size={22} />
                                  </div>
                                  <p className="text-xs font-bold text-slate-400">Nenhum aniversariante encontrado</p>
                                  <p className="mt-1 text-xs text-slate-400/80">para o mês de {currentMonthName().toLowerCase()}.</p>
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col gap-1.5">
                                {filtered.map((cliente) => {
                                  const bDate = new Date(cliente.data_nascimento);
                                  const isToday = bDate.getUTCDate() === new Date().getDate() && bDate.getUTCMonth() === currentMonth;
                                  
                                  return (
                                    <div
                                      key={cliente.codigo}
                                      onClick={() => {
                                        if (isToday) {
                                          const nomeFormatado = cliente.nome_completo
                                            .trim()
                                            .split(" ")
                                            .filter(Boolean)
                                            .map((word) => {
                                              const lower = word.toLowerCase();
                                              if (["de", "da", "do", "dos", "das", "e"].includes(lower)) return lower;
                                              return lower.charAt(0).toUpperCase() + lower.slice(1);
                                            })
                                            .join(" ");
                                            
                                          setCampanhaInitialMessage(`Olá, *${nomeFormatado}* `);
                                          handleMenuClick("Campanhas");
                                        }
                                      }}
                                      className={`group relative overflow-hidden rounded-lg border border-white bg-white px-2.5 py-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d4af37]/30 hover:shadow-md ${
                                        isToday ? "ring-2 ring-[#d4af37]/20 bg-[#fffaf0]/50 cursor-pointer" : ""
                                      }`}
                                    >
                                      {isToday && (
                                        <div className="absolute right-0 top-0 rounded-bl-xl bg-[#d4af37] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white animate-pulse">
                                          Hoje
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2.5">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                                          isToday ? "bg-[#d4af37] text-white shadow-lg shadow-[#d4af37]/20" : "bg-[#d4af37]/10 text-[#a2812a] group-hover:bg-[#d4af37]/20"
                                        }`}>
                                          <PartyPopper size={14} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-bold text-[#0c1826] transition-colors group-hover:text-[#a2812a]">
                                            {cliente.nome_completo}
                                          </p>
                                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                            <span className="font-bold text-[#a2812a]">{formatBirthDate(cliente.data_nascimento)}</span>
                                            {cliente.cidade && (
                                              <>
                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                <span className="truncate">{cliente.cidade}{cliente.uf ? `/${cliente.uf}` : ""}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </section>

                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        {/* Header Section */}
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Agenda do dia
                              </p>
                              <h2 className="mt-0.5 text-2xl font-black tracking-tight">{new Date().getDate()} de {currentMonthName()}</h2>
                              <p className="mt-1 text-[11px] font-medium text-white/50">
                                Tarefas programadas
                              </p>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <Calendar size={22} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        {/* List Section */}
                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
                          <div className="flex flex-col gap-2">
                            {agendaItems.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                                  <Calendar size={22} />
                                </div>
                                <p className="text-xs font-bold text-slate-400">Nenhum compromisso para hoje</p>
                                <p className="mt-1 text-xs text-slate-400/80">Os lembretes aparecem automaticamente.</p>
                              </div>
                            ) : null}
                            {agendaItems.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => handleMenuClick("Agenda")}
                                className={`group relative hover:z-30 rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                                  item.highlight 
                                    ? "ring-2 ring-red-500/20 bg-red-50/50 hover:border-red-300" 
                                    : "hover:border-[#d4af37]/30"
                                }`}
                              >
                                {item.highlight && (
                                  <div className="absolute right-0 top-0 rounded-tr-xl rounded-bl-xl bg-red-500 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white animate-pulse">
                                    Atrasado
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-full transition-all duration-300 ${
                                    item.highlight 
                                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                                      : "bg-[#d4af37]/10 text-[#a2812a] group-hover:bg-[#d4af37]/20"
                                  }`}>
                                    <User size={14} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className={`max-w-full ${item.highlight ? "pr-16" : ""}`}>
                                      <p
                                        className={`truncate text-[11px] font-bold leading-4 transition-colors ${
                                          item.highlight ? "text-red-700" : "text-[#0c1826] group-hover:text-[#a2812a]"
                                        }`}
                                      >
                                        {item.name}
                                      </p>
                                    </div>
                                    <div className="mt-0.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                      <div className="flex items-center gap-1">
                                        <Phone size={11} className={item.highlight ? "text-red-400" : ""} />
                                        <span className={`whitespace-nowrap ${item.highlight ? "text-red-600" : "text-slate-500"}`}>{item.phone}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`font-bold ${item.highlight ? "text-red-600" : "text-[#a2812a]"}`}>{item.time}</span>
                                        <span className={`max-w-[92px] truncate ${item.highlight ? "text-red-500" : "text-slate-400"}`}>{item.status}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                    
                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        {/* Header Section */}
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Clientes da Corretora
                              </p>
                              <h2 className="mt-0.5 text-2xl font-black tracking-tight">{clientStats.total}</h2>
                              <p className="mt-1 text-[11px] font-medium text-white/50">
                                {isLoadingClientStats ? "Calculando clientes..." : "Total de clientes registrados"}
                              </p>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <Users size={22} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        {/* List Section */}
                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
                          <div className="flex flex-col gap-2">
                            {/* Ativos */}
                            <div className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#25D366]/30 hover:shadow-md">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C7E] transition-all duration-300 group-hover:bg-[#25D366]/20">
                                  <User size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-[#0c1826] transition-colors group-hover:text-[#128C7E]">
                                    Clientes Ativos
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    <span className="font-bold text-[#128C7E]">{clientStats.ativos}</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>{clientStats.total > 0 ? Math.round((clientStats.ativos / clientStats.total) * 100) : 0}% do total</span>
                                  </div>
                                </div>
                              </div>
                              {/* Barra de progresso visual */}
                              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div 
                                  className="h-full bg-[#25D366] transition-all duration-1000" 
                                  style={{ width: `${clientStats.total > 0 ? (clientStats.ativos / clientStats.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Inativos */}
                            <div className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-400/30 hover:shadow-md">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-all duration-300 group-hover:bg-red-100">
                                  <User size={16} className="opacity-60" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-[#0c1826] transition-colors group-hover:text-red-600">
                                    Clientes Inativos
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    <span className="font-bold text-red-500">{clientStats.inativos}</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>{clientStats.total > 0 ? Math.round((clientStats.inativos / clientStats.total) * 100) : 0}% do total</span>
                                  </div>
                                </div>
                              </div>
                              {/* Barra de progresso visual */}
                              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div 
                                  className="h-full bg-red-400 transition-all duration-1000" 
                                  style={{ width: `${clientStats.total > 0 ? (clientStats.inativos / clientStats.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  {canViewSystemUsers ? (
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="relative overflow-hidden bg-[#0c1826] px-5 py-4 text-white">
                        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                        <div className="relative flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                              Usuários do banco
                            </p>
                            <h2 className="mt-0.5 text-2xl font-black tracking-tight">
                              {isLoadingSystemUsers ? "Carregando..." : `${systemUsers.length} usuários`}
                            </h2>
                            <p className="mt-1 text-[11px] font-medium text-white/50">
                              Visualizacao liberada para {USERS_VIEWER_FULL_NAME}
                            </p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                            <Users size={22} strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>

                      <div className="custom-scrollbar max-h-[360px] overflow-y-auto bg-slate-50/50 p-3">
                        {systemUsersError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {systemUsersError}
                          </div>
                        ) : isLoadingSystemUsers ? (
                          <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <div
                                key={`system-user-skeleton-${index}`}
                                className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white"
                              />
                            ))}
                          </div>
                        ) : systemUsers.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                            Nenhum usuário encontrado.
                          </div>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {systemUsers.map((systemUser) => (
                              <article
                                key={systemUser.id}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-[#0c1826]">
                                      {systemUser.nome_completo}
                                    </p>
                                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                      {systemUser.email}
                                    </p>
                                  </div>
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4af37]/10 text-[#a2812a]">
                                    <Users size={15} />
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-600">
                                    {systemUser.organizacao || "Sem organizacao"}
                                  </span>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSimulatorChooser ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#b58c2a]">
                  Simuladores
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#0c1826]">Escolha seu Simulador</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulatorChooser(false)}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-6">
              <a
                href="#simulador-online"
                onClick={(event) => {
                  event.preventDefault();
                  void enterSimulator();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md"
              >
                <img src="/quer.svg" alt="Simulador Quer" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>

              <a
                href={SULAMERICA_SIMULATOR_URL}
                onClick={(event) => {
                  event.preventDefault();
                  enterSulamericaSimulator();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md"
              >
                <img src="/sulamerica.svg" alt="Simulador SulAmérica" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>

              <a
                href={AMIL_SIMULATOR_URL}
                onClick={(event) => {
                  event.preventDefault();
                  enterAmilSimulator();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md"
              >
                <img src="/amil.svg" alt="Simulador Amil" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>

              <a
                href={MEDSENIOR_SIMULATOR_URL}
                onClick={(event) => {
                  event.preventDefault();
                  enterMedseniorSimulator();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md"
              >
                <img src="/medsenior.svg" alt="Simulador MedSênior" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>

              <a
                href={KLINI_SIMULATOR_URL}
                onClick={(event) => {
                  event.preventDefault();
                  enterKliniSimulator();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md"
              >
                <img src="/klini.svg" alt="Simulador Klini" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>

              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                }}
                className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md cursor-pointer"
              >
                <img src="/solutions.svg" alt="Simulador Solutions" className="max-h-20 max-w-[85%] object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {showSistemasChooser ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 shrink-0">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#b58c2a]">
                  Sistemas
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#0c1826]">Escolha o Sistema</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSistemasChooser(false)}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 overflow-y-auto custom-scrollbar">
              {[
                { name: "AMIL", url: "https://comercial.amil.com.br/prweb/PRAuth/app/sales-experience/", type: "internal", action: enterAmilSimulator },
                { name: "KLINI SAUDE", url: "https://klinisaude.hcommerce.com.br/corretora/login", type: "internal", action: enterKliniSimulator },
                { name: "MEDSENIOR", url: "https://vendadigital.medsenior.com.br/", type: "internal", action: enterMedseniorSimulator },
                { name: "SULAMERICA", url: "https://os11.sulamerica.com.br/SaudeCotador/LoginVendedor.aspx", type: "internal", action: enterSulamericaSimulator },
              ].map((sys) => (
                <button
                  key={sys.name}
                  type="button"
                  onClick={() => {
                    setShowSistemasChooser(false);
                    if (sys.type === "internal" && sys.action) {
                      sys.action();
                    } else {
                      window.open(sys.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md text-left w-full cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b58c2a]/10 text-[#b58c2a] font-bold text-sm tracking-wider">
                      {sys.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0c1826] group-hover:text-[#b58c2a] transition-colors">
                        {sys.name}
                      </p>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                        Simulador Interno
                      </span>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#b58c2a]/10 group-hover:text-[#b58c2a] transition-all">
                    <ExternalLink size={14} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showLinksChooser ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 shrink-0">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#b58c2a]">
                  Links
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#0c1826]">Escolha o Portal</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinksDesktopStatus("");
                  setShowLinksChooser(false);
                }}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {linksDesktopStatus ? (
              <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {linksDesktopStatus}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-6 overflow-y-auto custom-scrollbar">
              {[
                { name: "ALLCARE PORTAL", url: "https://portal.allcare.com.br/" },
                { name: "ALLCARE VENDAS", url: "https://vendas.allcare.com.br/AllTechLoginVendas" },
                { name: "ALLCARE WEB", url: "https://allcare.planium.io/web/login/entrar" },
                { name: "ASSIM SAUDE", url: "https://assim.hcommerce.com.br/login" },
                { name: "CONTEM ADMINISTRADORA", url: "https://digitalsaude.com.br/canal/contem" },
                { name: "CORPE SAUDE", url: "https://contratacao.mktss.com.br/#/login" },
                { name: "HAPVIDA", url: "https://gndi.planium.io/web/login/" },
                { name: "LEVE SAUDE", url: "https://levesaude.planium.io/web/login/entrar" },
                { name: "PLURAL", url: "https://plural.hcommerce.com.br/login" },
                { name: "PORTO SEGURO", url: "https://corretor.portoseguro.com.br/portal/site/corretoronline/template.LOGIN/" },
                { name: "QUALIVENDAS", url: "https://qualivendas.qualicorp.com.br/#/login" },
                { name: "SOLUTIONS", url: "https://solutions.hcommerce.com.br/login" },
                { name: "SUPERMED", url: "https://vendas.supermed.com.br/login" },
              ].map((sys) => (
                <button
                  key={sys.name}
                  type="button"
                  onClick={(event) => {
                    const anchorRect = event.currentTarget.getBoundingClientRect();
                    setShowLinksChooser(false);
                    void openPortalInDesktop(sys.url, anchorRect);
                  }}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md text-left w-full cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b58c2a]/10 text-[#b58c2a] font-bold text-sm tracking-wider">
                      {sys.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0c1826] group-hover:text-[#b58c2a] transition-colors">
                        {sys.name}
                      </p>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                        Abrir no desktop
                      </span>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#b58c2a]/10 group-hover:text-[#b58c2a] transition-all">
                    <ExternalLink size={14} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating Notifications Container for New Inbox Messages */}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none w-[360px] max-w-[calc(100vw-40px)]">
          {inboxNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                setWebmailRedirectMessageId(notif.id);
                setActiveMenu("Webmail");
                setInboxNotifications((prev) => prev.filter((n) => n.id !== notif.id));
              }}
              className="pointer-events-auto w-full cursor-pointer rounded-xl bg-[#1d1d1f] text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-neutral-850/35 font-sans transition-all duration-300 transform translate-y-0 scale-100 hover:scale-[1.02] flex flex-col overflow-hidden"
              style={{ animation: 'fade-in 0.3s ease-out forwards' }}
            >
              {/* Title Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#141416] border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="bg-[#0078d4] p-1 rounded-md shadow-sm">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-neutral-300 tracking-wide">RC Webmail</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInboxNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                  }}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content Area */}
              <div className="flex gap-3.5 p-4 items-start bg-[#1c1c1e]">
                <div className="w-12 h-12 rounded-full bg-neutral-700/60 border border-neutral-600 flex-shrink-0 flex items-center justify-center text-lg font-black text-white shadow-inner select-none">
                  {senderInitial(notif.from)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white tracking-wide truncate">{compactSender(notif.from)}</h4>
                  <p className="text-xs font-semibold text-neutral-200 mt-0.5 truncate">{notif.subject || '(Sem assunto)'}</p>
                  <p className="text-[11px] text-neutral-400 mt-1 line-clamp-3 leading-relaxed break-words font-medium">
                    {notif.snippet || 'Sem prévia.'}
                  </p>
                </div>
              </div>

              {/* Dismiss bottom bar */}
              <div
                className="flex justify-center py-2 bg-[#141416]/80 hover:bg-[#141416] border-t border-neutral-800/40 cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setInboxNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                }}
              >
                <svg className="w-4 h-4 text-neutral-400 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}

      {activeAgendaReminder
        ? createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-700 bg-[#242424] text-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 bg-[#202020] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-[#d4af37]" />
                    <span className="text-sm font-semibold">1 Lembrete(s)</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar lembrete"
                    onClick={closeAgendaReminder}
                    className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center border border-white/70 text-white">
                      <Calendar size={23} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-medium leading-tight animate-pulse-attention">
                        {activeAgendaReminder.agendamento.observacao ||
                          activeAgendaReminder.agendamento.cliente_nome ||
                          "Compromisso da agenda"}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-white">
                        {formatReminderDate(activeAgendaReminder.appointmentAt)}
                      </p>
                      <p className="mt-2 text-sm text-white/75">
                        {activeAgendaReminder.phase === "before"
                          ? `Faltam ${Math.max(
                              1,
                              Math.ceil((activeAgendaReminder.appointmentAt.getTime() - Date.now()) / 60000)
                            )} minutos para o compromisso.`
                          : "O horario marcado para este compromisso chegou."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 min-h-[112px] border border-white/35 bg-[#1f1f1f]">
                    <div className="flex items-center justify-between bg-[#0078d4] px-2 py-1 text-xs font-bold">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Calendar size={13} />
                        <span className="truncate">
                          {activeAgendaReminder.agendamento.cliente_nome || "Cliente"}
                        </span>
                      </div>
                      <span className="shrink-0 pl-3">
                        {activeAgendaReminder.agendamento.hora_inicio?.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={closeAgendaReminder}
                      className="rounded border border-white/30 px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Descartar
                    </button>
                  </div>

                  <div className="mt-3 text-xs font-semibold text-white">
                    Clique em Adiar para ser lembrado novamente em:
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      value={reminderSnoozeMinutes}
                      onChange={(event) => setReminderSnoozeMinutes(event.target.value)}
                      className="h-8 min-w-[220px] rounded border border-white/40 bg-[#1f1f1f] px-2 text-xs font-semibold text-white outline-none"
                    >
                      <option value="5">5 minutos</option>
                      <option value="10">10 minutos</option>
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="60">1 hora</option>
                    </select>
                    <button
                      type="button"
                      onClick={snoozeAgendaReminder}
                      className="h-8 rounded border border-white/40 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Adiar
                    </button>
                    <button
                      type="button"
                      onClick={discardAllAgendaReminders}
                      className="ml-auto h-8 rounded border border-white/40 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Descartar Tudo
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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

        @keyframes pulse-attention {
          0%, 100% { opacity: 1; transform: scale(1); filter: brightness(1); }
          50% { opacity: 0.9; transform: scale(1.02); filter: brightness(1.2) drop-shadow(0 0 4px rgba(212, 175, 55, 0.4)); text-shadow: 0 0 8px rgba(212, 175, 55, 0.6); }
        }

        .animate-pulse-attention {
          animation: pulse-attention 1.8s ease-in-out infinite;
          display: inline-block;
          color: #fff;
        }

        .animate-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
