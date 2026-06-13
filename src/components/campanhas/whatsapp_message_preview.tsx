import { useEffect, useState, type ReactNode } from "react";
import { FileImage, FileText, Loader2, LogOut, Paperclip, PlayCircle, RefreshCcw, Send, Video } from "lucide-react";

import { splitWhatsAppMessageLines } from "../../lib/whatsapp_text_formatter";
import type { CampaignAttachment, WhatsAppInlineToken } from "../../types/whatsapp_campaign";

interface WhatsAppMessagePreviewProps {
  message: string;
  attachments: CampaignAttachment[];
  onSend?: () => void;
  isSending?: boolean;
  canSend?: boolean;
  onRefresh?: () => void;
  onLogout?: () => void;
  isLoadingRefresh?: boolean;
  isLoggingOut?: boolean;
  isConfigured?: boolean;
}

function renderInlineTokens(tokens: WhatsAppInlineToken[]): ReactNode[] {
  return tokens.map((token, index) => {
    const content = token.children && token.children.length > 0
      ? renderInlineTokens(token.children)
      : token.value;

    if (token.kind === "bold") {
      return (
        <strong key={`token-${index}`} className="font-black">
          {content}
        </strong>
      );
    }

    if (token.kind === "italic") {
      return (
        <em key={`token-${index}`} className="italic">
          {content}
        </em>
      );
    }

    if (token.kind === "strike") {
      return (
        <span key={`token-${index}`} className="line-through">
          {content}
        </span>
      );
    }

    if (token.kind === "code") {
      return (
        <code
          key={`token-${index}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]"
        >
          {content}
        </code>
      );
    }

    return content;
  });
}

function renderAttachmentPreview(attachment: CampaignAttachment) {
  if (attachment.kind === "image" && attachment.fileUrl) {
    return (
      <div className="overflow-hidden rounded-[18px] border border-[#b6d7a8] bg-white/80">
        <img
          src={attachment.fileUrl}
          alt={attachment.name}
          className="h-40 w-full object-cover"
        />
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-slate-600">
          <FileImage size={14} className="text-[#5b7c49]" />
          <span className="truncate">{attachment.name}</span>
        </div>
      </div>
    );
  }

  if (attachment.kind === "video" && attachment.fileUrl) {
    return (
      <div className="overflow-hidden rounded-[18px] border border-[#b6d7a8] bg-white/80">
        <div className="relative">
          <video
            src={attachment.fileUrl}
            controls
            preload="metadata"
            className="h-40 w-full bg-slate-900 object-cover"
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm">
            <PlayCircle size={16} />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-slate-600">
          <Video size={14} className="text-[#5b7c49]" />
          <span className="truncate">{attachment.name}</span>
        </div>
      </div>
    );
  }

  if (attachment.kind === "pdf") {
    return (
      <div className="overflow-hidden rounded-[18px] border border-[#b6d7a8] bg-white/80">
        {attachment.fileUrl ? (
          <iframe
            src={`${attachment.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            title={attachment.name}
            className="h-44 w-full bg-white"
          />
        ) : (
          <div className="flex h-44 items-center justify-center bg-white">
            <FileText size={28} className="text-[#9a7418]" />
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff3cf] text-[#9a7418]">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-[#0f172a]">{attachment.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">PDF pronto para envio</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-[#b6d7a8] bg-white/80 px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ecf2f8] text-slate-600">
          <Paperclip size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black text-[#0f172a]">{attachment.name}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Arquivo pronto para envio</p>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppMessagePreview({
  message,
  attachments,
  onSend,
  isSending = false,
  canSend = false,
  onRefresh,
  onLogout,
  isLoadingRefresh = false,
  isLoggingOut = false,
  isConfigured = false,
}: WhatsAppMessagePreviewProps) {
  const lines = splitWhatsAppMessageLines(message);
  const [currentTime, setCurrentTime] = useState(() => {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="h-full flex flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 shrink-0">
        <h3 className="mt-1 text-base font-black tracking-tight text-[#0c1826]">
          Simulação da mensagem
        </h3>
      </div>

      <div className="p-4 flex-1 flex flex-col min-h-0 bg-slate-50/30 justify-center">
        {/* Smartphone Frame */}
        <div className="relative mx-auto w-full max-w-[340px] flex-1 flex flex-col min-h-0 rounded-[50px] bg-[#1e293b] p-[12px] shadow-[0_24px_60px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/50">
          
          {/* Side Buttons */}
          <div className="absolute -left-[2px] top-[100px] h-[26px] w-[2px] rounded-l-md bg-slate-600" />
          <div className="absolute -left-[2px] top-[140px] h-[50px] w-[2px] rounded-l-md bg-slate-600" />
          <div className="absolute -left-[2px] top-[200px] h-[50px] w-[2px] rounded-l-md bg-slate-600" />
          <div className="absolute -right-[2px] top-[160px] h-[70px] w-[2px] rounded-r-md bg-slate-600" />

          {/* Screen */}
          <div className="relative overflow-hidden flex-1 flex flex-col min-h-0 rounded-[38px] bg-[#efeae2] border-[4px] border-black">
            
            {/* iPhone Status Bar (Time/Date) */}
            <div className="absolute top-0 left-0 right-0 h-[28px] z-20 flex flex-nowrap gap-1.5 px-2 pointer-events-none">
              {/* Left Side: Time (aligns with Enviar) */}
              <div className="flex-1 flex items-center justify-center pt-1.5">
                <span className="text-[10px] font-bold text-white tracking-wide">{currentTime}</span>
              </div>

              {/* Center Space (aligns with Atualizar, hidden under notch) */}
              <div className="flex-1" />

              {/* Right Side: Date (aligns with Desconectar) */}
              <div className="flex-1 flex items-center justify-center pt-1.5">
                <span className="text-[9.5px] font-bold text-white tracking-wide">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Center Notch */}
            <div className="absolute left-1/2 top-0 z-20 h-[28px] w-[140px] -translate-x-1/2 rounded-b-[20px] bg-black pointer-events-auto">
              <div className="absolute left-1/2 top-1/2 h-[4px] w-[40px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1e293b]/50" />
              <div className="absolute right-6 top-1/2 flex h-[12px] w-[12px] -translate-y-1/2 items-center justify-center rounded-full bg-white">
                <div className="h-[6px] w-[6px] rounded-full bg-black" />
              </div>
            </div>

            {/* Header Actions (with top padding for the notch) */}
            <div className="flex flex-nowrap items-center justify-center gap-1.5 bg-[#202c33] px-2 pb-2.5 pt-9 text-white shrink-0 shadow-sm relative z-10">
              <button
                type="button"
                onClick={onSend}
                disabled={isSending || !canSend}
                className="inline-flex items-center justify-center gap-1 flex-1 rounded-full bg-[#25d366] hover:bg-[#20ba5a] active:scale-95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:scale-100 disabled:shadow-none focus:outline-none"
              >
                <span className={`inline-flex items-center gap-1 ${canSend && !isSending ? "animate-pulse" : ""}`}>
                  {isSending ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Send size={10} strokeWidth={2.5} />
                  )}
                  <span>Enviar</span>
                </span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoadingRefresh}
                className="inline-flex items-center justify-center gap-1 flex-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/25 active:scale-95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none"
              >
                {isLoadingRefresh ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <RefreshCcw size={10} strokeWidth={2.5} />
                )}
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut || !isConfigured}
                className="inline-flex items-center justify-center gap-1 flex-1 rounded-full border border-rose-500/35 bg-rose-500/20 hover:bg-rose-500/35 active:scale-95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wider text-rose-200 shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none"
              >
                {isLoggingOut ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <LogOut size={10} strokeWidth={2.5} />
                )}
                <span>Desconectar</span>
              </button>
            </div>

            <div className="h-[480px] xl:h-auto xl:flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_48%),linear-gradient(180deg,#f4efe6_0%,#e8dfd1_100%)] px-4 py-4">
              <div className="ml-auto max-w-[88%] rounded-[22px] rounded-tr-md bg-[#dcf8c6] px-3 py-3 text-[12px] leading-6 text-[#0f172a] shadow-sm">
                {attachments.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id}>{renderAttachmentPreview(attachment)}</div>
                    ))}
                  </div>
                ) : null}

                {message.trim() ? (
                  <div className="space-y-1.5 break-words text-[13px]">
                    {lines.map((lineTokens, index) => (
                      <p key={`line-${index}`}>
                        {lineTokens.length > 0 ? renderInlineTokens(lineTokens) : <span>&nbsp;</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Escreva a mensagem para ver a simulação neste balão.</p>
                )}

                <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-semibold text-slate-400">
                  <span>{currentTime}</span>
                  <span>OK</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
