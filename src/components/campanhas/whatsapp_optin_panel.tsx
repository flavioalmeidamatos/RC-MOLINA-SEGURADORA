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
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Compliance
        </p>
        <h3 className="mt-1 text-base font-black tracking-tight text-[#0c1826]">
          Confirmações obrigatórias
        </h3>
      </div>

      <div className="space-y-3 p-4">
        <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
          <input
            type="checkbox"
            checked={optInChecked}
            onChange={(event) => onOptInChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
          />
          <span>
            <span className="block text-xs font-black text-[#0c1826]">
              Opt-in confirmado
            </span>
            <span className="mt-1 block text-[11px] font-medium leading-5 text-slate-500">
              Confirmo que a base usada nesta campanha possui autorização para contato.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-3">
          <input
            type="checkbox"
            checked={templateChecked}
            onChange={(event) => onTemplateChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
          />
          <span>
            <span className="block text-xs font-black text-[#0c1826]">
              Texto validado para template
            </span>
            <span className="mt-1 block text-[11px] font-medium leading-5 text-slate-500">
              Confirmo que o conteúdo será revisado antes do disparo automatizado.
            </span>
          </span>
        </label>

        <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
            Estado atual
          </p>
          <p className="mt-2 text-xs font-semibold leading-6 text-amber-900">
            {optInChecked && templateChecked
              ? "Módulo pronto para seguir com backend, auditoria e disparo."
              : "Ainda faltam confirmações para liberar o disparo."}
          </p>
        </div>
      </div>
    </section>
  );
}
