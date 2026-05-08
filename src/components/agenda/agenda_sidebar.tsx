import React, { useRef } from "react";
import { Plus, Search, Calendar, User, PartyPopper } from "lucide-react";
import { CalendarView } from "./agenda";
import type { AniversarianteMes } from "../dashboard/rc_menu_principal";

interface AgendaSidebarProps {
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
  aniversariantesMes?: AniversarianteMes[];
}

const formatBirthDate = (value: string) => {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}` : "";
};

export const AgendaSidebar: React.FC<AgendaSidebarProps> = ({
  setCurrentDate,
  setActiveView,
  aniversariantesMes = [],
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="w-[300px] flex-shrink-0 bg-white border-r border-black overflow-y-auto p-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-black uppercase">
          Agendar
        </h2>
        <div className="flex gap-1 relative">
          <input 
            type="date"
            ref={dateInputRef}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split('-');
                setCurrentDate(new Date(Number(y), Number(m) - 1, Number(d)));
                setActiveView("month");
              }
            }}
          />
          <button 
            type="button"
            className="p-1.5 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96] pointer-events-none"
          >
            <Calendar size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Cliente..." 
              className="w-full pl-3 pr-10 py-2 border border-black rounded text-sm outline-none focus:border-black"
            />
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
              <User size={14} className="text-black" />
            </div>
          </div>
          <button className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96]">
            <Search size={16} />
          </button>
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="(__) ____-____" 
            className="flex-1 min-w-0 px-3 py-2 border border-black rounded text-sm italic outline-none focus:border-black"
          />
          <input 
            type="text" 
            placeholder="Nascimento" 
            className="w-[120px] min-w-0 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
          />
        </div>

        <div className="flex gap-1">
          <input 
            type="text" 
            placeholder="Serviço..." 
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
          />
          <button className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96]">
            <Plus size={16} />
          </button>
          <button className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96]">
            <Search size={16} />
          </button>
        </div>

        <div className="flex gap-1">
          <input 
            type="text" 
            defaultValue="03/04/2026" 
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
          />
          <input 
            type="text" 
            defaultValue="00:00" 
            className="w-[68px] px-2 py-2 border border-black rounded text-sm text-center outline-none focus:border-black"
          />
        </div>

        <div>
          <select className="w-full px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black">
            <option>Duração...</option>
          </select>
        </div>

        <div>
          <select className="w-full px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black">
            <option>FLAVIO ALMEIDA MATOS</option>
          </select>
        </div>

        <div>
          <textarea 
            placeholder="Observação..." 
            className="w-full px-3 py-2 border border-black rounded text-sm outline-none h-20 resize-none focus:border-black"
          />
        </div>

        <div className="flex gap-2">
          <select className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black">
            <option>Repetir?</option>
          </select>
          <select className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black">
            <option>Nunca</option>
          </select>
        </div>

        <div>
          <select className="w-full px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black">
            <option>Agendado</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Enviar SMS</span>
          <div className="flex bg-gray-200 rounded p-1">
            <button className="px-3 py-1 text-xs font-bold text-gray-500 uppercase">Sim</button>
            <button className="px-3 py-1 text-xs font-bold bg-red-500 text-white rounded shadow-sm uppercase">Não</button>
          </div>
        </div>

        <button className="w-full py-3 bg-[#00B5AD] text-white font-bold rounded shadow-lg hover:bg-[#009d96] transition-all flex items-center justify-center gap-2 mt-4">
          <Plus size={18} />
          SALVAR
        </button>

        <div className="rounded-2xl border border-[#d4af37]/50 bg-[#fff9e8] p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[#8a681d]">
            <PartyPopper size={18} />
            <span className="text-xs font-black uppercase tracking-[0.14em]">Aniversariantes do mês</span>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {aniversariantesMes.length > 0 ? (
              aniversariantesMes.map((cliente) => (
                <div
                  key={cliente.codigo}
                  className="rounded-xl border border-[#d4af37]/30 bg-white px-3 py-2 text-[#6f5318]"
                >
                  <div className="flex items-start gap-2">
                    <PartyPopper size={15} className="mt-0.5 shrink-0 text-[#c79622]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{cliente.nome_completo}</p>
                      <p className="text-xs font-semibold text-[#9b7a2f]">
                        {formatBirthDate(cliente.data_nascimento)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-[#d4af37]/40 bg-white/70 px-3 py-3 text-center text-xs font-bold text-[#9b7a2f]">
                Nenhum aniversariante neste mês.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
