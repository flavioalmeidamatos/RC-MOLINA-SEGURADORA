import type { ReactNode } from "react";
import { FileImage, FileText, Paperclip, PlayCircle, Video } from "lucide-react";

import { splitWhatsAppMessageLines } from "../../lib/whatsapp_text_formatter";
import type { CampaignAttachment, WhatsAppInlineToken } from "../../types/whatsapp_campaign";

interface WhatsAppMessagePreviewProps {
  campaignName: string;
  message: string;
  validRecipients: number;
  attachments: CampaignAttachment[];
  readyForNextPhase: boolean;
}

function renderInlineTokens(tokens: WhatsAppInlineToken[]): ReactNode[] {
  return tokens.map((token, index) => {
    if (token.kind === "bold") {
      return (
        <strong key={`token-${index}`} className="font-black">
          {token.value}
        </strong>
      );
    }

    if (token.kind === "italic") {
      return (
        <em key={`token-${index}`} className="italic">
          {token.value}
        </em>
      );
    }

    if (token.kind === "strike") {
      return (
        <span key={`token-${index}`} className="line-through">
          {token.value}
        </span>
      );
    }

    if (token.kind === "code") {
      return (
        <code
          key={`token-${index}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]"
        >
          {token.value}
        </code>
      );
    }

    return token.value;
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
      <div className="rounded-[18px] border border-[#b6d7a8] bg-white/80 px-3 py-3">
        <div className="flex items-center gap-3">
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
  campaignName,
  message,
  validRecipients,
  attachments,
  readyForNextPhase,
}: WhatsAppMessagePreviewProps) {
  const lines = splitWhatsAppMessageLines(message);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Preview
        </p>
        <h3 className="mt-1 text-base font-black tracking-tight text-[#0c1826]">
          Simulacao de mensagem
        </h3>
      </div>

      <div className="space-y-4 p-4">
        <div className="mx-auto w-full max-w-[320px] rounded-[32px] bg-[#111b21] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="overflow-hidden rounded-[28px] bg-[#efeae2]">
            <div className="flex items-center justify-between bg-[#202c33] px-4 py-3 text-white">
              <div>
                <p className="text-xs font-black">Campanhas RC</p>
                <p className="text-[10px] font-semibold text-white/60">Preview local</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#86efac]">
                teste
              </div>
            </div>

            <div className="min-h-[280px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_48%),linear-gradient(180deg,#f4efe6_0%,#e8dfd1_100%)] px-4 py-4">
              <div className="ml-auto max-w-[88%] rounded-[22px] rounded-tr-md bg-[#dcf8c6] px-3 py-3 text-[12px] leading-6 text-[#0f172a] shadow-sm">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#5b7c49]">
                  {campaignName.trim() || "Campanha sem nome"}
                </p>

                {attachments.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id}>{renderAttachmentPreview(attachment)}</div>
                    ))}
                  </div>
                ) : null}

                {message.trim() ? (
                  <div className="space-y-1 break-words">
                    {lines.map((lineTokens, index) => (
                      <p key={`line-${index}`}>
                        {lineTokens.length > 0 ? renderInlineTokens(lineTokens) : <span>&nbsp;</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Escreva a mensagem para ver a simulacao neste balao.</p>
                )}

                <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-semibold text-slate-400">
                  <span>14:35</span>
                  <span>OK</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Alcance valido
            </p>
            <p className="mt-1 text-base font-black text-[#0c1826]">{validRecipients}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Midia
            </p>
            <p className="mt-1 text-base font-black text-[#0c1826]">{attachments.length}</p>
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 ${
              readyForNextPhase
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-amber-200 bg-amber-50/80"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                readyForNextPhase ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              Status
            </p>
            <p
              className={`mt-1 text-xs font-black ${
                readyForNextPhase ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              {readyForNextPhase ? "Pronto para disparo" : "Modulo em preparo"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
