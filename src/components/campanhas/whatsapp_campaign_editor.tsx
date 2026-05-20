interface WhatsAppCampaignEditorProps {
  campaignName: string;
  message: string;
  onCampaignNameChange: (value: string) => void;
  onMessageChange: (value: string) => void;
}

export function WhatsAppCampaignEditor({
  campaignName,
  message,
  onCampaignNameChange,
  onMessageChange,
}: WhatsAppCampaignEditorProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Conteúdo
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
          Editor da campanha
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Estruture o texto principal e deixe a base pronta para a integração do disparo.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <label
            htmlFor="campaign-name"
            className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Nome interno
          </label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(event) => onCampaignNameChange(event.target.value)}
            placeholder="Ex.: Renovação plano familiar"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="campaign-message"
            className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Mensagem principal
          </label>
          <textarea
            id="campaign-message"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={
              "Use este espaço para montar sua mensagem.\n\nDica: *negrito*, _itálico_, ~riscado~ e `monospace` já aparecem no preview."
            }
            className="min-h-[260px] w-full resize-y rounded-[24px] border border-slate-200 bg-[#fcfcfd] px-4 py-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10"
          />
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
            <span>Preview local apenas. Nenhum disparo será feito nesta etapa.</span>
            <span>{message.length} caracteres</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Texto
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Base pronta para WhatsApp e futuras automações.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Personalização
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Estrutura pronta para evoluir para variáveis por cliente.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">
              Próxima fase
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Integrar backend, histórico e disparo autenticado.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
