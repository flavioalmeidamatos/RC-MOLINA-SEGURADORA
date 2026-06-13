import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
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
  Link2,
  Lock,
  Wrench,
  X,
  Hash,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClientRegistrationMultipage } from "../clientes/client_registration_multipage";
import { Agenda } from "../agenda/agenda";
import type { Agendamento } from "../agenda/agenda";
import { CampanhasShell } from "../campanhas/campanhas_shell";
import { Configuracoes } from "../configuracoes/configuracoes";
import { apiListVisibleUsers, apiListCompanies, apiListCompanyMembers, type Empresa, type EmpresaMembro } from "../../lib/local_api";
import { isMasterAdmin, type LocalAuthSession, type UsuarioPerfil } from "../../lib/local_auth";
import { createGmailApi, type MessageSummary } from "../../lib/gmail_api";
import { APP_VERSION } from "../../version";
import { Monitor, Download } from "lucide-react";

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


const USERS_VIEWER_FULL_NAME = "ROSILENE RODRIGUES DE CARVALHO MOLINA";
const normalizeFullName = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

const GMAIL_INBOX_POLL_INTERVAL_MS = 5000;
const AGENDA_REMINDER_POLL_INTERVAL_MS = 30000;
const AGENDA_REFRESH_INTERVAL_MS = 30000;
const AGENDA_REMINDER_LEAD_MINUTES = 5;
const AGENDA_REMINDER_STORAGE_KEY = "rc_molina_agenda_reminders";

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
  const logoUrl = perfil?.logo_url || null;
  const canViewSystemUsers = normalizeFullName(perfil?.nome_completo || "") === USERS_VIEWER_FULL_NAME;

  const [activeMenu, setActiveMenu] = useState(forcedMenu || "Home");
  const [campanhaInitialMessage, setCampanhaInitialMessage] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [aniversariantesMes, setAniversariantesMes] = useState<AniversarianteMes[]>([]);
  const [isLoadingAniversariantes, setIsLoadingAniversariantes] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendaDate, setAgendaDate] = useState<Date>(new Date());
  const [aniversariantesDate, setAniversariantesDate] = useState<Date>(new Date());
  const [clientToEdit, setClientToEdit] = useState<string | null>(null);
  
  const [showAtrasadosModal, setShowAtrasadosModal] = useState(false);
  const [agendaInitialDate, setAgendaInitialDate] = useState<Date | undefined>(undefined);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalType, setStatusModalType] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [statusModalClientes, setStatusModalClientes] = useState<any[]>([]);
  const [isLoadingStatusModal, setIsLoadingStatusModal] = useState(false);
  const [showRestrictedModal, setShowRestrictedModal] = useState(false);
  const [showNegociacaoModal, setShowNegociacaoModal] = useState(false);
  const [selectedNegociacaoStatus, setSelectedNegociacaoStatus] = useState<string>("");
  const [negociacaoClients, setNegociacaoClients] = useState<any[]>([]);
  const [isLoadingNegociacaoClients, setIsLoadingNegociacaoClients] = useState(false);
  const [negociacaoAlphabetFilter, setNegociacaoAlphabetFilter] = useState<string>("TODOS");

  const openStatusModal = async (status: 'ATIVO' | 'INATIVO') => {
    setStatusModalType(status);
    setShowStatusModal(true);
    setIsLoadingStatusModal(true);
    try {
      const response = await fetch(`/api/clientes/status?s=${status}`);
      if (response.ok) {
        const data = await response.json();
        setStatusModalClientes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStatusModal(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLoggingOutRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (payload.action === 'request_close') {
          setShowLogoutConfirmModal(true);
        }
      } catch { }
    };
    if ((window as any).chrome && (window as any).chrome.webview) {
      (window as any).chrome.webview.addEventListener('message', handleMessage);
    }
    return () => {
      if ((window as any).chrome && (window as any).chrome.webview) {
        (window as any).chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);
  const [agendaReminderState, setAgendaReminderState] = useState<AgendaReminderState>({});
  const [activeAgendaReminder, setActiveAgendaReminder] = useState<ActiveAgendaReminder | null>(null);
  const [reminderSnoozeMinutes, setReminderSnoozeMinutes] = useState("5");
  const [clientStats, setClientStats] = useState({ total: 0, ativos: 0, inativos: 0, leads: 0 });
  const [isLoadingClientStats, setIsLoadingClientStats] = useState(false);
  const [produtosStats, setProdutosStats] = useState<{produto: string, quantidade: number}[]>([]);
  const [isLoadingProdutosStats, setIsLoadingProdutosStats] = useState(false);
  const [negociacaoStats, setNegociacaoStats] = useState<{status: string, quantidade: number}[]>([]);
  const [isLoadingNegociacaoStats, setIsLoadingNegociacaoStats] = useState(false);
  const [systemUsers, setSystemUsers] = useState<UsuarioPerfil[]>([]);
  const [isLoadingSystemUsers, setIsLoadingSystemUsers] = useState(false);
  const [systemUsersError, setSystemUsersError] = useState("");

  const [showLinksChooser, setShowLinksChooser] = useState(false);
  const [activeLinkTab, setActiveLinkTab] = useState<'simuladores' | 'consorcios'>('simuladores');
  const [linksDesktopStatus, setLinksDesktopStatus] = useState("");

  // ── Contexto Master Admin ─────────────────────────────────────────────────
  // Usa perfil OU session.user.email como fallback (perfil pode ser null no primeiro render)
  const masterAdminEmail = (perfil?.email || session?.user?.email || '').toLowerCase().trim();
  const isMasterAdminUser = isMasterAdmin(perfil) || isMasterAdmin(masterAdminEmail);
  const [masterCompanies, setMasterCompanies] = useState<Empresa[]>([]);
  const [masterSelectedCompanyId, setMasterSelectedCompanyId] = useState<string>(() => sessionStorage.getItem('rc_master_company_id') || '');
  const [masterMembers, setMasterMembers] = useState<EmpresaMembro[]>([]);
  const [masterSelectedMemberId, setMasterSelectedMemberId] = useState<string>(() => sessionStorage.getItem('rc_master_member_id') || '');
  const [isLoadingMasterCompanies, setIsLoadingMasterCompanies] = useState(false);
  const [isLoadingMasterMembers, setIsLoadingMasterMembers] = useState(false);
  const [isExternalWebviewOpen, setIsExternalWebviewOpen] = useState(false);
  const [isLinksDesktopWindowOpen, setIsLinksDesktopWindowOpen] = useState(false);

  const linksDesktopMonitorTokenRef = useRef(0);


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
    // Calculamos em coordenadas físicas absolutas da tela (multiplicando pelo DPR do navegador).
    // Enviamos como 'isPhysical: true' para que o agente desktop converta com precisão as coordenadas.
    // Isso elimina qualquer desalinhamento ou divergência de escala em múltiplos monitores com DPRs diferentes.
    const dpr = window.devicePixelRatio || 1;

    const sidebarEl = document.querySelector("aside");
    // Usamos .right para pegar a borda direita exata da sidebar (onde o conteúdo começa)
    const sidebarRight = sidebarEl
      ? Math.round(sidebarEl.getBoundingClientRect().right)
      : 192;

    const headerEl = document.getElementById("main-dashboard-header");
    const headerBottom = headerEl
      ? Math.round(headerEl.getBoundingClientRect().bottom)
      : 64;

    // Largura da borda do navegador (chrome do browser) em pixels CSS
    const viewportLeftOnScreen = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    const viewportTopOnScreen = Math.max(0, window.outerHeight - window.innerHeight);

    // Coordenadas absolutas físicas da tela
    const x = Math.round((window.screenLeft + viewportLeftOnScreen + sidebarRight) * dpr);
    const y = Math.round((window.screenTop + viewportTopOnScreen + headerBottom) * dpr);

    const width = Math.round((window.innerWidth - sidebarRight) * dpr);
    const height = Math.round((window.innerHeight - headerBottom) * dpr);

    return {
      x,
      y,
      width,
      height,
      dpr,
      isPhysical: true,
      anchorSource: "links",
    };
  }

  async function requestDesktopOpen(url: string, anchorRect?: DOMRect, executeScript?: string) {
    const response = await fetch(`${DESKTOP_AGENT_ORIGIN}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        screen: getDesktopScreenHint(anchorRect),
        ...(executeScript ? { executeScript } : {})
      }),
    });

    if (!response.ok) {
      throw new Error("O cliente desktop recusou a abertura da URL.");
    }
  }

  async function isDesktopLinkWindowVisible() {
    const response = await fetch(`${DESKTOP_AGENT_ORIGIN}/window-state`, { cache: "no-store" });
    if (!response.ok) return false;

    const payload = await response.json();
    return Boolean(payload.windowVisible || payload.windowOpen);
  }

  function monitorLinksDesktopWindow() {
    const token = linksDesktopMonitorTokenRef.current + 1;
    linksDesktopMonitorTokenRef.current = token;
    setIsLinksDesktopWindowOpen(true);

    void (async () => {
      let failures = 0;

      while (linksDesktopMonitorTokenRef.current === token) {
        await wait(1000);

        try {
          const isVisible = await isDesktopLinkWindowVisible();
          failures = 0;

          if (!isVisible) {
            setIsLinksDesktopWindowOpen(false);
            return;
          }
        } catch {
          failures += 1;

          if (failures >= 8) {
            setIsLinksDesktopWindowOpen(false);
            return;
          }
        }
      }
    })();
  }

  async function openPortalInDesktop(url: string, anchorRect?: DOMRect, executeScript?: string) {
    setLinksDesktopStatus("Abrindo portal no aplicativo desktop...");

    try {
      await requestDesktopOpen(url, anchorRect, executeScript);
      setLinksDesktopStatus("");
      monitorLinksDesktopWindow();
      return;
    } catch (err) {
      console.warn("[Links] Falha ao conectar ao agente local via HTTP. Usando deep link...", err);
    }

    try {
      const screen = getDesktopScreenHint(anchorRect);
      const scriptParam = executeScript ? `&executeScript=${encodeURIComponent(executeScript)}` : "";
      const deepLinkUrl = `urlembeddiag://?url=${encodeURIComponent(url)}${scriptParam}&x=${screen.x}&y=${screen.y}&width=${screen.width}&height=${screen.height}`;

      setLinksDesktopStatus("Iniciando/Integrando com o aplicativo desktop...");
      window.location.href = deepLinkUrl;

      // Wait a little and clear status
      await wait(2000);
      setLinksDesktopStatus("");
      const isAgentReady = await waitForDesktopAgent(5000);
      if (isAgentReady) {
        monitorLinksDesktopWindow();
      }
    } catch (error) {
      console.warn("[Links] Falha ao abrir via deep link; usando nova aba como contingencia.", error);
      setLinksDesktopStatus("Não foi possível iniciar o desktop automaticamente. Abrindo em nova aba.");
      window.open(url, "_blank", "noopener,noreferrer");
      setIsLinksDesktopWindowOpen(false);
    }
  }

  useEffect(() => {
    return () => {
      linksDesktopMonitorTokenRef.current += 1;
    };
  }, []);

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
    }
  }, [forcedMenu]);


  useEffect(() => {
    let ignore = false;

    const loadAniversariantes = async () => {
      setIsLoadingAniversariantes(true);
      try {
        const response = await fetch(`/api/clientes/aniversariantes-mes?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!response.ok) throw new Error("Falha ao carregar aniversariantes.");
        const data = (await response.json()) as AniversarianteMes[];
        if (!ignore) setAniversariantesMes(Array.isArray(data) ? data : []);
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
        const response = await fetch(`/api/clientes/stats?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!response.ok) throw new Error("Falha ao carregar estatísticas de clientes.");
        const data = await response.json();
        if (!ignore) setClientStats(data);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        if (!ignore) setIsLoadingClientStats(false);
      }
    };

    const loadProdutosStats = async () => {
      setIsLoadingProdutosStats(true);
      try {
        const response = await fetch(`/api/clientes/produtos-stats?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!response.ok) throw new Error("Falha ao carregar estatísticas de produtos.");
        const data = await response.json();
        if (!ignore) setProdutosStats(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      } finally {
        if (!ignore) setIsLoadingProdutosStats(false);
      }
    };

    const loadNegociacaoStats = async () => {
      setIsLoadingNegociacaoStats(true);
      try {
        const response = await fetch(`/api/clientes/negociacao-stats?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!response.ok) throw new Error("Falha ao carregar estatísticas de negociação.");
        const data = await response.json();
        if (!ignore) setNegociacaoStats(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar negociação:", error);
      } finally {
        if (!ignore) setIsLoadingNegociacaoStats(false);
      }
    };

    (window as any).__rcMolinaRefreshClientStats = () => { loadClientStats(); loadProdutosStats(); loadNegociacaoStats(); };

    void loadAniversariantes();
    void loadClientStats();
    void loadProdutosStats();
    void loadNegociacaoStats();

    const intervalId = window.setInterval(() => {
      void loadClientStats();
      void loadProdutosStats();
      void loadNegociacaoStats();
    }, 60000);

    const handleFocus = () => {
      void loadClientStats();
      void loadProdutosStats();
      void loadNegociacaoStats();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadClientStats();
        void loadProdutosStats();
        void loadNegociacaoStats();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if ((window as any).__rcMolinaRefreshClientStats) {
        delete (window as any).__rcMolinaRefreshClientStats;
      }
    };
  }, []);

  useEffect(() => {
    setAgendaReminderState(loadAgendaReminderState());
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadAgendamentos = async (options?: { allowAfterUnmount?: boolean }) => {
      try {
        const response = await fetch(`/api/agendamentos?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isExternalWebviewOpen) {
          closeExternalWebview();
        } else if (showLinksChooser) {
          setShowLinksChooser(false);
          setLinksDesktopStatus("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showLinksChooser, isExternalWebviewOpen]);

  useEffect(() => {
    const clearExternalWebviewState = () => setIsExternalWebviewOpen(false);

    window.addEventListener("rc-external-webview-closed", clearExternalWebviewState);
    return () => {
      window.removeEventListener("rc-external-webview-closed", clearExternalWebviewState);
    };
  }, []);

  const closeExternalWebview = () => {
    if ((window as any).chrome && (window as any).chrome.webview) {
      (window as any).chrome.webview.postMessage(JSON.stringify({ action: "close_external" }));
    }
    setIsExternalWebviewOpen(false);
  };


  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    isLoggingOutRef.current = true;

    // Disable beforeunload to prevent the browser from asking "Leave site?"
    // This usually happens because of unsaved changes in tinyMCE.
    window.onbeforeunload = null;
    if (typeof (window as any).tinymce !== 'undefined') {
      const editors = (window as any).tinymce.editors;
      if (editors) {
        editors.forEach((editor: any) => editor.setDirty(false));
      }
    }

    try {
      onLogout?.();
      window.location.href = "/";
    } catch (_error) {
      onLogout?.();
      window.location.href = "/";
    } finally {
      setIsLoggingOut(false);
    }
  };
  const checkPermission = (menuName: string) => {
    if (menuName === 'Home') return true;
    if (isMasterAdmin(perfil)) {
      return true;
    }
    if (perfil?.permissoes) {
      if (menuName === 'Importações') {
        const hasImportacoes = perfil.permissoes['Importações'] ?? perfil.permissoes['Configurações'] ?? true;
        if (!hasImportacoes) {
          setShowRestrictedModal(true);
          return false;
        }
        return true;
      }
      if (perfil.permissoes[menuName] === false) {
        setShowRestrictedModal(true);
        return false;
      }
    }
    return true;
  };

  const handleMenuClick = async (title: string) => {
    const permTitle = (title === "Importações" || title === "Importações Especiais") ? "Importações" : title;
    if (!checkPermission(permTitle)) return;

    if (title === "Links") {
      setLinksDesktopStatus("");
      setShowLinksChooser(true);
      return;
    }
    if (title === "Importações" || title === "Importações Especiais") {
      setActiveMenu("Configurações");
      return;
    }
    setActiveMenu(title);
  };

  const handleCardClick = async (line1: string, line2: string) => {
    if (line1 === "Links" || line1 === "Sistemas") {
      if (!checkPermission("Links")) return;
      setLinksDesktopStatus("");
      setShowLinksChooser(true);
      return;
    }

    if (line1 === "Meus" && line2 === "clientes") {
      if (!checkPermission("Meus clientes")) return;
      setActiveMenu("Meus clientes");
      return;
    }

    if (line1 === "Agenda") {
      if (!checkPermission("Agenda")) return;
      setActiveMenu("Agenda");
      return;
    }

    if (line1 === "Webmail") {
      if (!checkPermission("Webmail")) return;
      setActiveMenu("Webmail");
      return;
    }

    if (line1 === "Campanhas") {
      if (!checkPermission("Campanhas")) return;
      setActiveMenu("Campanhas");
      return;
    }

    if (line1 === "Configurar" || line1 === "Configurações" || line1 === "Importações Especiais" || line1 === "Importações") {
      if (!checkPermission("Importações")) return;
      setActiveMenu("Configurações");
      return;
    }
    
    if (line1 === "Financeiro") {
      if (!checkPermission("Financeiro")) return;
      setActiveMenu("Financeiro");
      return;
    }
  };

  const handleNegociacaoCardClick = async (status: string, quantidade: number) => {
    if (quantidade === 1) {
      try {
        const response = await fetch(`/api/clientes/by-negociacao?status=${encodeURIComponent(status)}`);
        const data = await response.json();
        if (data && data.length > 0) {
          setClientToEdit(data[0].codigo || data[0].nome_completo);
          setActiveMenu("Meus clientes");
        }
      } catch (e) {
        console.error(e);
      }
    } else if (quantidade > 1) {
      setSelectedNegociacaoStatus(status);
      setShowNegociacaoModal(true);
      setNegociacaoAlphabetFilter("TODOS");
      setIsLoadingNegociacaoClients(true);
      try {
        const response = await fetch(`/api/clientes/by-negociacao?status=${encodeURIComponent(status)}`);
        const data = await response.json();
        setNegociacaoClients(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setNegociacaoClients([]);
      } finally {
        setIsLoadingNegociacaoClients(false);
      }
    }
  };

  const filteredNegociacaoClients = negociacaoClients.filter(c => {
    if (negociacaoAlphabetFilter === "TODOS") return true;
    const initial = (c.nome_completo || "").charAt(0).toUpperCase();
    return initial === negociacaoAlphabetFilter;
  });

  const getFilteredProdutosStats = () => {
    return produtosStats;
  };

  const menuItems = [
    { title: "Home", icon: Home },
    { title: "Meus clientes", icon: Briefcase },
    { title: "Agenda", icon: Calendar },
    { title: "Links", icon: Link2 },
    { title: "Webmail", icon: Mail },
    { title: "Campanhas", icon: Megaphone },
    { title: "Financeiro", icon: Banknote },
    { title: "Importações", icon: Wrench },
  ];

  const cards = [
    { line1: "Meus", line2: "clientes", icon: Briefcase },
    { line1: "Agenda", line2: "", icon: Calendar },
    { line1: "Links", line2: "", icon: Link2 },
    { line1: "Webmail", line2: "", icon: Mail },
    { line1: "Campanhas", line2: "", icon: Megaphone },
    { line1: "Financeiro", line2: "", icon: Banknote },
    { line1: "Importações", line2: "especiais", icon: Wrench },
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
    .filter((agendamento) => {
      const formattedAgendaDate = `${agendaDate.getFullYear()}-${String(agendaDate.getMonth() + 1).padStart(2, '0')}-${String(agendaDate.getDate()).padStart(2, '0')}`;
      return String(agendamento.data_agendamento || "").slice(0, 10) === formattedAgendaDate;
    })
    .map((agendamento) => {
      const appointmentAt = parseAgendamentoDateTime(agendamento);
      const reminderState = agendaReminderState[agendamento.id_agendamento] || {};
      const isLate = appointmentAt ? appointmentAt.getTime() < Date.now() : false;
      const hasBeenSnoozed = Boolean(reminderState.snoozedUntil);
      const isPastDay = String(agendamento.data_agendamento || "").slice(0, 10) < getLocalDateKey();

      return {
        id: agendamento.id_agendamento,
        name: agendamento.cliente_nome || "Cliente",
        phone: agendamento.telefone_celular || agendamento.telefone_residencial || "-",
        time: agendamento.hora_inicio?.slice(0, 5) || "--:--",
        endTime: agendamento.hora_fim?.slice(0, 5) || "",
        status: agendamento.observacao || "compromisso",
        highlight: isPastDay ? true : (isLate && hasBeenSnoozed),
        sortTime: appointmentAt?.getTime() || 0,
      };
    })
    .sort((a, b) => a.sortTime - b.sortTime);

  const compromissosAtrasados = agendamentos.filter(
    (a) => String(a.data_agendamento || "").slice(0, 10) < getLocalDateKey()
  );

  const handleAtrasadosClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (compromissosAtrasados.length > 0) {
      setShowAtrasadosModal(true);
    }
  };

  const handleGoToAgendaDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      setAgendaInitialDate(new Date(year, month - 1, day));
      setActiveMenu("Agenda");
      setShowAtrasadosModal(false);
    }
  };

  // ── Efeitos Master Admin ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMasterAdminUser) return;
    // Usa perfil se disponivel, senao usa session como fallback para o request
    const userId = perfil?.id || session?.user?.id;
    const userEmail = perfil?.email || session?.user?.email;
    if (!userId || !userEmail) return;
    setIsLoadingMasterCompanies(true);
    apiListCompanies({ id: userId, email: userEmail })
      .then((res) => {
        if (res.data) setMasterCompanies(res.data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMasterCompanies(false));
  }, [isMasterAdminUser, perfil?.id, session?.user?.id]);

  useEffect(() => {
    if (!isMasterAdminUser || !masterSelectedCompanyId) {
      setMasterMembers([]);
      return;
    }
    const userId = perfil?.id || session?.user?.id;
    const userEmail = perfil?.email || session?.user?.email;
    if (!userId || !userEmail) return;
    setIsLoadingMasterMembers(true);
    apiListCompanyMembers({ id: userId, email: userEmail }, masterSelectedCompanyId)
      .then((res) => {
        if (res.data) setMasterMembers(res.data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMasterMembers(false));
  }, [isMasterAdminUser, perfil?.id, session?.user?.id, masterSelectedCompanyId]);

  const handleMasterCompanyChange = (companyId: string) => {
    setMasterSelectedCompanyId(companyId);
    setMasterSelectedMemberId('');
    sessionStorage.setItem('rc_master_company_id', companyId);
    sessionStorage.removeItem('rc_master_member_id');
    window.location.reload();
  };

  const handleMasterMemberChange = (memberId: string) => {
    setMasterSelectedMemberId(memberId);
    sessionStorage.setItem('rc_master_member_id', memberId);
    window.location.reload();
  };

  const showClientArea = activeMenu === "Meus clientes";
  const showAgendaArea = activeMenu === "Agenda";
  const showWebmailArea = activeMenu === "Webmail";
  const showCampanhasArea = activeMenu === "Campanhas";
  const showConfigurarArea = activeMenu === "Configurações" || activeMenu === "Configurar";
  const shouldBlockSidebarLinks = showLinksChooser || Boolean(linksDesktopStatus) || isLinksDesktopWindowOpen;
  const blockSidebarMouseEvent = (event: React.SyntheticEvent) => {
    if (!shouldBlockSidebarLinks) return;

    event.preventDefault();
    event.stopPropagation();
  };

  const handleAgendamentosChanged = useCallback(() => {
    void (window as any).__rcMolinaRefreshAgendamentos?.();
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#F0F4F8] font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside
        aria-disabled={shouldBlockSidebarLinks}
        onClickCapture={blockSidebarMouseEvent}
        onMouseDownCapture={blockSidebarMouseEvent}
        onPointerDownCapture={blockSidebarMouseEvent}
        className={`relative w-full flex-shrink-0 overflow-hidden bg-black shadow-xl lg:w-48 lg:z-20 lg:flex lg:flex-col lg:justify-between lg:h-screen transition-all duration-300 ${shouldBlockSidebarLinks ? "opacity-55 select-none filter grayscale-[30%]" : ""}`}
      >
        {shouldBlockSidebarLinks ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-50 cursor-not-allowed bg-[#0c1826]/15 backdrop-blur-[1px] pointer-events-auto"
            onClick={blockSidebarMouseEvent}
            onMouseDown={blockSidebarMouseEvent}
            onPointerDown={blockSidebarMouseEvent}
          />
        ) : null}

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
                  disabled={shouldBlockSidebarLinks}
                  onClick={() => void handleMenuClick(item.title)}
                  className={`flex min-w-max items-center justify-between gap-3 rounded-2xl border-l-4 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 lg:w-full lg:rounded-none lg:px-6 ${isActive
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
          <span id="sidebar-version-text" className="text-xs font-semibold text-gray-500 tracking-wider">
            Versão: {APP_VERSION}
          </span>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header id="main-dashboard-header" className="flex flex-col gap-4 bg-black border-b border-slate-800 px-4 py-4 shadow-sm sm:px-6 md:px-8 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col items-start px-2 py-1">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo da Empresa" className="h-10 w-auto sm:h-12 max-w-[200px] object-contain" />
              ) : (
                <>
                  <div className="text-xl font-bold leading-none tracking-widest text-[#d4af37]">
                    CKDEV
                  </div>
                  <div className="mt-1 text-center text-[10px] font-bold tracking-[0.3em] text-white/80">
                    SOLUÇÕES EM TI
                  </div>
                </>
              )}
            </div>

            <span className="border-l border-slate-700 pl-4 text-sm text-slate-400">
              {activeMenu === "Home" ? "Painel Administrativo" : activeMenu}
            </span>

            {/* ── Seletor de Contexto – Apenas Master Admins ── */}
            {isMasterAdminUser && (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                {/* Combobox de Empresa */}
                <div className="relative">
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#b58c2a] bg-[#152a42] px-3 py-1.5 text-sm text-white min-w-[160px] max-w-[220px]">
                    <Building2 size={14} className="shrink-0 text-[#d4af37]" />
                    {isLoadingMasterCompanies ? (
                      <Loader2 size={12} className="animate-spin text-white" />
                    ) : (
                      <select
                        id="master-company-select"
                        value={masterSelectedCompanyId}
                        onChange={(e) => handleMasterCompanyChange(e.target.value)}
                        className="flex-1 bg-transparent text-white font-medium text-xs outline-none cursor-pointer [&>option]:bg-[#0d1d2e] [&>option]:text-white"
                      >
                        <option value="">— Todas as empresas —</option>
                        {masterCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    )}
                    <ChevronDown size={12} className="shrink-0 text-[#d4af37]" />
                  </div>
                </div>

                {/* Combobox de Pessoa (só aparece quando empresa selecionada) */}
                {masterSelectedCompanyId && (
                  <div className="relative">
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-500 bg-[#152a42] px-3 py-1.5 text-sm text-white min-w-[150px] max-w-[200px]">
                      <User size={14} className="shrink-0 text-slate-300" />
                      {isLoadingMasterMembers ? (
                        <Loader2 size={12} className="animate-spin text-white" />
                      ) : (
                        <select
                          id="master-member-select"
                          value={masterSelectedMemberId}
                          onChange={(e) => handleMasterMemberChange(e.target.value)}
                          className="flex-1 bg-transparent text-white font-medium text-xs outline-none cursor-pointer [&>option]:bg-[#0d1d2e] [&>option]:text-white"
                        >
                          <option value="">— Todos os usuários —</option>
                          {masterMembers.map((m) => (
                            <option key={m.id} value={m.id}>{m.nome_completo}</option>
                          ))}
                        </select>
                      )}
                      <ChevronDown size={12} className="shrink-0 text-slate-300" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">

            {showClientArea || showAgendaArea || showWebmailArea || showCampanhasArea ? (
              <button
                type="button"
                onClick={() => void handleMenuClick("Home")}
                className="flex min-h-11 items-center gap-2 rounded-full border border-slate-700 bg-transparent px-4 py-2 text-slate-300 transition-colors hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
              >
                <Home size={18} />
                <span className="text-sm font-semibold">Menu Principal</span>
              </button>
            ) : null}

            <button
              type="button"
              aria-label="WhatsApp"
              onClick={() => void handleMenuClick("Campanhas")}
              className={`flex min-h-11 items-center gap-2 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-4 py-2 text-[#128C7E] transition-all hover:bg-[#25D366]/20 active:scale-95 cursor-pointer ${activeMenu === "Campanhas" ? "ring-2 ring-[#25D366] ring-offset-2" : ""
                }`}
            >
              <WhatsAppIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">WhatsApp</span>
            </button>

            <button
              onClick={() => void handleMenuClick("Agenda")}
              className={`flex min-h-11 items-center gap-2 transition-colors hover:text-[#b58c2a] ${activeMenu === "Agenda" ? "text-[#b58c2a]" : "text-white"}`}
            >
              <Calendar size={18} />
              <span className="text-sm">Agenda</span>
            </button>

            <button
              onClick={() => void handleMenuClick("Links")}
              className={`flex min-h-11 items-center gap-2 transition-colors hover:text-[#b58c2a] text-white`}
            >
              <Link2 size={18} />
              <span className="text-sm">Links</span>
            </button>

            <div className="hidden h-8 w-px bg-slate-700 sm:block" />

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-800 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={16} className="text-slate-400" />
                )}
              </div>
              <span className="hidden text-sm font-medium text-slate-200 md:inline">
                {userName}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowLogoutConfirmModal(true)}
              disabled={isLoggingOut}
              className="flex min-h-11 items-center gap-2 text-slate-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              <span className="text-sm">{isLoggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          </div>
        </header>

        {isExternalWebviewOpen ? (
          <div id="blue-banner-webview" className="shrink-0 bg-blue-50 border-b border-blue-100 px-6 py-2 shadow-inner z-[99] flex justify-between items-center">
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs font-bold text-blue-700 animate-pulse uppercase tracking-wide">
                Pressione ESC para retornar ao menu principal
              </p>
            </div>
            <button
              onClick={closeExternalWebview}
              className="text-blue-400 hover:text-blue-700 transition-colors ml-4"
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden transition-all duration-300">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {showClientArea ? (
              <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 md:px-8 md:pb-8 md:pt-4">
                <ClientRegistrationMultipage initialSearchQuery={clientToEdit} />
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
                  onConnectionGateClose={() => setActiveMenu("Home")}
                />
              </div>
            ) : activeMenu === "Agenda" ? (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <Agenda
                  aniversariantesMes={aniversariantesMes}
                  onAgendamentosChanged={handleAgendamentosChanged}
                  initialDate={agendaInitialDate}
                />
              </div>
            ) : showConfigurarArea ? (
              <div className="flex min-h-0 flex-1 p-4 sm:p-6 md:p-8">
                <div className="w-full h-full">
                  <Configuracoes onClose={() => void handleMenuClick("Home")} />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
                <div className="flex flex-col gap-3">
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-7">
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

                  <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Aniversariantes do mês
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setAniversariantesDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                </button>
                                <h2 className="text-xl font-black tracking-tight capitalize">{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(aniversariantesDate)}</h2>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setAniversariantesDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                                </button>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-white/50">
                                {isLoadingAniversariantes
                                  ? "Carregando registros..."
                                  : `${aniversariantesMes.filter(c => {
                                    const d = new Date(c.data_nascimento);
                                    return !isNaN(d.getTime()) && d.getUTCMonth() === aniversariantesDate.getMonth();
                                  }).length} clientes celebram este mês`}
                              </p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setAniversariantesDate(new Date()); }}
                              title="Voltar para o mês atual"
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              <PartyPopper size={20} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2">
                          {(() => {
                            const currentMonth = aniversariantesDate.getMonth();
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
                                  <p className="mt-1 text-xs text-slate-400/80">para o mês de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(aniversariantesDate).toLowerCase()}.</p>
                                </div>
                              );
                            }

                            return (
                              <div className="flex flex-col gap-1.5">
                                {filtered.map((cliente) => {
                                  const bDate = new Date(cliente.data_nascimento);
                                  const isToday = bDate.getUTCDate() === new Date().getDate() && bDate.getUTCMonth() === new Date().getMonth();

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
                                      className={`group relative overflow-hidden rounded-lg border border-white bg-white px-2.5 py-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d4af37]/30 hover:shadow-md ${isToday ? "ring-2 ring-[#d4af37]/20 bg-[#fffaf0]/50 cursor-pointer" : ""
                                        }`}
                                    >
                                      {isToday && (
                                        <div className="absolute right-0 top-0 rounded-bl-xl bg-[#d4af37] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white animate-pulse">
                                          Hoje
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2.5">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${isToday ? "bg-[#d4af37] text-white shadow-lg shadow-[#d4af37]/20" : "bg-[#d4af37]/10 text-[#a2812a] group-hover:bg-[#d4af37]/20"
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
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Status de negociação
                              </p>
                              <div className="mt-0.5 flex items-center h-7">
                                <h2 className="text-xl font-black tracking-tight">{negociacaoStats.reduce((acc, curr) => acc + curr.quantidade, 0)}</h2>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-white/50">
                                {isLoadingNegociacaoStats ? "Carregando..." : "Total de negociações"}
                              </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <Briefcase size={20} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
                          <div className="flex flex-col gap-2">
                            {negociacaoStats.length > 0 ? negociacaoStats.map((item, i) => (
                              <div
                                key={i}
                                onClick={() => handleNegociacaoCardClick(item.status, item.quantidade)}
                                className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#b58c2a]/30 hover:shadow-md cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b58c2a]/10 text-[#a2812a] transition-all duration-300 group-hover:bg-[#b58c2a]/20">
                                    <Briefcase size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-[#0c1826] transition-colors group-hover:text-[#a2812a]">
                                      {item.status.toUpperCase()}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center justify-center rounded-lg bg-[#b58c2a]/10 px-2.5 py-1">
                                    <span className="text-sm font-black text-[#a2812a]">{item.quantidade}</span>
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <p className="text-xs font-bold text-slate-400">Nenhuma negociação</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Agenda do dia
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setAgendaDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1)); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                                </button>
                                <h2 className="text-xl font-black tracking-tight">{agendaDate.getDate()} de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(agendaDate)}</h2>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setAgendaDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1)); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                                </button>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-white/50 flex items-center">
                                Tarefas programadas - {agendaItems.length}
                                {compromissosAtrasados.length > 0 && (
                                  <>
                                    <span className="mx-2 opacity-50">|</span>
                                    <span 
                                      className="text-red-400 font-bold animate-pulse cursor-pointer hover:text-red-300 transition-colors"
                                      onClick={handleAtrasadosClick}
                                      title="Ir para o dia do compromisso atrasado mais antigo"
                                    >
                                      {compromissosAtrasados.length} {compromissosAtrasados.length === 1 ? "compromisso atrasado" : "compromissos atrasados"}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-white/10 cursor-pointer overflow-hidden">
                              <Calendar size={20} strokeWidth={1.5} />
                              <input
                                type="date"
                                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                                value={`${agendaDate.getFullYear()}-${String(agendaDate.getMonth() + 1).padStart(2, '0')}-${String(agendaDate.getDate()).padStart(2, '0')}`}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [year, month, day] = e.target.value.split('-').map(Number);
                                    if (year && month && day) {
                                      setAgendaDate(new Date(year, month - 1, day));
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

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
                                className={`group relative hover:z-30 rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${item.highlight
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
                                  <div className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-full transition-all duration-300 ${item.highlight
                                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                      : "bg-[#d4af37]/10 text-[#a2812a] group-hover:bg-[#d4af37]/20"
                                    }`}>
                                    <User size={14} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className={`max-w-full ${item.highlight ? "pr-16" : ""}`}>
                                      <p
                                        className={`truncate text-[11px] font-bold leading-4 transition-colors ${item.highlight ? "text-red-700" : "text-[#0c1826] group-hover:text-[#a2812a]"
                                          }`}
                                      >
                                        {item.name}
                                      </p>
                                    </div>
                                    <div className="mt-0.5 grid grid-cols-[115px_40px_1fr] items-center gap-x-2 text-[11px] font-semibold text-slate-500">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <Phone size={11} className={item.highlight ? "text-red-400" : ""} />
                                        <span className={`whitespace-nowrap truncate ${item.highlight ? "text-red-600" : "text-slate-500"}`}>{item.phone}</span>
                                      </div>
                                      <span className={`font-bold ${item.highlight ? "text-red-600" : "text-[#a2812a]"}`}>{item.time}</span>
                                      <span className={`truncate ${item.highlight ? "text-red-500" : "text-slate-400"}`} title={item.status}>{item.status}</span>
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
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Produtos comercializados
                              </p>
                              <div className="mt-0.5 flex items-center h-7">
                                <h2 className="text-xl font-black tracking-tight">{produtosStats.reduce((acc, curr) => acc + curr.quantidade, 0)}</h2>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-white/50">
                                {isLoadingProdutosStats ? "Carregando..." : "Total de produtos ativos"}
                              </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <Briefcase size={20} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
                          <div className="flex flex-col gap-2">
                            {produtosStats.length > 0 ? produtosStats.map((item, i) => (
                              <div
                                key={i}
                                className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#25D366]/30 hover:shadow-md cursor-default"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C7E] transition-all duration-300 group-hover:bg-[#25D366]/20">
                                    <Briefcase size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-[#0c1826] transition-colors group-hover:text-[#128C7E]">
                                      {item.produto.toUpperCase()}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10 px-2.5 py-1">
                                    <span className="text-sm font-black text-[#128C7E]">{item.quantidade}</span>
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <p className="text-xs font-bold text-slate-400">Nenhum produto</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-w-sm h-[360px]">
                      <div className="flex flex-col h-full">
                        <div className="relative overflow-hidden bg-[#0c1826] p-4 text-white shrink-0">
                          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#d4af37]/10 blur-3xl" />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37]/90">
                                Clientes da Corretora
                              </p>
                              <div className="mt-0.5 flex items-center h-7">
                                <h2 className="text-xl font-black tracking-tight">{clientStats.total}</h2>
                              </div>
                              <p className="mt-1 text-[10px] font-medium text-white/50">
                                {isLoadingClientStats ? "Calculando clientes..." : "Total de clientes registrados"}
                              </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
                              <Users size={20} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50/50 p-2.5">
                          <div className="flex flex-col gap-2">
                            <div 
                              onClick={() => openStatusModal('ATIVO')}
                              className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#25D366]/30 hover:shadow-md cursor-pointer"
                            >
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
                              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full bg-[#25D366] transition-all duration-1000"
                                  style={{ width: `${clientStats.total > 0 ? (clientStats.ativos / clientStats.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>

                            <div 
                              onClick={() => openStatusModal('INATIVO')}
                              className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-400/30 hover:shadow-md cursor-pointer"
                            >
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
                              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full bg-red-400 transition-all duration-1000"
                                  style={{ width: `${clientStats.total > 0 ? (clientStats.inativos / clientStats.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>

                            <div 
                              className="group relative overflow-hidden rounded-xl border border-white bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:shadow-md cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 transition-all duration-300 group-hover:bg-blue-100">
                                  <User size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-[#0c1826] transition-colors group-hover:text-blue-600">
                                    Clientes aguardando contato (leads)
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    <span className="font-bold text-blue-500">{clientStats.leads}</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>{clientStats.total > 0 ? Math.round((clientStats.leads / clientStats.total) * 100) : 0}% do total</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full bg-blue-400 transition-all duration-1000"
                                  style={{ width: `${clientStats.total > 0 ? (clientStats.leads / clientStats.total) * 100 : 0}%` }}
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


      {showLinksChooser ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl flex flex-col max-h-[95vh]">
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
                  setActiveLinkTab("simuladores");
                  setActiveMenu("Home");
                }}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-100 px-6 shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveLinkTab('simuladores')}
                className={`h-[46px] px-4 flex items-center justify-center text-sm font-black border-b-2 transition-all cursor-pointer ${
                  activeLinkTab === 'simuladores'
                    ? 'border-[#b58c2a] text-[#b58c2a]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                Simuladores
              </button>
              <button
                type="button"
                onClick={() => setActiveLinkTab('consorcios')}
                className={`h-[46px] px-4 flex items-center justify-center text-sm font-black border-b-2 transition-all cursor-pointer ${
                  activeLinkTab === 'consorcios'
                    ? 'border-[#b58c2a] text-[#b58c2a]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                Consórcios
              </button>
            </div>

            {linksDesktopStatus ? (
              <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {linksDesktopStatus}
              </div>
            ) : null}

            <div className="overflow-y-auto custom-scrollbar p-6 pb-8 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(activeLinkTab === 'simuladores'
                  ? [
                      { name: "ALLCARE PORTAL", url: "https://portal.allcare.com.br/", logo: "/portais/allcare.webp" },
                      { name: "ALLCARE VENDAS", url: "https://vendas.allcare.com.br/AllTechLoginVendas", logo: "/portais/allcare.webp" },
                      { name: "ALLCARE WEB", url: "https://allcare.planium.io/web/login/entrar", logo: "/portais/allcare.webp" },
                      { name: "AMIL", url: "https://comercial.amil.com.br/prweb/PRAuth/app/sales-experience/", logo: "/portais/amil.webp", executeScript: "(function(){setTimeout(() => { const u = document.getElementById('txtUserID'); const p = document.getElementById('txtPassword'); if(u) u.value = '77915445715'; if(p) p.value = 'sqn0y3zqmo'; }, 1000);})();" },
                      { name: "ASSIM SAUDE", url: "https://assim.hcommerce.com.br/login", logo: "/portais/assim_saude.webp", executeScript: "(function(){if(!window.location.href.toLowerCase().includes('login'))return;let attempts=0;let interval=setInterval(function(){if(!window.location.href.toLowerCase().includes('login')){clearInterval(interval);return;}let user=document.querySelector('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]');let pass=document.querySelector('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'77915445715');setValue(pass,'cfqqho');setTimeout(()=>{let btn=document.querySelector('button[type=\"submit\"], input[type=\"submit\"], button[class*=\"login\"], button[class*=\"entrar\"], #btnLogar');if(btn)btn.click();},500);clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                      { name: "CONTEM ADMINISTRADORA", url: "https://digitalsaude.com.br/canal/contem", logo: "/portais/contem.webp" },
                      { name: "CORPE SAUDE", url: "https://contratacao.mktss.com.br/#/login", logo: "/portais/corpe.webp" },
                      { name: "DIXMED", url: "https://dixmed.hcommerce.com.br", logo: "/portais/dixmed_circulo_borda.webp" },
                      { name: "HAPVIDA", url: "https://gndi.planium.io/web/login/", logo: "/portais/hapvida.webp" },
                      { name: "KLINI SAUDE", url: "https://klinisaude.hcommerce.com.br/corretora/login", logo: "/portais/klini.webp" },
                      { name: "LEVE SAUDE", url: "https://levesaude.planium.io/web/login/entrar", logo: "/portais/leve.webp" },
                      { name: "MEDSENIOR", url: "https://vendadigital.medsenior.com.br/", logo: "/portais/medsenior.webp" },
                      { name: "PLURAL", url: "https://plural.hcommerce.com.br/login", logo: "/portais/plural.webp" },
                      { name: "PORTO SEGURO", url: "https://corretor.portoseguro.com.br/portal/site/corretoronline/template.LOGIN/", logo: "/portais/porto_seguro.webp", executeScript: "(function(){let attempts=0;let clicked=false;let interval=setInterval(function(){if(!clicked){let btns=Array.from(document.querySelectorAll('button, a, div[role=\"button\"], span'));let btn=btns.find(b=>b.innerText&&b.innerText.toUpperCase().includes('ACESSAR O CORRETOR ONLINE'));if(btn){btn.click();clicked=true;return;}}let users=Array.from(document.querySelectorAll('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]'));let passes=Array.from(document.querySelectorAll('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]'));let user=users.find(u=>u.offsetParent!==null&&!u.disabled&&u.type!=='hidden');let pass=passes.find(p=>p.offsetParent!==null&&!p.disabled&&p.type!=='hidden');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'77915445715');setValue(pass,'Benj@min88');clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                      { name: "QUALIVENDAS", url: "https://qualivendas.qualicorp.com.br/#/login", logo: "/portais/qualivendas.webp", executeScript: "(function(){let attempts=0;let interval=setInterval(function(){let users=Array.from(document.querySelectorAll('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]'));let passes=Array.from(document.querySelectorAll('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]'));let user=users.find(u=>u.offsetParent!==null&&!u.disabled&&u.type!=='hidden');let pass=passes.find(p=>p.offsetParent!==null&&!p.disabled&&p.type!=='hidden');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'molinarccontatos@gmail.com');setValue(pass,'6w3dXJ');clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                      { name: "QUER", url: "https://app.simuladoronline.com/login/", logo: "/portais/quer.webp", executeScript: "(function(){setTimeout(() => { const u = document.getElementById('login_usuario'); const p = document.getElementById('login_senha'); if(u) u.value = 'Rosilene Rodrigues'; if(p) p.value = '123'; }, 1000);})();" },
                      { name: "SOLUTIONS", url: "https://solutions.hcommerce.com.br/login", logo: "/portais/solutions.webp", executeScript: "(function(){let attempts=0;let interval=setInterval(function(){let users=Array.from(document.querySelectorAll('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]'));let passes=Array.from(document.querySelectorAll('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]'));let user=users.find(u=>u.offsetParent!==null&&!u.disabled&&u.type!=='hidden');let pass=passes.find(p=>p.offsetParent!==null&&!p.disabled&&p.type!=='hidden');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'77915445715');setValue(pass,'vyx88t');clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                      { name: "SULAMERICA", url: "https://os11.sulamerica.com.br/SaudeCotador/LoginVendedor.aspx", logo: "/portais/sulamerica.webp", executeScript: "(function(){let attempts=0;let interval=setInterval(function(){let users=Array.from(document.querySelectorAll('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]'));let passes=Array.from(document.querySelectorAll('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]'));let user=users.find(u=>u.offsetParent!==null&&!u.disabled&&u.type!=='hidden');let pass=passes.find(p=>p.offsetParent!==null&&!p.disabled&&p.type!=='hidden');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'77915445715');setValue(pass,'Benj@min88');clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                      { name: "SUPERMED", url: "https://vendas.supermed.com.br/login", logo: "/portais/supermed.webp", executeScript: "(function(){let attempts=0;let interval=setInterval(function(){let users=Array.from(document.querySelectorAll('input[type=\"text\"], input[type=\"email\"], input[name*=\"login\"], input[name*=\"user\"], input[name*=\"usuario\"], input[name*=\"cpf\"], #login, #usuario, #login_usuario, #cpf, [placeholder*=\"CPF\"], [placeholder*=\"Usuário\"]'));let passes=Array.from(document.querySelectorAll('input[type=\"password\"], input[name*=\"senha\"], input[name*=\"pass\"], #senha, #password, #login_senha, [placeholder*=\"Senha\"]'));let user=users.find(u=>u.offsetParent!==null&&!u.disabled&&u.type!=='hidden');let pass=passes.find(p=>p.offsetParent!==null&&!p.disabled&&p.type!=='hidden');if(user&&pass){let setValue=function(el,value){let setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');if(setter&&setter.set){setter.set.call(el,value);}else{el.value=value;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};setValue(user,'77915445715');setValue(pass,'Benj@min88');clearInterval(interval);}attempts++;if(attempts>45){clearInterval(interval);}},1000);})();" },
                    ]
                  : []).map((sys) => (
                  <button
                    key={sys.name}
                    type="button"
                    onClick={(event) => {
                      const anchorRect = event.currentTarget.getBoundingClientRect();
                      if ((window as any).chrome && (window as any).chrome.webview) {
                        setIsExternalWebviewOpen(true);
                        setTimeout(() => {
                          const sidebarWidth = Math.round(document.querySelector("aside")?.getBoundingClientRect().width || 192);
                          const banner = document.getElementById("blue-banner-webview");
                          const headerHeight = banner ? Math.round(banner.getBoundingClientRect().bottom) : Math.round(document.querySelector("header")?.getBoundingClientRect().height || 64) + 45;
                          const payload = {
                            action: "open_external",
                            url: sys.url,
                            sidebarWidth,
                            headerHeight,
                            ...(sys.executeScript ? { executeScript: sys.executeScript } : {})
                          };
                          (window as any).chrome.webview.postMessage(JSON.stringify(payload));
                        }, 50);
                      } else {
                        void openPortalInDesktop(sys.url, anchorRect, sys.executeScript);
                      }
                    }}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-[#d4af37]/70 hover:shadow-md text-left w-full cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b58c2a]/10 overflow-hidden text-[#b58c2a] font-bold text-sm tracking-wider">
                      {sys.logo ? (
                        <img src={sys.logo} alt={sys.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        sys.name.slice(0, 2)
                      )}
                    </div>
                    <p className="truncate text-sm font-bold text-[#0c1826] group-hover:text-[#b58c2a] transition-colors min-w-0">
                      {sys.name}
                    </p>
                    <div className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#b58c2a]/10 group-hover:text-[#b58c2a] transition-all">
                      <ExternalLink size={14} />
                    </div>
                  </button>
                ))}

                {activeLinkTab === 'consorcios' && (
                  <div className="col-span-full py-16 text-center text-slate-400 font-semibold text-sm">
                    Nenhum portal de consórcios cadastrado por enquanto.
                  </div>
                )}
              </div>
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
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-2xl scale-in-95 duration-200 p-8 text-center">
            <div className="mx-auto mb-6 flex justify-center">
              <img src={logoUrl || "/portais/logo_cixdev.webp"} alt="Logo" className="h-16 w-auto object-contain" />
            </div>
            <h3 className="mb-2 text-2xl font-black text-[#0c1826]">
              Sair do sistema
            </h3>
            <p className="mb-8 text-slate-500 leading-relaxed font-medium">
              Tem certeza de que deseja sair? Você precisará fazer login novamente para acessar sua conta.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600 transition hover:bg-slate-200"
              >
                Não, voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  void handleLogout();
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#b58c2a] py-3 font-bold text-white transition hover:bg-[#a17c1f] shadow-md shadow-[#b58c2a]/20"
              >
                <LogOut size={20} strokeWidth={2.5} />
                <span>LOGOUT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-2xl scale-in-95 duration-200">
            <div className={`p-6 text-white ${statusModalType === 'ATIVO' ? 'bg-[#25D366]' : 'bg-red-500'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">
                    Clientes {statusModalType === 'ATIVO' ? 'Ativos' : 'Inativos'}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-white/80">
                    Selecione um cliente para ver os detalhes
                  </p>
                </div>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-4 bg-slate-50 relative">
              {isLoadingStatusModal ? (
                <div className="flex py-10 items-center justify-center flex-col gap-3">
                  <Loader2 size={32} className="animate-spin text-slate-400" />
                  <p className="text-sm text-slate-500">Carregando clientes...</p>
                </div>
              ) : statusModalClientes.length === 0 ? (
                <div className="flex py-10 items-center justify-center flex-col gap-3">
                  <User size={32} className="text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">Nenhum cliente encontrado.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(() => {
                    const sorted = [...statusModalClientes].sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''));
                    let currentLetter = '';
                    
                    return sorted.map((cliente) => {
                      const letter = (cliente.nome_completo || ' ').charAt(0).toUpperCase();
                      const isFirstOfLetter = letter !== currentLetter;
                      if (isFirstOfLetter) currentLetter = letter;
                      
                      return (
                        <div key={cliente.id_cliente} className="flex flex-col">
                          {isFirstOfLetter && (
                            <div id={`client-letter-${letter}`} className="sticky top-0 z-10 -mx-2 mb-2 bg-slate-50/90 px-2 py-1 backdrop-blur-sm">
                              <span className={`text-xs font-black ${statusModalType === 'ATIVO' ? 'text-[#128C7E]' : 'text-red-500'}`}>
                                {letter}
                              </span>
                            </div>
                          )}
                          <div
                            onClick={() => {
                              setShowStatusModal(false);
                              setClientToEdit(cliente.nome_completo);
                              void handleCardClick("Meus", "clientes");
                            }}
                            className={`group relative overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex items-center gap-4
                              ${statusModalType === 'ATIVO' ? 'border-slate-200 hover:border-[#25D366]/40' : 'border-slate-200 hover:border-red-400/40'}`}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300
                              ${statusModalType === 'ATIVO' ? 'bg-[#25D366]/10 text-[#128C7E] group-hover:bg-[#25D366]/20' : 'bg-red-50 text-red-500 group-hover:bg-red-100'}`}>
                              <User size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold transition-colors truncate
                                ${statusModalType === 'ATIVO' ? 'text-slate-800 group-hover:text-[#128C7E]' : 'text-slate-800 group-hover:text-red-600'}`}>
                                {cliente.nome_completo}
                              </p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {cliente.cpf || cliente.cnpj || 'Documento não informado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            
            {/* Alphabet quick jump footer */}
            {!isLoadingStatusModal && statusModalClientes.length > 0 && (
              <div className="bg-white border-t border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                    const exists = statusModalClientes.some(c => (c.nome_completo || ' ').charAt(0).toUpperCase() === letter);
                    return (
                      <button
                        key={letter}
                        disabled={!exists}
                        onClick={() => {
                          const el = document.getElementById(`client-letter-${letter}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-all
                          ${exists 
                            ? (statusModalType === 'ATIVO' ? 'bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 cursor-pointer' : 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer')
                            : 'text-slate-300 cursor-not-allowed'
                          }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRestrictedModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-[24px] border border-gray-800 bg-[#121212] shadow-2xl scale-in-95 duration-200 p-8 text-center items-center relative">
            <button
              onClick={() => setShowRestrictedModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="w-20 h-20 mb-6 bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
              <Lock size={40} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
            <p className="text-gray-400 mb-8 text-sm">
              Você não tem permissão para acessar esta área. Entre em contato com o suporte para mais informações.
            </p>
            <img src="/portais/logo_cixdev.webp" alt="CKDEV Soluções em TI" className="h-8 mb-4 object-contain opacity-80" />
            <div className="flex items-center gap-2 text-[#ccff00] font-bold text-lg bg-[#ccff00]/10 px-6 py-3 rounded-xl border border-[#ccff00]/20">
              <Phone size={20} />
              (21) 98868-1799
            </div>
          </div>
        </div>
      )}

      {/* Negociação Status Modal */}
      {showNegociacaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/40 p-4 sm:p-0 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b58c2a]/10 text-[#a2812a]">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Status de Negociação: {selectedNegociacaoStatus}
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    {filteredNegociacaoClients.length} {filteredNegociacaoClients.length === 1 ? 'cliente' : 'clientes'} com este status
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNegociacaoModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isLoadingNegociacaoClients ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b58c2a] border-t-transparent" />
                  <p className="mt-4 text-sm font-medium text-slate-500">Carregando clientes...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredNegociacaoClients.length > 0 ? (
                    filteredNegociacaoClients.map((cliente) => (
                      <div
                        key={cliente.id_cliente}
                        onClick={() => {
                          setClientToEdit(cliente.codigo || cliente.nome_completo);
                          setActiveMenu("Meus clientes");
                          setShowNegociacaoModal(false);
                        }}
                        className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-[#b58c2a]/30 hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-lg font-black text-[#0c1826] group-hover:bg-[#b58c2a]/10 group-hover:text-[#a2812a] transition-colors">
                            {cliente.nome_completo.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 transition-colors group-hover:text-[#b58c2a]">
                              {cliente.nome_completo}
                            </h4>
                            <div className="mt-1 flex items-center gap-3 text-xs font-medium text-slate-500">
                              {cliente.cpf && (
                                <span className="flex items-center gap-1">
                                  <User size={12} /> {cliente.cpf}
                                </span>
                              )}
                              {cliente.codigo && (
                                <span className="flex items-center gap-1">
                                  <Hash size={12} /> {cliente.codigo}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 transition-colors group-hover:text-[#b58c2a]" />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Users size={24} />
                      </div>
                      <h4 className="mt-4 font-bold text-slate-700">Nenhum cliente encontrado</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Não há clientes para este status na letra selecionada.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white p-4">
              <div className="flex flex-wrap gap-1.5 justify-center">
                <button
                  onClick={() => setNegociacaoAlphabetFilter("TODOS")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    negociacaoAlphabetFilter === "TODOS"
                      ? "bg-[#b58c2a] text-white shadow-md shadow-[#b58c2a]/20"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  TODOS
                </button>
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                  const hasClientsWithLetter = negociacaoClients.some(
                    (c) => (c.nome_completo || "").charAt(0).toUpperCase() === letter
                  );
                  return (
                    <button
                      key={letter}
                      onClick={() => setNegociacaoAlphabetFilter(letter)}
                      disabled={!hasClientsWithLetter}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        negociacaoAlphabetFilter === letter
                          ? "bg-[#b58c2a] text-white shadow-md shadow-[#b58c2a]/20"
                          : hasClientsWithLetter
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAtrasadosModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between bg-red-500 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar size={20} />
                Compromissos Atrasados
              </h3>
              <button
                onClick={() => setShowAtrasadosModal(false)}
                className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {compromissosAtrasados.length === 0 ? (
                <p className="text-center text-slate-500 py-4">Nenhum compromisso atrasado.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {compromissosAtrasados.map(ag => {
                    const date = ag.data_agendamento.slice(0, 10);
                    const [y, m, d] = date.split('-');
                    return (
                      <div 
                        key={ag.id_agendamento}
                        className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-red-300 hover:bg-red-50 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                        onClick={() => handleGoToAgendaDate(date)}
                      >
                        <div className="flex flex-col min-w-0 pr-3">
                          <span className="font-bold text-slate-800 truncate">{ag.cliente_nome || "Cliente sem nome"}</span>
                          <span className="text-xs text-slate-500 truncate">{ag.observacao || "Sem observação"}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                            {d}/{m}/{y}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {ag.hora_inicio?.slice(0, 5) || "--:--"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
