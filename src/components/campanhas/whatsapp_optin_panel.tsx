interface WhatsAppOptInPanelProps {
  optInChecked: boolean;
  templateChecked: boolean;
  onOptInChange: (checked: boolean) => void;
  onTemplateChange: (checked: boolean) => void;
}

export function WhatsAppOptInPanel({
  optInChecked,
  templateChecked,
  onOptInChange,
  onTemplateChange,
}: WhatsAppOptInPanelProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Conformidade
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
          Confirmacoes obrigatorias
        </h3>
      </div>

      <div className="space-y-4 p-5">
        <label className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <input
            type="checkbox"
            checked={optInChecked}
            onChange={(event) => onOptInChange(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
          />
          <span>
            <span className="block text-sm font-black text-[#0c1826]">
              Opt-in confirmado
            </span>
            <span className="mt-1.5 block text-sm leading-6 text-slate-600">
              Confirmo que a base usada nesta campanha possui autorizacao para contato.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <input
            type="checkbox"
            checked={templateChecked}
            onChange={(event) => onTemplateChange(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
          />
          <span>
            <span className="block text-sm font-black text-[#0c1826]">
              Texto revisado para disparo
            </span>
            <span className="mt-1.5 block text-sm leading-6 text-slate-600">
              Confirmo que o conteudo sera revisado antes do envio automatizado.
            </span>
          </span>
        </label>

        <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
            Estado atual
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
            {optInChecked && templateChecked
              ? "Modulo pronto para seguir com backend, auditoria e disparo."
              : "Ainda faltam confirmacoes para liberar o disparo."}
          </p>
        </div>
      </div>
    </section>
  );
}
