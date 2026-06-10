import { X } from "lucide-react";

interface WhatsAppRecipientFieldsProps {
  recipients: string[];
  onRecipientChange: (index: number, value: string) => void;
  onAddRecipient: () => void;
  onRemoveRecipient: (index: number) => void;
  validRecipients: number;
  invalidRecipients: number;
  onComposeEmail?: () => void;
}


export function WhatsAppRecipientFields({
  recipients,
  onRecipientChange,
  onAddRecipient,
  onRemoveRecipient,
  validRecipients,
  invalidRecipients,
  onComposeEmail,
}: WhatsAppRecipientFieldsProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Destinatários
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Contatos da campanha
            </p>
          </div>


        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => {
            const isFilled = index < recipients.length;
            const recipient = isFilled ? recipients[index] : "";
            const digits = recipient.replace(/\D/g, "");
            const hasValue = digits.length > 0;
            const isValid = digits.length === 11;

            if (isFilled) {
              return (
                <div
                  key={`recipient-${index}`}
                  className={`group relative flex flex-col justify-center overflow-hidden rounded-xl border bg-white transition-all ${
                    !hasValue
                      ? "border-slate-200 focus-within:border-[#d4af37] focus-within:ring-2 focus-within:ring-[#d4af37]/20"
                      : isValid
                        ? "border-emerald-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-200"
                        : "border-amber-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/80 px-2.5 py-1.5">
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          !hasValue ? "bg-slate-300" : isValid ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      Nº {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveRecipient(index)}
                      disabled={recipients.length === 1}
                      className="text-slate-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100 disabled:opacity-0"
                      title="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(event) => onRecipientChange(index, event.target.value)}
                    placeholder="11999999999"
                    className={`w-full bg-transparent px-2.5 py-2 text-xs font-semibold outline-none transition-colors placeholder:text-slate-300 ${
                      !hasValue ? "text-slate-700" : isValid ? "text-emerald-700" : "text-amber-700"
                    }`}
                  />
                </div>
              );
            }

            return (
              <div
                key={`empty-slot-${index}`}
                onClick={onAddRecipient}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-4 transition-colors hover:border-[#d4af37] hover:bg-[#d4af37]/5"
                title="Adicionar contato"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:text-[#d4af37]">
                  + Vazio
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b58c2a]">Total</p>
            <p className="text-sm font-black text-[#0c1826]">{validRecipients + invalidRecipients}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Válidos</p>
            <p className="text-sm font-black text-emerald-800">{validRecipients}</p>
          </div>

          <button
            type="button"
            onClick={onComposeEmail}
            className="flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 hover:border-amber-300 active:scale-95 transition-all duration-200 px-3 py-3 w-full cursor-pointer group"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 group-hover:text-amber-800 transition-colors">
              Compor Email
            </p>
          </button>
        </div>
      </div>
    </section>
  );
}
