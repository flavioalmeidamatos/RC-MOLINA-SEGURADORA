import { Clock3, Loader2 } from "lucide-react";

import type { CampaignHistoryEntry } from "../../types/whatsapp_campaign";

interface CampaignHistoryProps {
  items: CampaignHistoryEntry[];
  isLoading: boolean;
  activeCampaignName: string;
}

const eventLabels: Record<CampaignHistoryEntry["eventType"], string> = {
  created: "Criação",
  updated: "Atualização",
  deleted: "Remoção",
  dispatched: "Disparo",
};

export function CampaignHistory({ items, isLoading, activeCampaignName }: CampaignHistoryProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Auditoria
            </p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
              Histórico da campanha
            </h3>
          </div>

          {isLoading ? <Loader2 size={16} className="animate-spin text-[#b58c2a]" /> : null}
        </div>
      </div>

      <div className="space-y-3 p-5">
        {!activeCampaignName ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
            Selecione ou salve uma campanha para consultar a trilha de auditoria.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
            Nenhum evento registrado ainda para {activeCampaignName}.
          </div>
        ) : (
          items.map((item) => {
            const isError = item.status === "error";

            return (
              <article
                key={item.id}
                className={`rounded-[24px] border px-4 py-4 ${
                  isError ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-slate-50/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#0c1826]">
                      {eventLabels[item.eventType]}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                      {item.summary}
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                      isError ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {item.status === "error" ? "Falha" : "OK"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} strokeWidth={1.9} />
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </span>
                  <span>{item.actorUserEmail}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
