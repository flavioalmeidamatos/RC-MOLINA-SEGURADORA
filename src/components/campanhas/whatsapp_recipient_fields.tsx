interface WhatsAppRecipientFieldsProps {
  recipients: string[];
  onRecipientChange: (index: number, value: string) => void;
  onAddRecipient: () => void;
  onRemoveRecipient: (index: number) => void;
  validRecipients: number;
  invalidRecipients: number;
}

export function WhatsAppRecipientFields({
  recipients,
  onRecipientChange,
  onAddRecipient,
  onRemoveRecipient,
  validRecipients,
  invalidRecipients,
}: WhatsAppRecipientFieldsProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Destinatarios
            </p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
              Contatos da campanha
            </h3>
          </div>

          <button
            type="button"
            onClick={onAddRecipient}
            disabled={recipients.length >= 10}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          {recipients.map((recipient, index) => {
            const digits = recipient.replace(/\D/g, "");
            const hasValue = digits.length > 0;
            const isValid = digits.length === 11;

            return (
              <div
                key={`recipient-${index}`}
                className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Contato {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemoveRecipient(index)}
                    disabled={recipients.length === 1}
                    className="rounded-full border border-transparent px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition hover:border-slate-200 hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remover
                  </button>
                </div>

                <input
                  type="text"
                  value={recipient}
                  onChange={(event) => onRecipientChange(index, event.target.value)}
                  placeholder="11999999999"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition ${
                    !hasValue
                      ? "border-slate-200 bg-white text-slate-700 focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10"
                      : isValid
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        : "border-amber-200 bg-amber-50/70 text-amber-800 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  }`}
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {hasValue
                    ? isValid
                      ? "Numero valido para a proxima fase de disparo."
                      : "Use 11 digitos com DDD."
                    : "Digite o numero para validar a estrutura local."}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">Total</p>
            <p className="text-sm font-black text-[#0c1826]">{recipients.length}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Validos</p>
            <p className="text-sm font-black text-emerald-800">{validRecipients}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Ajustar</p>
            <p className="text-sm font-black text-amber-800">{invalidRecipients}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
