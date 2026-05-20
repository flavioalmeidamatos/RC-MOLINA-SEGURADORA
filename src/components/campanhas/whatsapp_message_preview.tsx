import type { ReactNode } from "react";

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
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px]"
        >
          {token.value}
        </code>
      );
    }

    return token.value;
  });
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
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Preview
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
          Simulação de mensagem
        </h3>
      </div>

      <div className="space-y-4 p-5">
        <div className="mx-auto w-full max-w-[320px] rounded-[32px] bg-[#111b21] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="overflow-hidden rounded-[28px] bg-[#efeae2]">
            <div className="flex items-center justify-between bg-[#202c33] px-4 py-3 text-white">
              <div>
                <p className="text-sm font-black">Campanhas RC</p>
                <p className="text-[11px] font-semibold text-white/60">Preview local</p>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#86efac]">
                teste
              </div>
            </div>

            <div className="min-h-[360px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_48%),linear-gradient(180deg,#f4efe6_0%,#e8dfd1_100%)] px-4 py-5">
              <div className="ml-auto max-w-[88%] rounded-[22px] rounded-tr-md bg-[#dcf8c6] px-4 py-3 text-[13px] leading-6 text-[#0f172a] shadow-sm">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5b7c49]">
                  {campaignName.trim() || "Campanha sem nome"}
                </p>

                {message.trim() ? (
                  <div className="space-y-1 break-words">
                    {lines.map((lineTokens, index) => (
                      <p key={`line-${index}`}>
                        {lineTokens.length > 0 ? renderInlineTokens(lineTokens) : <span>&nbsp;</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Escreva a mensagem para ver a simulação neste balão.</p>
                )}

                {attachments.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-[#b6d7a8] bg-white/50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5b7c49]">
                      Anexos preparados
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {attachments.length} arquivo(s) pronto(s) para envio.
                    </p>
                  </div>
                ) : null}

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
              Alcance válido
            </p>
            <p className="mt-1 text-lg font-black text-[#0c1826]">{validRecipients}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Mídia
            </p>
            <p className="mt-1 text-lg font-black text-[#0c1826]">{attachments.length}</p>
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
              className={`mt-1 text-sm font-black ${
                readyForNextPhase ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              {readyForNextPhase ? "Pronto para disparo" : "Módulo em preparo"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
