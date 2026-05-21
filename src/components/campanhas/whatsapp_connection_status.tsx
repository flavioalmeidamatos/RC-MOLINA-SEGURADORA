import { Loader2, LogOut, QrCode, RefreshCcw, Smartphone, Wifi, WifiOff } from "lucide-react";

import type { WhatsAppBridgeStatus } from "../../types/whatsapp_campaign";

interface WhatsAppConnectionStatusProps {
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
  logging_in: "Entrando",
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

export function WhatsAppConnectionStatus({
  status,
  isLoading,
  isLoggingOut,
  onRefresh,
  onLogout,
}: WhatsAppConnectionStatusProps) {
  const connectionState = status?.status || "disabled";
  const connected = connectionState === "connected";

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Conexao
            </p>
            <h3 className="mt-1 text-base font-black tracking-tight text-[#0c1826]">
              Status do WhatsApp
            </h3>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone[connectionState]}`}
          >
            {connected ? <Wifi size={14} strokeWidth={1.9} /> : <WifiOff size={14} strokeWidth={1.9} />}
            {statusLabel[connectionState]}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">
            {status?.configured
              ? status.available
                ? "A RC Molina esta conectada ao conector local do WhatsApp."
                : "O conector do WhatsApp foi configurado, mas ainda nao respondeu."
              : "O conector do WhatsApp ainda nao foi configurado neste ambiente."}
          </p>
          {status?.error ? (
            <p className="mt-2 text-[11px] font-semibold leading-5 text-rose-600">
              {status.error}
            </p>
          ) : null}
        </div>

        {status?.user ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Smartphone size={16} strokeWidth={1.9} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">Sessao ativa</span>
            </div>
            <p className="mt-2 text-xs font-black text-emerald-900">{status.user.pushname}</p>
            <p className="mt-1 text-[11px] font-semibold text-emerald-700">{status.user.phone}</p>
          </div>
        ) : null}

        {status?.qrAvailable ? (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700">
              <QrCode size={16} strokeWidth={1.9} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">QR disponivel</span>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-900">
              Existe um QR pendente. Leia o codigo com o WhatsApp no celular para liberar o disparo.
            </p>
            {status.qrSvg ? (
              <div className="mt-3 flex justify-center rounded-[18px] border border-amber-200/80 bg-white p-3 shadow-sm">
                <img
                  src={status.qrSvg}
                  alt="QR code do WhatsApp"
                  className="h-48 w-48 rounded-2xl"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} strokeWidth={1.9} />}
            Atualizar
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut || !status?.configured}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} strokeWidth={1.9} />}
            Desconectar
          </button>
        </div>
      </div>
    </section>
  );
}
