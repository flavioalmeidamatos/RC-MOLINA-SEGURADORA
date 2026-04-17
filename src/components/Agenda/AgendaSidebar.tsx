import React from "react";
import { Plus, Search, HelpCircle, RefreshCcw, Settings, User } from "lucide-react";

export const AgendaSidebar: React.FC = () => {
  return (
    <aside className="w-[300px] flex-shrink-0 bg-white border-r border-black overflow-y-auto p-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-black uppercase">
          <Plus className="text-black" size={20} />
          Agendar
          <HelpCircle size={14} className="text-black" />
        </h2>
        <div className="flex gap-1">
          <button className="p-1.5 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96]">
            <RefreshCcw size={14} />
          </button>
          <button className="p-1.5 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96]">
            <Settings size={14} />
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

        <div className="flex gap-2">
          <input 
            type="text" 
            defaultValue="03/04/2026" 
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
          />
          <input 
            type="text" 
            defaultValue="00:00" 
            className="w-[80px] px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
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
      </div>
    </aside>
  );
};
