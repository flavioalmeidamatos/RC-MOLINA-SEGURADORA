import type { ReactNode } from "react";
import { FileImage, FileText, Paperclip, PlayCircle, Video } from "lucide-react";

import { splitWhatsAppMessageLines } from "../../lib/whatsapp_text_formatter";
import type { CampaignAttachment, WhatsAppInlineToken } from "../../types/whatsapp_campaign";

interface WhatsAppMessagePreviewProps {
  campaignName: string;
  message: string;
  attachments: CampaignAttachment[];
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
  campaignName,
  message,
  attachments,
}: WhatsAppMessagePreviewProps) {
  const lines = splitWhatsAppMessageLines(message);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <h3 className="mt-1 text-base font-black tracking-tight text-[#0c1826]">
          Simulação da mensagem
        </h3>
      </div>

      <div className="p-4">
        <div className="mx-auto w-full max-w-[360px] rounded-[32px] bg-[#111b21] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="overflow-hidden rounded-[28px] bg-[#efeae2]">
            <div className="flex items-center justify-between bg-[#202c33] px-4 py-3 text-white">
              <div>
                <p className="text-xs font-black">Campanhas RC</p>
                <p className="text-[10px] font-semibold text-white/60">Simulação local</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#86efac]">
                teste
              </div>
            </div>

            <div className="h-[480px] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_48%),linear-gradient(180deg,#f4efe6_0%,#e8dfd1_100%)] px-4 py-4">
              <div className="ml-auto max-w-[88%] rounded-[22px] rounded-tr-md bg-[#dcf8c6] px-3 py-3 text-[12px] leading-6 text-[#0f172a] shadow-sm">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5b7c49]">
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
                  <span>14:35</span>
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
