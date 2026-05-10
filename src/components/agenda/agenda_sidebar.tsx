import React, { useRef, useState, useEffect } from "react";
import { Plus, Search, Calendar, User } from "lucide-react";
import { CalendarView } from "./agenda";

interface AgendaSidebarProps {
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
}

export const AgendaSidebar: React.FC<AgendaSidebarProps> = ({
  setCurrentDate,
  setActiveView,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [justSelected, setJustSelected] = useState(false);

  useEffect(() => {
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length >= 2) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/clientes/search?q=${encodeURIComponent(searchTerm)}`);
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Erro ao buscar clientes:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const formatBirthDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSelectClient = (client: any) => {
    setJustSelected(true);
    setSearchTerm(client.nome_completo);
    
    // Find preferred phone or the first one
    const preferredContact = client.contatos?.find((c: any) => c.preferencial) || client.contatos?.[0];
    setPhone(preferredContact?.valor || "");
    
    setBirthDate(formatBirthDate(client.data_nascimento));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        handleSelectClient(suggestions[0]);
      }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

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
        <div className="flex gap-1 relative">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
              className="w-full pl-3 pr-10 py-2 border border-black rounded text-sm outline-none focus:border-black"
            />
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
              <User size={14} className="text-black" />
            </div>
            
            {showSuggestions && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-black rounded shadow-xl max-h-60 overflow-y-auto">
                {isLoading ? (
                  <div className="p-2 text-sm text-gray-500 italic">Buscando...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((client) => (
                    <div 
                      key={client.id_cliente}
                      className="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                      onClick={() => handleSelectClient(client)}
                    >
                      <div className="font-bold">{client.nome_completo}</div>
                      <div className="text-xs text-gray-500">{client.cpf || client.cnpj || client.codigo}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-sm text-gray-500">Nenhum cliente encontrado</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="(__) ____-____" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 border border-black rounded text-sm italic outline-none focus:border-black"
          />
          <input 
            type="text" 
            placeholder="Nascimento" 
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
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
            placeholder="Data do agendamento"
            defaultValue="03/04/2026" 
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black"
          />
          <input 
            type="text" 
            placeholder="00:00"
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
            <option>Responsável...</option>
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
            <option>Status...</option>
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
