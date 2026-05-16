import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MailPlus,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Trash2,
  Undo2,
  Unplug,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { EmailRichTextEditorProps } from './email_rich_text_editor';
import {
  ApiError,
  type Account,
  type DraftSummary,
  type EmailLog,
  type Folder,
  type FullMessage,
  type GmailConnectionStatus,
  createGmailApi,
  type MessageSummary,
  type OutboxMessage,
} from '../../lib/gmail_api';

const DEFAULT_ACCOUNT = 'rcmolina.invest.segurosaude@gmail.com';
const MAX_TRANSMISSION_BYTES = 25 * 1024 * 1024;
const EmailRichTextEditor = lazy(async () => {
  const module = await import('./email_rich_text_editor');
  return { default: module.EmailRichTextEditor };
}) as ComponentType<EmailRichTextEditorProps>;

type ComposeState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  files: File[];
};

type PermissionIssue = {
  message: string;
  missingScopes: string[];
} | null;

type MailSection = Folder | 'settings';

const emptyCompose: ComposeState = {
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  bodyHtml: '',
  files: [],
};

const folderItems: Array<{ id: Folder; label: string; icon: typeof Inbox }> = [
  { id: 'inbox', label: 'Entrada', icon: Inbox },
  { id: 'sent', label: 'Enviados', icon: Send },
  { id: 'drafts', label: 'Rascunhos', icon: FileText },
  { id: 'trash', label: 'Lixeira', icon: Trash2 },
];

const settingsItem = { id: 'settings' as const, label: 'Configuracoes', icon: Settings2 };

function isFolder(value: string | null): value is Folder {
  return value === 'inbox' || value === 'sent' || value === 'trash' || value === 'drafts';
}

function getFolderFromRoute(pathname: string, search: string): Folder {
  if (pathname.includes('/email/drafts')) return 'drafts';
  if (pathname.includes('/email/sent')) return 'sent';
  if (pathname.includes('/email/trash')) return 'trash';
  const folderFromSearch = new URLSearchParams(search).get('folder');
  if (isFolder(folderFromSearch)) return folderFromSearch;
  return 'inbox';
}

function isSettingsRoute(pathname: string) {
  return pathname.includes('/email/settings');
}

function isComposeRoute(pathname: string) {
  return pathname.includes('/email/compose');
}

function getThreadIdFromPathname(pathname: string) {
  const match = pathname.match(/\/email\/thread\/([^/]+)/i);
  return match?.[1] || null;
}

function routeForFolder(folder: Folder) {
  return folder === 'inbox' ? '/email/inbox' : `/email/${folder}`;
}

function formatDateTime(value: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${Math.max(1, Math.round(value / (1024 * 1024)))} MB`;
  }
  return `${Math.max(1, Math.round(value / (1024 * 1024 * 1024)))} GB`;
}

function compactSender(value: string) {
  return value.replace(/<[^>]+>/g, '').trim() || value;
}

function senderInitial(value: string) {
  const normalized = compactSender(value).trim();
  const firstAlphaNumeric = Array.from(normalized).find((character) => /[\p{L}\p{N}]/u.test(character));
  return firstAlphaNumeric?.toLocaleUpperCase('pt-BR') || '?';
}

function htmlToPlainText(value: string) {
  if (!value.trim()) return '';

  const documentFragment = new DOMParser().parseFromString(value, 'text/html');
  return (documentFragment.body.innerText || documentFragment.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  if (padding === 0) return normalized;
  return normalized.padEnd(normalized.length + (4 - padding), '=');
}

function replaceCidReference(html: string, contentId: string, source: string) {
  if (!contentId) return html;

  const variants = [
    `cid:${contentId}`,
    `cid:<${contentId}>`,
    `cid:${encodeURIComponent(contentId)}`,
    `cid:${encodeURIComponent(`<${contentId}>`)}`,
  ];

  return variants.reduce((current, value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current.replace(new RegExp(escaped, 'gi'), source);
  }, html);
}

function replaceInlineReference(html: string, reference: string, source: string) {
  if (!reference) return html;

  const variants = [reference, `<${reference}>`, encodeURIComponent(reference), encodeURIComponent(`<${reference}>`)];
  return variants.reduce((current, value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return current.replace(new RegExp(escaped, 'gi'), source);
  }, html);
}

function buildPreviewHtml(message: FullMessage, accountEmail: string, actor?: RCWebmailProps) {
  const gmailApi = createGmailApi({ userId: actor?.userId, userEmail: actor?.userEmail });
  const previewStyle = `
    <style>
      html { margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
      body { margin: 0; padding: 16px; font-family: Arial, Helvetica, sans-serif; line-height: 1.55; }
      img { height: auto !important; max-width: 100% !important; }
      table { max-width: 100% !important; }
      pre { white-space: pre-wrap; }
      a { color: #0f766e; }
    </style>
    <base target="_blank" />
  `;

  const resolvedHtml = message.attachments.reduce((current, attachment) => {
    const inlineSource = attachment.contentData
      ? `data:${attachment.mimeType || 'application/octet-stream'};base64,${toBase64(attachment.contentData)}`
      : gmailApi.attachmentUrl(accountEmail, message.id, attachment, { inline: true });

    let nextHtml = current;
    if (attachment.contentId) {
      nextHtml = replaceCidReference(nextHtml, attachment.contentId, inlineSource);
    }
    if (attachment.contentLocation) {
      nextHtml = replaceInlineReference(nextHtml, attachment.contentLocation, inlineSource);
    }
    return nextHtml;
  }, message.bodyHtml);

  if (/<head[\s>]/i.test(resolvedHtml)) {
    return resolvedHtml.replace(/<head([^>]*)>/i, `<head$1>${previewStyle}`);
  }

  if (/<html[\s>]/i.test(resolvedHtml)) {
    return resolvedHtml.replace(/<html([^>]*)>/i, `<html$1><head>${previewStyle}</head>`);
  }

  return `<!doctype html><html><head>${previewStyle}</head><body>${resolvedHtml}</body></html>`;
}

function buildReconnectMessage(scopes: string[] = []) {
  if (scopes.length === 0) {
    return 'Permissoes do Gmail insuficientes. Reconecte a conta.';
  }

  return `Permissoes do Gmail insuficientes. Reconecte a conta e aceite: ${scopes.join(', ')}.`;
}

function buildTransmissionLimitMessage(compose: ComposeState) {
  const htmlBytes = new TextEncoder().encode(compose.bodyHtml || '').length;
  const textBytes = new TextEncoder().encode(htmlToPlainText(compose.bodyHtml || '')).length;
  const attachmentBytes = compose.files.reduce((total, file) => total + file.size, 0);
  const estimatedBytes = htmlBytes + textBytes + attachmentBytes;

  if (estimatedBytes <= MAX_TRANSMISSION_BYTES) {
    return null;
  }

  const hasVideo = compose.files.some((file) => file.type.startsWith('video/'));
  return `${hasVideo ? 'O video selecionado' : 'O conteudo do e-mail'} excede o limite de ${formatBytes(MAX_TRANSMISSION_BYTES)}.`;
}

type RCWebmailProps = {
  userId?: string | null;
  userEmail?: string | null;
};

export function RCWebmail({ userId, userEmail }: RCWebmailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const gmailApi = createGmailApi({ userId, userEmail });
  const activeSection = useMemo<MailSection>(
    () => (isSettingsRoute(location.pathname) ? 'settings' : getFolderFromRoute(location.pathname, location.search)),
    [location.pathname, location.search],
  );
  const activeFolder = activeSection === 'settings' ? getFolderFromRoute(location.pathname, location.search) : activeSection;
  const activeThreadId = params.id || getThreadIdFromPathname(location.pathname);
  const composeRouteOpen = isComposeRoute(location.pathname);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountEmail, setAccountEmail] = useState(DEFAULT_ACCOUNT);
  const [folder, setFolder] = useState<Folder>(activeFolder);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<FullMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<GmailConnectionStatus | null>(null);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [filters, setFilters] = useState({
    from: '',
    subject: '',
    content: '',
    after: '',
    before: '',
    status: '',
    hasAttachment: false,
  });
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [permissionIssue, setPermissionIssue] = useState<PermissionIssue>(null);

  const selectedAccount = accounts.find((account) => account.email === accountEmail) || null;
  const selectedDraft = drafts.find((draft) => draft.id === selectedMessage?.id) || null;
  const messageItems = folder === 'drafts' ? drafts : messages;
  const currentSectionLabel = activeSection === 'settings'
    ? settingsItem.label
    : folderItems.find((item) => item.id === folder)?.label || 'Entrada';
  const activePermissionIssue = permissionIssue
    || (selectedAccount?.needsReconnect
      ? {
          message: buildReconnectMessage(selectedAccount.missingScopes || []),
          missingScopes: selectedAccount.missingScopes || [],
        }
      : null);
  const visibleAttachments = selectedMessage?.attachments.filter((attachment) => !attachment.inline) || [];

  function clearComposeAndReturn(nextFolder: Folder = folder) {
    setCompose(emptyCompose);
    navigate(routeForFolder(nextFolder), { replace: true });
  }

  function openComposeModal() {
    navigate(`/email/compose?folder=${encodeURIComponent(folder)}`);
  }

  function openFolder(nextFolder: Folder) {
    setSelectedMessage(null);
    navigate(routeForFolder(nextFolder));
  }

  function openSettings() {
    setSelectedMessage(null);
    navigate(`/email/settings?folder=${encodeURIComponent(folder)}`);
  }

  function patchCompose(patch: Partial<ComposeState>) {
    setCompose((current) => ({ ...current, ...patch }));
  }

  async function run<T>(task: () => Promise<T>, successMessage?: string) {
    setBusy(true);
    setError('');

    try {
      const result = await task();
      setPermissionIssue(null);
      if (successMessage) {
        setStatus(successMessage);
      }
      return result;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Erro inesperado';

      if (caughtError instanceof ApiError && caughtError.code === 'insufficient_scope') {
        setPermissionIssue({
          message,
          missingScopes: Array.isArray(caughtError.details?.missingScopes)
            ? caughtError.details?.missingScopes.filter((item): item is string => typeof item === 'string')
            : [],
        });
      }

      setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function loadAccounts() {
    const result = await run(() => gmailApi.accounts());
    if (!result) return;

    setAccounts(result.accounts);

    if (result.accounts.length > 0) {
      setAccountEmail((current) => {
        const exists = result.accounts.some((account) => account.email === current);
        return exists ? current : result.accounts[0].email;
      });
    }
  }

  async function loadMessages(targetFolder: Folder = folder) {
    if (!selectedAccount) {
      setMessages([]);
      setDrafts([]);
      setSelectedMessage(null);
      return;
    }

    setLoadingMessages(true);
    if (targetFolder === 'drafts') {
      const result = await run(() => gmailApi.drafts(accountEmail));
      setLoadingMessages(false);

      if (result) {
        setDrafts(result.drafts);
        setMessages([]);
        if (!activeThreadId) {
          setSelectedMessage(null);
        }
      }

      return;
    }

    const result = await run(() => gmailApi.messages(accountEmail, targetFolder, filters));
    setLoadingMessages(false);

    if (result) {
      setMessages(result.messages);
      setDrafts([]);

      if (!activeThreadId) {
        setSelectedMessage(null);
      }
    }
  }

  async function loadSidePanels() {
    if (!selectedAccount) {
      setOutbox([]);
      setLogs([]);
      return;
    }

    const result = await run(async () => {
      const [outboxResult, logsResult] = await Promise.all([
        gmailApi.outbox(accountEmail),
        gmailApi.logs(accountEmail),
      ]);
      return { outboxResult, logsResult };
    });

    if (result) {
      setOutbox(result.outboxResult.outbox);
      setLogs(result.logsResult.logs);
    }
  }

  async function reloadWorkspace(successMessage?: string) {
    if (!selectedAccount) return;

    const selectedId = selectedMessage?.id;
    const mailboxRequest = folder === 'drafts'
      ? gmailApi.drafts(accountEmail).then((mailbox) => ({ ...mailbox, messages: undefined }))
      : gmailApi.messages(accountEmail, folder, filters).then((mailbox) => ({ ...mailbox, drafts: undefined }));

    const result = await run(async () => {
      const [messageResult, outboxResult, logsResult, detailResult] = await Promise.all([
        mailboxRequest,
        gmailApi.outbox(accountEmail),
        gmailApi.logs(accountEmail),
        selectedId ? gmailApi.message(accountEmail, selectedId) : Promise.resolve(null),
      ]);

      return { messageResult, outboxResult, logsResult, detailResult };
    }, successMessage);

    if (result) {
      if (folder === 'drafts' && result.messageResult.drafts) {
        setDrafts(result.messageResult.drafts);
        setMessages([]);
      } else if (result.messageResult.messages) {
        setMessages(result.messageResult.messages);
        setDrafts([]);
      }
      setOutbox(result.outboxResult.outbox);
      setLogs(result.logsResult.logs);
      setSelectedMessage(result.detailResult?.message || null);
    }
  }

  async function openMessage(messageId: string) {
    navigate(`/email/thread/${messageId}?folder=${encodeURIComponent(folder)}`);
    const result = await run(() => gmailApi.message(accountEmail, messageId));
    if (result) {
      setSelectedMessage(result.message);
    }
  }

  async function loadConnectionStatus() {
    if (!selectedAccount) {
      setConnectionStatus(null);
      return;
    }

    const result = await run(() => gmailApi.status(accountEmail));
    if (result) {
      setConnectionStatus(result);
    }
  }

  async function connectAccount() {
    const result = await run(() => gmailApi.startOAuth(accountEmail));
    if (result?.url) {
      window.location.href = result.url;
    }
  }

  async function disconnectAccountHandler() {
    const result = await run(() => gmailApi.disconnect(accountEmail), 'Conta desconectada');
    if (result) {
      setSelectedMessage(null);
      setOutbox([]);
      setLogs([]);
      setMessages([]);
      setDrafts([]);
      await loadAccounts();
    }
  }

  async function applyAction(action: 'mark_read' | 'mark_unread' | 'archive' | 'trash' | 'restore', successMessage: string) {
    if (!selectedMessage) return;

    const result = await run(
      () => gmailApi.messageAction(accountEmail, selectedMessage.id, action),
      successMessage,
    );

    if (result) {
      await reloadWorkspace(successMessage);
    }
  }

  async function sendDraftHandler() {
    if (!selectedDraft) return;

    const result = await run(
      () => gmailApi.sendDraft(accountEmail, selectedDraft.draftId),
      'Rascunho enviado',
    );

    if (result) {
      setSelectedMessage(null);
    navigate('/email/sent');
    }
  }

  async function deleteDraftHandler() {
    const draftToDelete = drafts.find((d) => d.id === selectedMessage?.id) || 
                         (selectedMessage as any)?.draftId ? { draftId: (selectedMessage as any).draftId } : null;

    if (!draftToDelete) {
      setError('Nao foi possivel localizar o ID do rascunho para exclusao.');
      return;
    }

    const draftId = (draftToDelete as any).draftId;
    if (!draftId) {
      setError('ID do rascunho invalido.');
      return;
    }

    const result = await run(() => gmailApi.deleteDraft(accountEmail, draftId), 'Rascunho excluido');
    if (result) {
      setSelectedMessage(null);
      void loadMessages('drafts');
    }
  }

  async function sendOutboxMessage(id: string) {
    const result = await run(() => gmailApi.sendOutbox(accountEmail, id), 'Mensagem enviada');
    if (result) {
      await reloadWorkspace('Mensagem enviada');
    }
  }

  async function deleteOutboxMessage(id: string) {
    const result = await run(() => gmailApi.deleteOutbox(accountEmail, id), 'Item removido da fila');
    if (result) {
      await loadSidePanels();
    }
  }

  async function emptyTrashHandler() {
    const result = await run(() => gmailApi.emptyTrash(accountEmail), 'Lixeira esvaziada');
    setShowEmptyTrashConfirm(false);
    if (result) {
      await reloadWorkspace('Lixeira esvaziada');
    }
  }

  function validateComposeFiles(files: File[]) {
    const mergedFiles = [...compose.files, ...files];
    if (mergedFiles.length > 10) {
      return 'O limite atual e de 10 anexos por mensagem.';
    }

    return buildTransmissionLimitMessage({ ...compose, files: mergedFiles });
  }

  function addFiles(files: File[]) {
    const message = validateComposeFiles(files);
    if (message) {
      setError(message);
      return;
    }

    patchCompose({ files: [...compose.files, ...files] });
  }

  function isValidEmail(email: string) {
    const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return regex.test(email.trim());
  }

  function validateEmails(emails: string) {
    if (!emails.trim()) return true;
    return emails.split(',').every(email => isValidEmail(email.trim()));
  }

  const validateFieldNavigation = (e: React.KeyboardEvent<HTMLInputElement>, field: string, value: string) => {
    const isNavigationKey = e.key === 'Tab' || e.key === 'Enter' || e.key === 'ArrowRight';
    
    if (isNavigationKey) {
      if (e.key === 'ArrowRight' && e.currentTarget.selectionStart !== value.length) {
        return;
      }

      if (['to', 'cc', 'bcc'].includes(field)) {
        if (value.trim() && !validateEmails(value)) {
          const label = field === 'to' ? 'Para' : field === 'cc' ? 'Cc' : 'Cco';
          setError(`O formato de e-mail no campo '${label}' é inválido.`);
        }
      }
    }
  };

  async function submitCompose(mode: 'send' | 'queue' | 'draft') {
    if (mode !== 'draft') {
      if (!compose.to.trim()) {
        setError('O campo "Para" e obrigatorio.');
        return;
      }
      if (!compose.subject.trim()) {
        setError('O campo "Assunto" e obrigatorio.');
        return;
      }
      if (!htmlToPlainText(compose.bodyHtml).trim()) {
        setError('O "Corpo do email" e obrigatorio.');
        return;
      }

      if (!validateEmails(compose.to)) {
        setError('Um ou mais e-mails no campo "Para" sao invalidos.');
        return;
      }
      if (!validateEmails(compose.cc)) {
        setError('Um ou mais e-mails no campo "Cc" sao invalidos.');
        return;
      }
      if (!validateEmails(compose.bcc)) {
        setError('Um ou mais e-mails no campo "Cco" sao invalidos.');
        return;
      }
    }

    const limitMessage = buildTransmissionLimitMessage(compose);
    if (limitMessage) {
      setError(limitMessage);
      return;
    }

    const formData = new FormData();
    formData.append('accountEmail', accountEmail);
    formData.append('to', compose.to);
    formData.append('cc', compose.cc);
    formData.append('bcc', compose.bcc);
    formData.append('subject', compose.subject);
    formData.append('bodyHtml', compose.bodyHtml);
    formData.append('bodyText', htmlToPlainText(compose.bodyHtml));
    compose.files.forEach((file) => formData.append('attachments', file));

    const result = await run(
      () => {
        if (mode === 'send') return gmailApi.send(formData);
        if (mode === 'draft') return gmailApi.createDraft(formData);
        return gmailApi.createOutbox(formData);
      },
      mode === 'send'
        ? 'Mensagem enviada'
        : mode === 'draft'
          ? 'Rascunho salvo no Gmail'
          : 'Mensagem adicionada a fila local',
    );

    if (result) {
      const nextFolder = mode === 'draft' ? 'drafts' : folder;
      clearComposeAndReturn(nextFolder);
      await reloadWorkspace(
        mode === 'send'
          ? 'Mensagem enviada'
          : mode === 'draft'
            ? 'Rascunho salvo no Gmail'
            : 'Mensagem adicionada a fila local',
      );
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  useEffect(() => {
    setFolder(activeFolder);
    if (activeSection === 'settings') {
      setSelectedMessage(null);
      if (selectedAccount) {
        void loadConnectionStatus();
      }
      return;
    }

    if (!selectedAccount) return;
    void loadMessages(activeFolder);
    void loadSidePanels();
  }, [accountEmail, activeFolder, activeSection, selectedAccount?.email]);

  useEffect(() => {
    const routeParams = new URLSearchParams(location.search);
    const connected = routeParams.get('webmail');
    const nextAccount = routeParams.get('account');

    if (connected === 'connected') {
      setStatus('Conta Gmail conectada com sucesso.');
      if (nextAccount) {
        setAccountEmail(nextAccount);
      }

      routeParams.delete('webmail');
      routeParams.delete('account');
      const nextQuery = routeParams.toString();
      navigate(`${location.pathname}${nextQuery ? `?${nextQuery}` : ''}`, { replace: true });
      void loadAccounts();
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    setShowComposeModal(composeRouteOpen);
  }, [composeRouteOpen]);

  useEffect(() => {
    if (!status) return;
    const timeoutId = window.setTimeout(() => setStatus(''), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(''), 6500);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    if (!activeThreadId || activeSection === 'settings' || messageItems.length === 0 || selectedMessage?.id === activeThreadId) {
      return;
    }

    const exists = messageItems.some((message) => message.id === activeThreadId);
    if (exists) {
      void openMessage(activeThreadId);
    }
  }, [activeSection, activeThreadId, messageItems, selectedMessage?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeSection === 'settings' || !messageItems.length) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      event.preventDefault();
      const currentIndex = messageItems.findIndex((m) => m.id === selectedMessage?.id);
      let nextIndex = -1;

      if (event.key === 'ArrowUp') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : messageItems.length - 1;
      } else {
        nextIndex = currentIndex < messageItems.length - 1 ? currentIndex + 1 : 0;
      }

      if (nextIndex !== -1) {
        const nextMessage = messageItems[nextIndex];
        void openMessage(nextMessage.id);
        
        // Garantir que o item fique visivel
        const element = document.getElementById(`msg-${nextMessage.id}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, messageItems, selectedMessage?.id, openMessage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-2 sm:px-6 md:px-8">
      <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0c1826]">Gmail integrado</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openComposeModal()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b58c2a] px-6 py-2 text-sm font-bold text-white shadow-md shadow-[#b58c2a]/20 transition-all hover:bg-[#a17c1f] hover:shadow-lg active:scale-95"
            >
              <MailPlus size={18} />
              Novo E-mail
            </button>
            <button
              onClick={() => void (activeSection === 'settings' ? loadConnectionStatus() : reloadWorkspace('Dados atualizados'))}
              disabled={busy || !selectedAccount}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-[#b58c2a]/40 hover:bg-[#fffaf0] hover:text-[#b58c2a] disabled:opacity-50"
              title="Sincronizar agora"
            >
              <RefreshCcw size={18} className={(loadingMessages || busy) ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => openSettings()}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all ${
                activeSection === 'settings'
                  ? 'border-[#b58c2a] bg-[#fffaf0] text-[#b58c2a]'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-[#b58c2a]/40 hover:bg-[#fffaf0] hover:text-[#b58c2a]'
              }`}
              title="Configuracoes"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {activePermissionIssue && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertCircle size={14} />
            </div>
            {activePermissionIssue.message}
          </div>
        )}
      </section>

      {!selectedAccount ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0c1826] text-white">
              <Mail size={28} />
            </div>
            <h3 className="mt-5 text-2xl font-black text-[#0c1826]">Conecte o Gmail da corretora</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              O Webmail agora roda integralmente dentro da estrutura principal da RC Molina Seguros, sem depender
              da aplicacao legada separada.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void connectAccount()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b58c2a] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#a17c1f]"
              >
                <Mail size={16} />
                Iniciar conexao OAuth
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid h-[calc(100vh-180px)] min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(340px,420px)_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Caixas</p>
              <div className="mt-3 space-y-2">
                {folderItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection !== 'settings' && folder === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openFolder(item.id)}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left transition ${
                        active
                          ? 'bg-black text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={15} className={active ? 'text-[#d4af37]' : 'text-slate-400'} />
                        <span className="text-xs font-bold">{item.label}</span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={openSettings}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left transition ${
                    activeSection === 'settings'
                      ? 'bg-black text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Settings2
                      size={15}
                      className={activeSection === 'settings' ? 'text-[#d4af37]' : 'text-slate-400'}
                    />
                    <span className="text-xs font-bold">{settingsItem.label}</span>
                  </span>
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Filtros</p>
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      from: '',
                      subject: '',
                      content: '',
                      after: '',
                      before: '',
                      status: '',
                      hasAttachment: false,
                    })
                  }
                  className="text-xs font-bold text-slate-400 transition hover:text-[#b58c2a]"
                >
                  Limpar
                </button>
              </div>
              {activeSection === 'settings' ? (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm font-semibold text-slate-400">
                  As configuracoes exibem o status OAuth, escopos e o vinculo da conta ao usuario autenticado.
                </div>
              ) : folder === 'drafts' ? (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm font-semibold text-slate-400">
                  Os rascunhos usam a lista do Gmail. Filtros avancados ficam disponiveis nas caixas de mensagens.
                </div>
              ) : (
              <div className="mt-3 space-y-3">
                <input
                  value={filters.from}
                  onChange={(event) => setFilters({ ...filters, from: event.target.value })}
                  placeholder="Remetente"
                  className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <input
                  value={filters.subject}
                  onChange={(event) => setFilters({ ...filters, subject: event.target.value })}
                  placeholder="Assunto"
                  className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <input
                  value={filters.content}
                  onChange={(event) => setFilters({ ...filters, content: event.target.value })}
                  placeholder="Conteudo"
                  className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.after}
                    onChange={(event) => setFilters({ ...filters, after: event.target.value })}
                    className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                  />
                  <input
                    type="date"
                    value={filters.before}
                    onChange={(event) => setFilters({ ...filters, before: event.target.value })}
                    className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                  />
                </div>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                  className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                >
                  <option value="">Status</option>
                  <option value="unread">Nao lidas</option>
                  <option value="read">Lidas</option>
                </select>
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={filters.hasAttachment}
                    onChange={(event) => setFilters({ ...filters, hasAttachment: event.target.checked })}
                  />
                  Somente com anexo
                </label>
                <button
                  type="button"
                  onClick={() => void loadMessages()}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#0c1826] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#16283c] focus:outline-none focus:ring-2 focus:ring-[#b58c2a]/50"
                >
                  <Search size={16} />
                  Buscar
                </button>
              </div>
              )}
            </section>

            </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[28px] rounded-b-none border border-slate-200 border-b-0 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Mensagens</p>
                <h3 className="mt-0.5 text-base font-black text-[#0c1826]">
                  {currentSectionLabel}
                </h3>
              </div>
              {folder === 'trash' && activeSection !== 'settings' ? (
                <button
                  type="button"
                  onClick={() => setShowEmptyTrashConfirm(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                >
                  <Trash2 size={15} />
                  Limpar lixeira
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {activeSection === 'settings' ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="grid gap-3">
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Status OAuth</p>
                    <h4 className="mt-1 text-lg font-black text-[#0c1826]">
                      {connectionStatus?.connected ? 'Conta conectada' : 'Conta desconectada'}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Conta: {connectionStatus?.email || accountEmail}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Usuario RC Molina: {userEmail || 'nao identificado'} {userId ? `(${userId})` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Estado atual: {connectionStatus?.status || 'sem vinculo registrado'}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Escopos e reconexao</p>
                    {(connectionStatus?.missingScopes || []).length > 0 ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                        Faltam permissoes: {(connectionStatus?.missingScopes || []).join(', ')}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        Os escopos principais do Gmail estao completos.
                      </div>
                    )}
                    {(connectionStatus?.missingTrashScopes || []).length > 0 ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                        Escopo para limpar lixeira pendente: {(connectionStatus?.missingTrashScopes || []).join(', ')}
                      </div>
                    ) : null}
                  </article>
                </div>
              </div>
              ) : loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[#b58c2a]" />
                </div>
              ) : messageItems.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-semibold text-slate-400">
                  {folder === 'drafts' ? 'Nenhum rascunho encontrado.' : 'Nenhuma mensagem encontrada.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {messageItems.map((message) => (
                    <button
                      key={message.id}
                      id={`msg-${message.id}`}
                      type="button"
                      onClick={() => void openMessage(message.id)}
                      className={`flex w-full flex-col rounded-2xl border px-3 py-2.5 text-left transition ${
                        selectedMessage?.id === message.id
                          ? 'border-[#b58c2a]/50 bg-[#fffaf0]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-xs font-black ${message.unread ? 'text-[#0c1826]' : 'text-slate-700'}`}>
                            {compactSender(message.from || message.to)}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                            {message.subject || '(sem assunto)'}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-slate-400">
                          {formatDateTime(message.internalDate)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="line-clamp-2 text-xs text-slate-500">{message.snippet || 'Sem previa.'}</p>
                        <span className="shrink-0 text-[11px] font-bold text-slate-400">
                          {formatBytes(message.size)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[28px] rounded-b-none border border-slate-200 border-b-0 bg-white shadow-sm">
            {activeSection === 'settings' ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between px-5 py-4">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Conexao Gmail</p>
                  <h3 className="mt-1 text-lg font-black text-[#0c1826]">
                    Painel de configuracoes do Webmail
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    Esta area usa a autenticacao principal da RC Molina Seguros.
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">Conta vinculada</p>
                    <p className="mt-1 text-base font-black text-[#0c1826]">
                      {connectionStatus?.email || selectedAccount?.email || accountEmail}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Usuario autenticado: {userEmail || 'nao identificado'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Configuracoes de Conta</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-slate-400 uppercase">Selecionar Conta</p>
                        <select
                          value={accountEmail}
                          onChange={(event) => setAccountEmail(event.target.value)}
                          className="w-full min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                        >
                          {accounts.length > 0 ? (
                            accounts.map((account) => (
                              <option key={account.email} value={account.email}>
                                {account.email}
                              </option>
                            ))
                          ) : (
                            <option value={DEFAULT_ACCOUNT}>{DEFAULT_ACCOUNT}</option>
                          )}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => void connectAccount()}
                          disabled={busy}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0c1826] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#16283c] disabled:opacity-60"
                        >
                          <Mail size={16} />
                          {selectedAccount ? 'Reconectar Gmail' : 'Conectar Gmail'}
                        </button>
                        {selectedAccount ? (
                          <button
                            type="button"
                            onClick={() => void disconnectAccountHandler()}
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
                          >
                            <Unplug size={16} />
                            Desconectar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Mensagens (Logs)</p>
                    <div className="mt-3 space-y-2">
                      {logs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm font-semibold text-slate-400">
                          Nenhum registro de log encontrado.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {logs.slice(0, 10).map((log) => (
                            <div key={log.id} className="rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
                                {log.event_type}
                              </p>
                              <p className="mt-1 text-[13px] font-semibold text-[#0c1826] leading-relaxed">{log.message}</p>
                              <p className="mt-1 text-[10px] font-bold text-slate-400">{formatDateTime(log.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedMessage ? (
              <>
                <div className="border-b border-slate-100 px-6 py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-2xl font-black text-[#0c1826]">
                        {selectedMessage.subject || '(sem assunto)'}
                      </h3>
                      <div className="mt-4 flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0c1826] text-sm font-black text-white">
                          {senderInitial(selectedMessage.from)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#0c1826]">
                            {compactSender(selectedMessage.from)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Para: {selectedMessage.to || '-'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{formatDateTime(selectedMessage.internalDate)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {folder === 'drafts' && selectedDraft ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void sendDraftHandler()}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#b58c2a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#a17c1f]"
                          >
                            <Send size={14} />
                            Enviar rascunho
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteDraftHandler()}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Excluir rascunho
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void applyAction('mark_read', 'Mensagem marcada como lida')}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                          >
                            <MailOpen size={14} />
                            Lida
                          </button>
                          <button
                            type="button"
                            onClick={() => void applyAction('mark_unread', 'Mensagem marcada como nao lida')}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                          >
                            <Mail size={14} />
                            Nao lida
                          </button>
                          {folder !== 'trash' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void applyAction('archive', 'Mensagem arquivada')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                              >
                                <Archive size={14} />
                                Arquivar
                              </button>
                              <button
                                type="button"
                                onClick={() => void applyAction('trash', 'Mensagem movida para lixeira')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                              >
                                <Trash2 size={14} />
                                Lixeira
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void applyAction('restore', 'Mensagem restaurada')}
                              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                            >
                              <Undo2 size={14} />
                              Restaurar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {visibleAttachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-4">
                    {visibleAttachments.map((attachment) => (
                      <a
                        key={attachment.attachmentId}
                        href={gmailApi.attachmentUrl(accountEmail, selectedMessage.id, attachment)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                      >
                        <Download size={14} />
                        {attachment.filename}
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  {selectedMessage.bodyHtml ? (
                    <iframe
                      title="Conteudo do e-mail"
                      className="min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white"
                      sandbox=""
                      srcDoc={buildPreviewHtml(selectedMessage, accountEmail, { userId, userEmail })}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                      {selectedMessage.bodyText || 'Mensagem sem conteudo.'}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                  <Mail size={28} />
                </div>
                <h3 className="mt-5 text-xl font-black text-[#0c1826]">Selecione uma mensagem</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  A leitura abre no painel da direita com suporte a HTML seguro em iframe, anexos e acoes do Gmail.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {showComposeModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
                  Novo e-mail
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#0c1826]">Compor mensagem</h3>
              </div>
              <button
                type="button"
                onClick={() => clearComposeAndReturn()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-6">
              {error && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm animate-in fade-in slide-in-from-top-1">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertCircle size={14} />
                  </div>
                  {error}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={compose.to}
                  onChange={(event) => patchCompose({ to: event.target.value })}
                  onKeyDown={(e) => validateFieldNavigation(e, 'to', compose.to)}
                  onBlur={() => !validateEmails(compose.to) && setError('O formato de e-mail no campo \'Para\' é inválido.')}
                  placeholder="Para"
                  className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <input
                  value={compose.cc}
                  onChange={(event) => patchCompose({ cc: event.target.value })}
                  onKeyDown={(e) => validateFieldNavigation(e, 'cc', compose.cc)}
                  onBlur={() => !validateEmails(compose.cc) && setError('O formato de e-mail no campo \'Cc\' é inválido.')}
                  placeholder="Cc"
                  className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <input
                  value={compose.bcc}
                  onChange={(event) => patchCompose({ bcc: event.target.value })}
                  onKeyDown={(e) => validateFieldNavigation(e, 'bcc', compose.bcc)}
                  onBlur={() => !validateEmails(compose.bcc) && setError('O formato de e-mail no campo \'Cco\' é inválido.')}
                  placeholder="Cco"
                  className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
                <input
                  value={compose.subject}
                  onChange={(event) => patchCompose({ subject: event.target.value })}
                  placeholder="Assunto"
                  className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
                />
              </div>

              <div className="mt-5">
                <Suspense
                  fallback={
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      Carregando editor de e-mail...
                    </div>
                  }
                >
                  <EmailRichTextEditor
                    disabled={busy}
                    value={compose.bodyHtml}
                    onChange={(html) => patchCompose({ bodyHtml: html })}
                    validateFiles={validateComposeFiles}
                    onValidationError={(message) => setError(message)}
                    onFilesAdded={(files) => addFiles(files)}
                  />
                </Suspense>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => addFiles(Array.from(event.target.files || []))}
                  />
                  <Download size={16} />
                  Anexar arquivos
                </label>

                <span className="text-xs font-semibold text-slate-400">
                  Limite estimado: {formatBytes(MAX_TRANSMISSION_BYTES)}
                </span>
              </div>
              {compose.files.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {compose.files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#0c1826]">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          patchCompose({
                            files: compose.files.filter((_, fileIndex) => fileIndex !== index),
                          })
                        }
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:text-red-600"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5">
                <div className="text-xs text-slate-400">Conta de envio: {accountEmail}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void submitCompose('queue')}
                    disabled={busy}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
                  >
                    <Archive size={16} />
                    Enviar depois
                  </button>
                <button
                  type="button"
                  onClick={() => void submitCompose('send')}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b58c2a] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a17c1f]"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Enviar agora
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showEmptyTrashConfirm ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white shadow-2xl">
            <div className="px-6 py-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-500">Confirmacao</p>
              <h3 className="mt-1 text-2xl font-black text-[#0c1826]">Limpar lixeira</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Esta acao remove permanentemente todos os e-mails da lixeira da conta conectada.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowEmptyTrashConfirm(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void emptyTrashHandler()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <Trash2 size={16} />
                Limpar agora
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status && !showComposeModal ? (
        <div className="fixed bottom-5 right-5 z-[130] inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={16} />
          {status}
        </div>
      ) : null}
    </div>
  );
}
