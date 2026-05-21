import { AlertCircle, Archive, CheckCircle2, Download, Loader2, Send, X } from "lucide-react";
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { EmailRichTextEditorProps } from "../webmail/email_rich_text_editor";
import { createGmailApi, type Account, ApiError } from "../../lib/gmail_api";

const EmailRichTextEditor = lazy(async () => {
  const module = await import("../webmail/email_rich_text_editor");
  return { default: module.EmailRichTextEditor };
}) as ComponentType<EmailRichTextEditorProps>;

const DEFAULT_ACCOUNT = "rcmolina.invest.segurosaude@gmail.com";
const MAX_TRANSMISSION_BYTES = 25 * 1024 * 1024;

export interface EmailComposeModalProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userEmail: string | null;
  initialTo?: string;
  initialSubject?: string;
  initialBodyHtml?: string;
  initialFiles?: File[];
}

type ComposeState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  files: File[];
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${Math.max(1, Math.round(value / (1024 * 1024)))} MB`;
  }
  return `${Math.max(1, Math.round(value / (1024 * 1024 * 1024)))} GB`;
}

function htmlToPlainText(value: string) {
  if (!value.trim()) return "";
  const documentFragment = new DOMParser().parseFromString(value, "text/html");
  return (documentFragment.body.innerText || documentFragment.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function EmailComposeModal({
  open,
  onClose,
  userId,
  userEmail,
  initialTo = "",
  initialSubject = "",
  initialBodyHtml = "",
  initialFiles = [],
}: EmailComposeModalProps) {
  const actor = useMemo(
    () => (userId && userEmail ? { userId, userEmail } : undefined),
    [userId, userEmail]
  );
  const gmailApi = useMemo(() => createGmailApi(actor), [actor]);

  const [compose, setCompose] = useState<ComposeState>({
    to: initialTo,
    cc: "",
    bcc: "",
    subject: initialSubject,
    bodyHtml: initialBodyHtml,
    files: initialFiles || [],
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountEmail, setAccountEmail] = useState(userEmail || DEFAULT_ACCOUNT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [permissionIssue, setPermissionIssue] = useState<{
    message: string;
    missingScopes: string[];
  } | null>(null);

  const lastOpenRef = useRef(false);

  useEffect(() => {
    if (open && !lastOpenRef.current) {
      setCompose({
        to: initialTo,
        cc: "",
        bcc: "",
        subject: initialSubject,
        bodyHtml: initialBodyHtml,
        files: initialFiles || [],
      });
      setError(null);
      setFieldErrors({});
      setStatus(null);
      setPermissionIssue(null);
      void loadAccounts();
    }
    lastOpenRef.current = open;
  }, [open, initialTo, initialSubject, initialBodyHtml, initialFiles]);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
        onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  async function loadAccounts() {
    try {
      const result = await gmailApi.accounts();
      if (result?.accounts && result.accounts.length > 0) {
        setAccounts(result.accounts);
        const exists = result.accounts.some((acc) => acc.email === accountEmail);
        if (!exists) {
          const userAccount = result.accounts.find((acc) => acc.email === userEmail);
          setAccountEmail(userAccount ? userAccount.email : result.accounts[0].email);
        }
      } else {
        setAccounts([]);
        setAccountEmail(userEmail || DEFAULT_ACCOUNT);
      }
    } catch (err) {
      console.error("Erro ao carregar contas do Gmail no modal:", err);
    }
  }

  function patchCompose(patch: Partial<ComposeState>) {
    setCompose((current) => ({ ...current, ...patch }));
  }

  function validateComposeFiles(files: File[]) {
    const mergedFiles = [...compose.files, ...files];
    if (mergedFiles.length > 10) {
      return "O limite atual é de 10 anexos por mensagem.";
    }
    return buildTransmissionLimitMessage({ ...compose, files: mergedFiles });
  }

  function buildTransmissionLimitMessage(targetCompose: ComposeState) {
    const htmlBytes = new TextEncoder().encode(targetCompose.bodyHtml || "").length;
    const textBytes = new TextEncoder().encode(htmlToPlainText(targetCompose.bodyHtml || "")).length;
    const attachmentBytes = targetCompose.files.reduce((total, file) => total + file.size, 0);
    const estimatedBytes = htmlBytes + textBytes + attachmentBytes;

    if (estimatedBytes <= MAX_TRANSMISSION_BYTES) {
      return null;
    }

    const hasVideo = targetCompose.files.some((file) => file.type.startsWith("video/"));
    return `${hasVideo ? "O vídeo selecionado" : "O conteúdo do e-mail"} excede o limite de ${formatBytes(MAX_TRANSMISSION_BYTES)}.`;
  }

  function addFiles(files: File[]) {
    const validationError = validateComposeFiles(files);
    if (validationError) {
      setError(validationError);
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
    return emails.split(",").every((email) => isValidEmail(email.trim()));
  }

  const validateFieldNavigation = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "to" | "cc" | "bcc",
    value: string
  ) => {
    const isNavigationKey = e.key === "Tab" || e.key === "Enter" || e.key === "ArrowRight";

    if (isNavigationKey) {
      if (e.key === "ArrowRight" && e.currentTarget.selectionStart !== value.length) {
        return;
      }

      if (value.trim() && !validateEmails(value)) {
        e.preventDefault();
        const label = field === "to" ? "Para" : field === "cc" ? "Cc" : "Cco";
        setFieldErrors((prev) => ({
          ...prev,
          [field]: `O formato de e-mail no campo '${label}' é inválido.`,
        }));
      } else {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    }
  };

  const handleFieldBlur = (
    e: React.FocusEvent<HTMLInputElement>,
    field: "to" | "cc" | "bcc",
    value: string
  ) => {
    if (value.trim() && !validateEmails(value)) {
      const label = field === "to" ? "Para" : field === "cc" ? "Cc" : "Cco";
      setFieldErrors((prev) => ({
        ...prev,
        [field]: `O formato de e-mail no campo '${label}' é inválido.`,
      }));
      const target = e.target;
      window.requestAnimationFrame(() => {
        target.focus();
      });
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  function applyApiError(caughtError: unknown, fallbackMessage = "Erro inesperado") {
    const msg = caughtError instanceof Error ? caughtError.message : fallbackMessage;

    if (caughtError instanceof ApiError && caughtError.code === "insufficient_scope") {
      setPermissionIssue({
        message: msg,
        missingScopes: Array.isArray(caughtError.details?.missingScopes)
          ? caughtError.details?.missingScopes.filter((item): item is string => typeof item === "string")
          : [],
      });
    }

    setError(msg);
    return null;
  }

  async function run<T>(task: () => Promise<T>, successMessage?: string) {
    setBusy(true);
    setError("");

    try {
      const result = await task();
      setPermissionIssue(null);
      if (successMessage) {
        setStatus(successMessage);
      }
      return result;
    } catch (caughtError) {
      return applyApiError(caughtError);
    } finally {
      setBusy(false);
    }
  }

  async function submitCompose(mode: "send" | "queue" | "draft") {
    if (mode !== "draft") {
      if (!compose.to.trim()) {
        setError('O campo "Para" é obrigatório.');
        return;
      }
      if (!compose.subject.trim()) {
        setError('O campo "Assunto" é obrigatório.');
        return;
      }
      if (!htmlToPlainText(compose.bodyHtml).trim()) {
        setError('O "Corpo do e-mail" é obrigatório.');
        return;
      }

      if (!validateEmails(compose.to)) {
        setError('Um ou mais e-mails no campo "Para" são inválidos.');
        return;
      }
      if (!validateEmails(compose.cc)) {
        setError('Um ou mais e-mails no campo "Cc" são inválidos.');
        return;
      }
      if (!validateEmails(compose.bcc)) {
        setError('Um ou mais e-mails no campo "Cco" são inválidos.');
        return;
      }
    }

    const limitMessage = buildTransmissionLimitMessage(compose);
    if (limitMessage) {
      setError(limitMessage);
      return;
    }

    const formData = new FormData();
    formData.append("accountEmail", accountEmail);
    formData.append("to", compose.to);
    formData.append("cc", compose.cc);
    formData.append("bcc", compose.bcc);
    formData.append("subject", compose.subject);
    formData.append("bodyHtml", compose.bodyHtml);
    formData.append("bodyText", htmlToPlainText(compose.bodyHtml));
    compose.files.forEach((file) => formData.append("attachments", file));

    await run(
      () => {
        if (mode === "send") return gmailApi.send(formData);
        if (mode === "draft") return gmailApi.createDraft(formData);
        return gmailApi.createOutbox(formData);
      },
      mode === "send"
        ? "Mensagem enviada com sucesso!"
        : mode === "draft"
          ? "Rascunho salvo no Gmail!"
          : "Mensagem adicionada à fila local!"
    );
  }

  async function connectAccount() {
    const result = await run(() => gmailApi.startOAuth(accountEmail));
    if (result?.url) {
      window.location.href = result.url;
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Novo e-mail
            </p>
            <h3 className="mt-1 text-2xl font-black text-[#0c1826]">Compor mensagem</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm animate-in fade-in slide-in-from-top-1">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={14} />
              </div>
              {error}
            </div>
          )}

          {permissionIssue && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-in fade-in">
              <div className="flex gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertCircle size={14} />
                </div>
                <div className="text-sm">
                  <h4 className="font-bold text-[#0c1826]">Problema de permissão detectado</h4>
                  <p className="mt-1 font-semibold text-amber-800">{permissionIssue.message}</p>
                  <button
                    type="button"
                    onClick={() => void connectAccount()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#b58c2a] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#a17c1f]"
                  >
                    Reconectar conta agora
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <input
                value={compose.to}
                onChange={(event) => {
                  patchCompose({ to: event.target.value });
                  if (fieldErrors.to) setFieldErrors((prev) => ({ ...prev, to: undefined }));
                }}
                onKeyDown={(e) => validateFieldNavigation(e, "to", compose.to)}
                onBlur={(e) => handleFieldBlur(e, "to", compose.to)}
                placeholder="Para"
                className={`min-h-11 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 focus:ring-1 ${
                  fieldErrors.to
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-[#b58c2a] focus:ring-[#b58c2a]"
                }`}
              />
              {fieldErrors.to && (
                <p className="mt-1 ml-2 text-xs font-semibold text-red-500">{fieldErrors.to}</p>
              )}
            </div>

            <div>
              <input
                value={compose.cc}
                onChange={(event) => {
                  patchCompose({ cc: event.target.value });
                  if (fieldErrors.cc) setFieldErrors((prev) => ({ ...prev, cc: undefined }));
                }}
                onKeyDown={(e) => validateFieldNavigation(e, "cc", compose.cc)}
                onBlur={(e) => handleFieldBlur(e, "cc", compose.cc)}
                placeholder="Cc"
                className={`min-h-11 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 focus:ring-1 ${
                  fieldErrors.cc
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-[#b58c2a] focus:ring-[#b58c2a]"
                }`}
              />
              {fieldErrors.cc && (
                <p className="mt-1 ml-2 text-xs font-semibold text-red-500">{fieldErrors.cc}</p>
              )}
            </div>

            <div>
              <input
                value={compose.bcc}
                onChange={(event) => {
                  patchCompose({ bcc: event.target.value });
                  if (fieldErrors.bcc) setFieldErrors((prev) => ({ ...prev, bcc: undefined }));
                }}
                onKeyDown={(e) => validateFieldNavigation(e, "bcc", compose.bcc)}
                onBlur={(e) => handleFieldBlur(e, "bcc", compose.bcc)}
                placeholder="Cco"
                className={`min-h-11 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 focus:ring-1 ${
                  fieldErrors.bcc
                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-[#b58c2a] focus:ring-[#b58c2a]"
                }`}
              />
              {fieldErrors.bcc && (
                <p className="mt-1 ml-2 text-xs font-semibold text-red-500">{fieldErrors.bcc}</p>
              )}
            </div>

            <input
              value={compose.subject}
              onChange={(event) => patchCompose({ subject: event.target.value })}
              placeholder="Assunto"
              className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a]"
            />
          </div>

          {/* Editor */}
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
                onValidationError={(msg) => setError(msg)}
                onFilesAdded={(files) => addFiles(files)}
              />
            </Suspense>
          </div>

          {/* Attachments picker */}
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

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Conta de envio:</span>
            {accounts.length > 1 ? (
              <select
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:border-[#b58c2a] focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.email} value={acc.email}>
                    {acc.email}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#b58c2a] font-bold">{accountEmail}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submitCompose("queue")}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#b58c2a]/40 hover:text-[#b58c2a]"
            >
              <Archive size={16} />
              Enviar depois
            </button>
            <button
              type="button"
              onClick={() => void submitCompose("send")}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b58c2a] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a17c1f]"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar agora
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className="fixed bottom-5 right-5 z-[130] inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-in fade-in duration-300">
          <CheckCircle2 size={16} />
          {status}
        </div>
      )}
    </div>
  );
}
