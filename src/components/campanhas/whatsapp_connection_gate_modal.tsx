import { Loader2, LogOut, QrCode, RefreshCcw, ShieldCheck, Smartphone, Sparkles, Wifi, WifiOff } from "lucide-react";
import { createPortal } from "react-dom";

import type { WhatsAppBridgeStatus } from "../../types/whatsapp_campaign";

interface WhatsAppConnectionGateModalProps {
  open: boolean;
  status: WhatsAppBridgeStatus | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

const statusLabel: Record<WhatsAppBridgeStatus["status"], string> = {
  disabled: "Desabilitado",
  disconnected: "Desconectado",
  connecting: "Conectando",
  qr: "Aguardando QR",
  logging_in: "Validando sessão",
  connected: "Conectado",
};

const statusTone: Record<WhatsAppBridgeStatus["status"], string> = {
  disabled: "border-slate-200 bg-slate-100 text-slate-500",
  disconnected: "border-rose-200 bg-rose-50 text-rose-600",
  connecting: "border-amber-200 bg-amber-50 text-amber-700",
  qr: "border-[#d4af37]/40 bg-[#fff8e1] text-[#9a7418]",
  logging_in: "border-sky-200 bg-sky-50 text-sky-700",
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function WhatsAppConnectionGateModal({
  open,
  status,
  isLoading,
  isLoggingOut,
  onRefresh,
  onLogout,
}: WhatsAppConnectionGateModalProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  const connectionState = status?.status || "connecting";
  const showQr = Boolean(status?.qrAvailable && status?.qrSvg);
  const statusMessage =
    connectionState === "qr"
      ? "Escaneie o QR code com o WhatsApp do aparelho que vai operar os disparos."
      : connectionState === "logging_in"
        ? "A leitura foi recebida. Aguarde a liberação da sessão para entrar no módulo."
        : connectionState === "connecting"
          ? "Estamos preparando a sessão do WhatsApp antes de liberar a tela principal."
          : connectionState === "disconnected"
            ? "A sessão ainda não está conectada. Aguarde o QR code ou atualize o status."
            : "Conclua a conexão do WhatsApp para continuar.";

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#d4af3720,transparent_34%),radial-gradient(circle_at_bottom_right,#0c182640,transparent_38%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/70 bg-white/95 shadow-[0_40px_120px_rgba(15,23,42,0.35)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden bg-[#0c1826] px-6 py-7 text-white sm:px-8 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d4af37] via-[#f4d67b] to-[#d4af37]" />
          <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-[#d4af37]/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />

          <div className="relative space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#f4d67b]">
                <Sparkles size={14} strokeWidth={1.9} />
                Campanhas RC Molina
              </div>
              <div>
                <h2 className="max-w-md text-2xl font-black tracking-tight sm:text-[2rem]">
                  Conecte o WhatsApp antes de abrir o painel de campanhas
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-white/72">
                  A autenticação fica centralizada nesta etapa. Assim que a sessão for validada, a tela principal do módulo será liberada automaticamente.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d4af37]/12 text-[#f4d67b] ring-1 ring-[#d4af37]/25">
                  {status?.user ? <Smartphone size={18} strokeWidth={2} /> : <ShieldCheck size={18} strokeWidth={2} />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f4d67b]">
                    Liberação automática
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/74">
                    {statusMessage}
                  </p>
                  {status?.error ? (
                    <p className="mt-3 text-xs font-semibold text-rose-200">
                      {status.error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative bg-[linear-gradient(180deg,#fdfdfd_0%,#f6f8fb_100%)] px-6 py-7 sm:px-8 lg:px-9">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
                  Conexão
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-[#0c1826]">
                  Status do WhatsApp
                </h3>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone[connectionState]}`}
              >
                {connectionState === "connected" ? <Wifi size={14} strokeWidth={1.9} /> : <WifiOff size={14} strokeWidth={1.9} />}
                {statusLabel[connectionState]}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
                {showQr ? (
                  <div className="rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
                    <img
                      src={status?.qrSvg || undefined}
                      alt="QR code do WhatsApp"
                      className="mx-auto h-full w-full max-w-[280px] rounded-[18px]"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[306px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[radial-gradient(circle_at_top,#f8fafc,white)] px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0c1826] text-white shadow-lg shadow-[#0c1826]/15">
                      {isLoading || connectionState === "connecting" || connectionState === "logging_in" ? (
                        <Loader2 size={28} className="animate-spin" />
                      ) : (
                        <QrCode size={28} strokeWidth={1.9} />
                      )}
                    </div>
                    <p className="text-sm font-black text-[#0c1826]">
                      {connectionState === "logging_in" ? "Validando autenticacao..." : "Aguardando QR code"}
                    </p>
                    <p className="mt-2 max-w-[22rem] text-xs font-semibold leading-6 text-slate-500">
                      {connectionState === "disconnected"
                        ? "Atualize o status se o QR ainda nao apareceu."
                        : "Assim que o codigo estiver pronto ele sera exibido aqui."}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
                    Sessão
                  </p>
                  <p className="mt-2 text-sm font-black text-[#0c1826]">
                    {status?.user?.pushname || "Aguardando validação"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {status?.user?.phone || "Ainda sem aparelho conectado"}
                  </p>
                </div>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
                    Liberação
                  </p>
                  <p className="mt-2 text-sm font-black text-[#0c1826]">
                    {connectionState === "qr" ? "Leitura pendente" : connectionState === "logging_in" ? "Finalizando" : "Em preparo"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    O módulo abre sozinho quando o conector ficar online.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} strokeWidth={1.9} />}
                Atualizar
              </button>

              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut || !status?.configured}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} strokeWidth={1.9} />}
                Reiniciar sessão
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
