import { QrCode, Smartphone, Wifi, WifiOff } from "lucide-react";

import type { WhatsAppBridgeStatus } from "../../types/whatsapp_campaign";

interface WhatsAppConnectionStatusProps {
  status: WhatsAppBridgeStatus | null;
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
}: WhatsAppConnectionStatusProps) {
  const connectionState = status?.status || "disabled";
  const connected = connectionState === "connected";

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-black tracking-tight text-[#0c1826] shrink-0 mr-1">
            Status do WhatsApp
          </h3>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {(!status?.configured || !status?.available || status?.error) && (
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-sm font-semibold leading-5 text-slate-700">
              {!status?.configured
                ? "O conector do WhatsApp ainda não foi configurado neste ambiente."
                : !status?.available
                  ? "O conector do WhatsApp foi configurado, mas ainda não respondeu."
                  : null}
            </p>
            {status?.error ? (
              <p className="mt-1 text-xs font-semibold leading-4 text-rose-600">
                {status.error}
              </p>
            ) : null}
          </div>
        )}

        {status?.qrAvailable ? (
          <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-amber-700">
              <QrCode size={14} strokeWidth={1.9} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">QR disponivel</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
              Existe um QR pendente. Leia o codigo com o WhatsApp no celular para liberar o disparo.
            </p>
            {status.qrSvg ? (
              <div className="mt-2 flex justify-center rounded-[14px] border border-amber-200/80 bg-white p-2.5 shadow-sm">
                <img src={status.qrSvg} alt="QR code do WhatsApp" className="h-44 w-44 rounded-xl" />
              </div>
            ) : null}
          </div>
        ) : null}

        {status?.configured && status?.available && !status?.error && !status?.qrAvailable && (
          <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/40 px-3 py-2 flex items-center gap-2 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] font-black tracking-wide text-emerald-800">
              Pronto para envio de mensagens
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
