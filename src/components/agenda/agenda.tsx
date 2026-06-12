import React, { useState, useEffect, useCallback } from "react";
import { startOfDay } from "date-fns";
import { fetchHolidays, Holiday } from "../../lib/holidays";
import { AgendaSidebar } from "./agenda_sidebar";
import { AgendaHeader } from "./agenda_header";
import { MonthView } from "./views/month_view";
import { WeekView } from "./views/week_view";
import { DayView } from "./views/day_view";
import type { AniversarianteMes } from "../dashboard/rc_menu_principal";

export type CalendarView = "month" | "week" | "day";

export interface Agendamento {
  id_agendamento: string;
  id_cliente: string;
  cliente_nome?: string;
  telefone_celular?: string;
  telefone_residencial?: string;
  data_agendamento: string;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  observacao: string;
  repetir: string;
  enviar_sms: boolean;
}

interface AgendaProps {
  aniversariantesMes?: AniversarianteMes[];
  onAgendamentosChanged?: () => void;
  initialDate?: Date;
}

export const Agenda: React.FC<AgendaProps> = ({ aniversariantesMes = [], onAgendamentosChanged, initialDate }) => {
  const [activeView, setActiveView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDateRaw] = useState(() => startOfDay(initialDate || new Date()));

  const setCurrentDate = useCallback((date: Date) => {
    setCurrentDateRaw(startOfDay(date));
  }, []);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);

  const fetchAgendamentos = useCallback(async () => {
    try {
      const res = await fetch("/api/agendamentos");
      if (res.ok) {
        const json = await res.json();
        setAgendamentos(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar agendamentos", e);
    }
  }, []);

  const handleAgendamentosChanged = useCallback(() => {
    void fetchAgendamentos();
    onAgendamentosChanged?.();
  }, [fetchAgendamentos, onAgendamentosChanged]);

  const handleSelectAgendamento = useCallback(async (agendamento: Agendamento | null) => {
    setSelectedAgendamento(agendamento);
    if (!agendamento) return;

    try {
      const res = await fetch(`/api/agendamentos/${agendamento.id_agendamento}`);
      if (!res.ok) return;

      const json = await res.json();
      if (json.data) {
        setSelectedAgendamento(json.data);
      }
    } catch (error) {
      console.error("Erro ao recarregar agendamento selecionado", error);
    }
  }, []);

  const handleMoveAgendamento = useCallback(async (id: string, newDate: string) => {
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data_agendamento: newDate }),
      });

      if (res.status === 409) {
        const json = await res.json();
        alert(json.error || "Já existe um compromisso agendado para este horário de início.");
        return;
      }

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Erro ao atualizar a data do compromisso.");
        return;
      }

      handleAgendamentosChanged();
    } catch (error) {
      console.error("Erro ao mover o compromisso", error);
      alert("Erro de conexão ao mover o compromisso.");
    }
  }, [handleAgendamentosChanged]);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    fetchHolidays(year).then(setHolidays);
  }, [currentDate]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AgendaSidebar 
          setCurrentDate={setCurrentDate} 
          setActiveView={setActiveView} 
          onAgendamentosChanged={handleAgendamentosChanged}
          selectedAgendamento={selectedAgendamento}
          setSelectedAgendamento={setSelectedAgendamento}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-black bg-white">
          <AgendaHeader 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            activeView={activeView} 
            setActiveView={setActiveView}
          />
          
          <div className="min-h-0 flex-1 overflow-hidden border-t border-black">
            {activeView === "month" && (
              <MonthView 
                currentDate={currentDate} 
                holidays={holidays} 
                aniversariantesMes={aniversariantesMes}
                agendamentos={agendamentos}
                onSelectAgendamento={(agendamento) => void handleSelectAgendamento(agendamento)}
                onMoveAgendamento={handleMoveAgendamento}
                setCurrentDate={setCurrentDate} 
                setActiveView={setActiveView} 
              />
            )}
            {activeView === "week" && (
              <WeekView 
                currentDate={currentDate} 
                holidays={holidays} 
                aniversariantesMes={aniversariantesMes}
                agendamentos={agendamentos}
                onSelectAgendamento={(agendamento) => void handleSelectAgendamento(agendamento)}
              />
            )}
            {activeView === "day" && (
              <DayView 
                currentDate={currentDate} 
                holidays={holidays} 
                aniversariantesMes={aniversariantesMes}
                agendamentos={agendamentos}
                onSelectAgendamento={(agendamento) => void handleSelectAgendamento(agendamento)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
