import React, { useRef, useState, useEffect } from "react";
import { AlertTriangle, Calendar, Plus, Search, Trash2, User, X } from "lucide-react";
import { CalendarView } from "./agenda";

import type { Agendamento } from "./agenda";

interface AgendaSidebarProps {
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
  onAgendamentosChanged?: () => void;
  selectedAgendamento?: Agendamento | null;
  setSelectedAgendamento?: (agendamento: Agendamento | null) => void;
}

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const AgendaSidebar: React.FC<AgendaSidebarProps> = React.memo(({
  setCurrentDate,
  setActiveView,
  onAgendamentosChanged,
  selectedAgendamento,
  setSelectedAgendamento,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const preserveClientSearchOnSelectionResetRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const [statusNegociacao, setStatusNegociacao] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const todayStr = getTodayStr();
  const [agendaDate, setAgendaDate] = useState(() => getTodayStr());
  const [agendaTime, setAgendaTime] = useState("");
  const [agendaDuration, setAgendaDuration] = useState("");
  const [observacao, setObservacao] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingSelected, setIsEditingSelected] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    if (!showDeleteConfirm) return;

    const timeoutId = window.setTimeout(() => {
      setShowDeleteConfirm(false);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!saveNotice) return;

    const timeoutId = window.setTimeout(() => {
      setSaveNotice("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [saveNotice]);

  useEffect(() => {
    setShowDeleteConfirm(false);
    setIsEditingSelected(false);

    if (selectedAgendamento) {
      setJustSelected(true);
      setShowSuggestions(false);
      setSuggestions([]);
      setSearchTerm(selectedAgendamento.cliente_nome || "");
      setSelectedClientId(selectedAgendamento.id_cliente);
      setPhone(selectedAgendamento.telefone_celular || selectedAgendamento.telefone_residencial || "");
      setBirthDate(""); // Can't easily get it here unless passed or fetched, leaving blank for edit is ok
      setStatusNegociacao(""); // Same
      setAgendaDate(selectedAgendamento.data_agendamento ? String(selectedAgendamento.data_agendamento).split('T')[0] : getTodayStr());
      setAgendaTime(selectedAgendamento.hora_inicio);
      
      if (selectedAgendamento.duracao_minutos && selectedAgendamento.hora_inicio) {
        // We'd map duracao_minutos back to agendaDuration, but for simplicity we can just set it empty or try to calculate it
        setAgendaDuration(selectedAgendamento.hora_fim || "");
      }
      
      setObservacao(selectedAgendamento.observacao || "");
    } else {
      // Clear form
      if (preserveClientSearchOnSelectionResetRef.current) {
        preserveClientSearchOnSelectionResetRef.current = false;
      } else {
        setSearchTerm("");
      }
      setSelectedClientId(null);
      setPhone("");
      setBirthDate("");
      setStatusNegociacao("");
      setAgendaDate(getTodayStr());
      setAgendaTime("");
      setAgendaDuration("");
      setObservacao("");
    }
  }, [selectedAgendamento]);

  const applySelectedAgendamentoToForm = () => {
    if (!selectedAgendamento) return;

    setSearchTerm(selectedAgendamento.cliente_nome || "");
    setSelectedClientId(selectedAgendamento.id_cliente);
    setPhone(selectedAgendamento.telefone_celular || selectedAgendamento.telefone_residencial || "");
    setBirthDate("");
    setStatusNegociacao("");
    setAgendaDate(selectedAgendamento.data_agendamento ? String(selectedAgendamento.data_agendamento).split('T')[0] : getTodayStr());
    setAgendaTime(selectedAgendamento.hora_inicio);
    setAgendaDuration(selectedAgendamento.hora_fim || "");
    setObservacao(selectedAgendamento.observacao || "");
  };

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
      const today = new Date();
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

  const availableTimeOptions = React.useMemo(() => getFilteredTimeOptions(), [agendaDate, todayStr]);
  const isFormLockedForEdit = Boolean(selectedAgendamento && !isEditingSelected);
  const isFormDisabled = !selectedClientId || isFormLockedForEdit;

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

  const availableDurationOptions = React.useMemo(() => getFilteredDurationOptions(), [agendaTime]);

  const resetSelectionForClientSearch = () => {
    if (selectedAgendamento && !isEditingSelected) {
      preserveClientSearchOnSelectionResetRef.current = true;
      setSelectedAgendamento?.(null);
    }
  };

  const handleClientSearchChange = (value: string) => {
    resetSelectionForClientSearch();
    setSearchTerm(value);
    if (selectedClientId) setSelectedClientId(null);
  };

  const clearFormForNextAppointment = () => {
    setSearchTerm("");
    setSuggestions([]);
    setShowSuggestions(false);
    setPhone("");
    setBirthDate("");
    setStatusNegociacao("");
    setSelectedClientId(null);
    setAgendaDate(todayStr);
    setAgendaTime("");
    setAgendaDuration("");
    setObservacao("");
    setIsEditingSelected(false);

    window.setTimeout(() => {
      clientInputRef.current?.focus();
    }, 0);
  };

  // If the current selected time is no longer available, we should clear it or select the first available
  useEffect(() => {
    if (!selectedAgendamento && agendaTime && !availableTimeOptions.includes(agendaTime)) {
      setAgendaTime("");
    }
  }, [agendaDate, agendaTime, availableTimeOptions, selectedAgendamento]);

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

    if (!observacao || !observacao.trim()) {
      setSaveNotice("Por favor, preencha o campo de observação.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id_cliente: selectedClientId,
        data_agendamento: agendaDate,
        hora_inicio: agendaTime,
        hora_fim: agendaDuration || null,
        duracao_minutos: agendaDuration ? 30 : null, // Assuming 30 if duration selected, simplistic for now
        observacao,
        repetir: "",
        enviar_sms: false,
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
        clearFormForNextAppointment();
      } else {
        const err = await res.json();
        console.error("Failed to save agendamento:", err);
        setSaveNotice(err.error || "Nao foi possivel salvar este compromisso.");
      }
    } catch (e) {
      console.error(e);
      setSaveNotice("Nao foi possivel salvar este compromisso.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgendamento) return;

    setIsSaving(true);
    setShowDeleteConfirm(false);
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
    <>
    {showDeleteConfirm && selectedAgendamento ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-agendamento-title"
          className="w-full max-w-md overflow-hidden rounded-lg border border-white/70 bg-white shadow-2xl"
        >
          <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="delete-agendamento-title" className="text-base font-black text-slate-950">
                Excluir agendamento?
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Esta acao remove o compromisso da agenda. A janela fecha automaticamente em 5 segundos.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4">
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <p className="truncate text-sm font-bold text-slate-900">
                {selectedAgendamento.cliente_nome || "Cliente"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {agendaDate.split("-").reverse().join("/")} as {agendaTime || selectedAgendamento.hora_inicio}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 bg-slate-50 px-5 py-4">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} />
              {isSaving ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {saveNotice ? (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="save-notice-title"
          className="w-full max-w-sm overflow-hidden rounded-lg border border-white/70 bg-white shadow-2xl"
        >
          <div className="flex items-start gap-4 border-b border-slate-100 bg-amber-50 px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="save-notice-title" className="text-base font-black text-slate-950">
                Atenção
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                {saveNotice}
              </p>
            </div>
          </div>

          <div className="flex justify-end bg-white px-5 py-4">
            <button
              type="button"
              onClick={() => setSaveNotice("")}
              className="rounded-md bg-[#00B5AD] px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#009d96]"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    ) : null}

    <aside className="w-[300px] flex-shrink-0 bg-white border-r border-black overflow-y-auto p-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-black uppercase">
          {selectedAgendamento ? 'Editar Agendamento' : 'Agendar'}
        </h2>
        {selectedAgendamento && (
          <button 
            onClick={() => setSelectedAgendamento?.(null)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-200"
          >
            <X size={10} />
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
              ref={clientInputRef}
              placeholder="Cliente..." 
              value={searchTerm}
              onChange={(e) => handleClientSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                resetSelectionForClientSearch();
                if (searchTerm.length >= 2) setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              disabled={isSaving}
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
          <button disabled={isFormDisabled} className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00B5AD]">
            <Plus size={16} />
          </button>
          <button disabled={isFormDisabled} className="p-2 bg-[#00B5AD] text-white rounded shadow-sm hover:bg-[#009d96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00B5AD]">
            <Search size={16} />
          </button>
        </div>

        <div className="flex gap-1">
          <input 
            type="date" 
            min={todayStr}
            value={agendaDate}
            onChange={(e) => setAgendaDate(e.target.value)}
            disabled={isFormDisabled}
            className="flex-1 px-3 py-2 border border-black rounded text-sm outline-none focus:border-black bg-white uppercase text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <select 
            value={agendaTime}
            onChange={(e) => setAgendaTime(e.target.value)}
            disabled={isFormDisabled}
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
            disabled={isFormDisabled || !agendaTime} 
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
            placeholder="Observação * (Obrigatório)..." 
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={isFormDisabled}
            className="w-full px-3 py-2 border border-black rounded text-sm outline-none h-20 resize-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
        </div>

        {selectedAgendamento ? (
          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => {
                if (isEditingSelected) {
                  applySelectedAgendamentoToForm();
                  setIsEditingSelected(false);
                  return;
                }
                setIsEditingSelected(true);
              }}
              disabled={!selectedClientId || isSaving} 
              className={`flex-1 py-3 text-white font-bold rounded shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isEditingSelected ? "bg-slate-600 hover:bg-slate-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <Plus size={18} />
              {isEditingSelected ? "CANCELAR" : "ALTERAR"}
            </button>
            <button 
              onClick={isEditingSelected ? handleSave : () => setShowDeleteConfirm(true)}
              disabled={isSaving} 
              className={`flex-1 py-3 text-white font-bold rounded shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isEditingSelected ? "bg-[#00B5AD] hover:bg-[#009d96]" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isEditingSelected ? "SALVAR" : "EXCLUIR"}
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
    </>
  );
});
