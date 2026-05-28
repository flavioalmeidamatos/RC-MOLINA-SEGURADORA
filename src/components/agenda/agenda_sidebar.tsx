import React, { useRef, useState, useEffect } from "react";
import { Plus, Search, Calendar, User } from "lucide-react";
import { CalendarView } from "./agenda";

import type { Agendamento } from "./agenda";

interface AgendaSidebarProps {
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
  onAgendamentosChanged?: () => void;
  selectedAgendamento?: Agendamento | null;
  setSelectedAgendamento?: (agendamento: Agendamento | null) => void;
}

export const AgendaSidebar: React.FC<AgendaSidebarProps> = ({
  setCurrentDate,
  setActiveView,
  onAgendamentosChanged,
  selectedAgendamento,
  setSelectedAgendamento,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const [statusNegociacao, setStatusNegociacao] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const today = new Date();
  const todayStr = today.toLocaleDateString('en-CA'); // "YYYY-MM-DD" local time
  const [agendaDate, setAgendaDate] = useState(todayStr);
  const [agendaTime, setAgendaTime] = useState("");
  const [agendaDuration, setAgendaDuration] = useState("");
  const [observacao, setObservacao] = useState("");
  const [repetir, setRepetir] = useState("");
  const [enviarSms, setEnviarSms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedAgendamento) {
      setSearchTerm(selectedAgendamento.cliente_nome || "");
      setSelectedClientId(selectedAgendamento.id_cliente);
      setPhone(selectedAgendamento.telefone_celular || selectedAgendamento.telefone_residencial || "");
      setBirthDate(""); // Can't easily get it here unless passed or fetched, leaving blank for edit is ok
      setStatusNegociacao(""); // Same
      setAgendaDate(selectedAgendamento.data_agendamento.split('T')[0]);
      setAgendaTime(selectedAgendamento.hora_inicio);
      
      if (selectedAgendamento.duracao_minutos && selectedAgendamento.hora_inicio) {
        // We'd map duracao_minutos back to agendaDuration, but for simplicity we can just set it empty or try to calculate it
        setAgendaDuration(selectedAgendamento.hora_fim || "");
      }
      
      setObservacao(selectedAgendamento.observacao || "");
      setRepetir(selectedAgendamento.repetir || "");
      setEnviarSms(selectedAgendamento.enviar_sms || false);
    } else {
      // Clear form
      setSearchTerm("");
      setSelectedClientId(null);
      setPhone("");
      setBirthDate("");
      setStatusNegociacao("");
      setAgendaDate(todayStr);
      setAgendaTime("");
      setAgendaDuration("");
      setObservacao("");
      setRepetir("");
      setEnviarSms(false);
    }
  }, [selectedAgendamento, todayStr]);

  const generateTimeOptions = () => {
    const options = [];
    for (let h = 8; h <= 20; h++) {
      const hourStr = h.toString().padStart(2, "0");
      options.push(`${hourStr}:00`);
      if (h !== 20) {
        options.push(`${hourStr}:30`);
      }
    }
    return options;
  };

  const getFilteredTimeOptions = () => {
    const options = generateTimeOptions();
    if (agendaDate === todayStr) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      return options.filter((time) => {
        const [h, m] = time.split(":").map(Number);
        if (h > currentHour) return true;
        if (h === currentHour && m > currentMinute) return true;
        return false;
      });
    }
    return options;
  };

  const availableTimeOptions = getFilteredTimeOptions();

  const getFilteredDurationOptions = () => {
    if (!agendaTime) return [];
    const options = generateTimeOptions();
    const [startH, startM] = agendaTime.split(":").map(Number);
    
    return options.filter((time) => {
      const [h, m] = time.split(":").map(Number);
      if (h > startH) return true;
      if (h === startH && m > startM) return true;
      return false;
    });
  };

  const availableDurationOptions = getFilteredDurationOptions();

  // If the current selected time is no longer available, we should clear it or select the first available
  useEffect(() => {
    if (agendaTime && !availableTimeOptions.includes(agendaTime)) {
      setAgendaTime("");
    }
  }, [agendaDate, agendaTime, availableTimeOptions]);

  // If the current duration is no longer available, clear it
  useEffect(() => {
    if (agendaDuration && !availableDurationOptions.includes(agendaDuration)) {
      setAgendaDuration("");
    }
  }, [agendaTime, agendaDuration, availableDurationOptions]);

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
    setSelectedClientId(client.id_cliente);
    setSearchTerm(client.nome_completo);
    
    // Find preferred phone or the first one
    const preferredContact = client.contatos?.find((c: any) => c.preferencial) || client.contatos?.[0];
    setPhone(preferredContact?.valor || "");
    
    setBirthDate(formatBirthDate(client.data_nascimento));
    setStatusNegociacao(client.status_negociacao || "");
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

  const handleSave = async () => {
    if (!selectedClientId || !agendaDate || !agendaTime) return;

    setIsSaving(true);
    try {
      const payload = {
        id_cliente: selectedClientId,
        data_agendamento: agendaDate,
        hora_inicio: agendaTime,
        hora_fim: agendaDuration || null,
        duracao_minutos: agendaDuration ? 30 : null, // Assuming 30 if duration selected, simplistic for now
        observacao,
        repetir,
        enviar_sms: enviarSms,
      };

      const url = selectedAgendamento 
        ? `/api/agendamentos/${selectedAgendamento.id_agendamento}`
        : "/api/agendamentos";
      const method = selectedAgendamento ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onAgendamentosChanged?.();
        setSelectedAgendamento?.(null);
      } else {
        const err = await res.json();
        console.error("Failed to save agendamento:", err);
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgendamento) return;
    if (!window.confirm("Deseja realmente excluir este agendamento?")) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/agendamentos/${selectedAgendamento.id_agendamento}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onAgendamentosChanged?.();
        setSelectedAgendamento?.(null);
      } else {
        const err = await res.json();
        alert(`Erro ao excluir: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="w-[300px] flex-shrink-0 bg-white border-r border-black overflow-y-auto p-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-black uppercase">
          {selectedAgendamento ? 'Editar Agendamento' : 'Agendar'}
        </h2>
        {selectedAgendamento && (
          <button 
            onClick={() => setSelectedAgendamento?.(null)}
            className="text-xs text-blue-600 underline hover:text-blue-800"
          >
            Novo
          </button>
        )}
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedClientId) setSelectedClientId(null);
              }}
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
            readOnly={true}
            disabled={true}
            className="flex-1 min-w-0 px-3 py-2 border border-black rounded text-sm italic outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <input 
            type="text" 
            placeholder="Nascimento" 
            value={birthDate}
            readOnly={true}
            disabled={true}
            className="w-[120px] min-w-0 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </div>

        <div className="flex gap-1">
          <input 
            type="text" 
            placeholder="Status de Negociação..." 
            value={statusNegociacao}
            readOnly={true}
            disabled={true}
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <button disabled={!selectedClientId} className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00B5AD]">
            <Plus size={16} />
          </button>
          <button disabled={!selectedClientId} className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00B5AD]">
            <Search size={16} />
          </button>
        </div>

        <div className="flex gap-1">
          <input 
            type="date" 
            min={todayStr}
            value={agendaDate}
            onChange={(e) => setAgendaDate(e.target.value)}
            disabled={!selectedClientId}
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black bg-white uppercase text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <select 
            value={agendaTime}
            onChange={(e) => setAgendaTime(e.target.value)}
            disabled={!selectedClientId}
            className="w-[85px] px-2 py-2 border border-black rounded text-sm text-center outline-none focus:border-black appearance-none bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="" disabled>Hora</option>
            {availableTimeOptions.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>

        <div>
          <select 
            value={agendaDuration}
            onChange={(e) => setAgendaDuration(e.target.value)}
            disabled={!selectedClientId || !agendaTime} 
            className="w-full px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="" disabled>Duração...</option>
            {availableDurationOptions.map((time) => (
              <option key={time} value={time}>Até {time}</option>
            ))}
          </select>
        </div>



        <div>
          <textarea 
            placeholder="Observação..." 
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={!selectedClientId}
            className="w-full px-3 py-2 border border-black rounded text-sm outline-none h-20 resize-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            disabled={!selectedClientId} 
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">Repetir?</option>
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
          <select disabled={!selectedClientId} className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none appearance-none bg-white focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100">
            <option>Nunca</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className={`text-xs font-bold uppercase ${!selectedClientId ? 'text-gray-300' : 'text-gray-500'}`}>Enviar SMS</span>
          <div className="flex bg-gray-200 rounded p-1">
            <button 
              onClick={() => setEnviarSms(true)}
              disabled={!selectedClientId} 
              className={`px-3 py-1 text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm ${enviarSms ? 'bg-[#00B5AD] text-white' : 'text-gray-500 hover:bg-gray-300'}`}
            >Sim</button>
            <button 
              onClick={() => setEnviarSms(false)}
              disabled={!selectedClientId} 
              className={`px-3 py-1 text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm ${!enviarSms ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-300'}`}
            >Não</button>
          </div>
        </div>

        {selectedAgendamento ? (
          <div className="flex gap-2 mt-4">
            <button 
              onClick={handleSave}
              disabled={!selectedClientId || isSaving} 
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              ALTERAR
            </button>
            <button 
              onClick={handleDelete}
              disabled={isSaving} 
              className="flex-1 py-3 bg-red-600 text-white font-bold rounded shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              EXCLUIR
            </button>
          </div>
        ) : (
          <button 
            onClick={handleSave}
            disabled={!selectedClientId || isSaving} 
            className="w-full py-3 bg-[#00B5AD] text-white font-bold rounded shadow-lg hover:bg-[#009d96] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            SALVAR
          </button>
        )}
      </div>
    </aside>
  );
};
