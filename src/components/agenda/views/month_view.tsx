import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PartyPopper, Clock } from "lucide-react";
import { Holiday } from "../../../lib/holidays";

import { CalendarView } from "../agenda";
import type { AniversarianteMes } from "../../dashboard/rc_menu_principal";
import type { Agendamento } from "../agenda";

interface MonthViewProps {
  currentDate: Date;
  holidays: Holiday[];
  aniversariantesMes?: AniversarianteMes[];
  agendamentos?: Agendamento[];
  onSelectAgendamento?: (agendamento: Agendamento) => void;
  onMoveAgendamento?: (id: string, newDate: string) => Promise<void>;
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
}

const birthMonthDay = (value: string) => String(value || "").slice(5, 10);

const isAtrasado = (dataAgendamento: string, horaInicio: string) => {
  try {
    const dateStr = String(dataAgendamento).substring(0, 10);
    const timeStr = String(horaInicio).substring(0, 5);
    const appointmentDateTime = new Date(`${dateStr}T${timeStr}:00`);
    return appointmentDateTime < new Date();
  } catch (e) {
    return false;
  }
};

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  holidays,
  aniversariantesMes = [],
  agendamentos = [],
  onSelectAgendamento,
  onMoveAgendamento,
  setCurrentDate,
  setActiveView,
}) => {
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = [
    { name: "Dom", isWeekend: true },
    { name: "Seg", isWeekend: false },
    { name: "Ter", isWeekend: false },
    { name: "Qua", isWeekend: false },
    { name: "Qui", isWeekend: false },
    { name: "Sex", isWeekend: false },
    { name: "Sáb", isWeekend: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="grid shrink-0 grid-cols-7 border-b border-black">
        {weekDays.map((day) => (
          <div 
            key={day.name} 
            className={`py-1 text-center text-sm font-bold border-r border-black ${
              day.isWeekend ? "text-red-600" : "text-black"
            }`}
          >
            {day.name}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayHolidays = holidays.filter(h => h.date === dayStr);
          const dayAgendamentos = agendamentos.filter(a => String(a.data_agendamento).substring(0, 10) === dayStr);
          const dayBirthdays = aniversariantesMes.filter(
            (cliente) => birthMonthDay(cliente.data_nascimento) === format(day, "MM-dd")
          );
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isSelected = isSameDay(day, currentDate);
          const isDraggedOver = draggedOverDate === dayStr;

          return (
            <div 
              key={i} 
              onClick={() => setCurrentDate(day)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDraggedOverDate(dayStr);
              }}
              onDragLeave={() => {
                if (draggedOverDate === dayStr) {
                  setDraggedOverDate(null);
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggedOverDate(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id && onMoveAgendamento) {
                  await onMoveAgendamento(id, dayStr);
                }
              }}
              className={`min-h-0 overflow-hidden border-b border-r border-black p-1 flex flex-col gap-0.5 transition-all duration-200 cursor-pointer ${
                !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : isWeekend ? "text-red-600" : "text-black"
              } ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""} ${
                isDraggedOver ? "ring-2 ring-inset ring-[#00B5AD] bg-[#00B5AD]/5 border-[#00B5AD]/50 scale-[0.98]" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-center shrink-0">
                <span className={`text-xs font-bold leading-none ${
                  isToday 
                    ? "bg-[#00B5AD] text-white w-6 h-6 flex items-center justify-center rounded-full" 
                    : isWeekend && isCurrentMonth ? "text-red-600 p-1" : "p-1"
                }`}>
                  {format(day, "d")}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 min-h-0">
                {dayHolidays.map((holiday, idx) => (
                  <div 
                    key={idx} 
                    className="bg-black text-white p-1 rounded text-[10px] font-bold leading-tight uppercase animate-fade-in"
                  >
                    FERIADO: {holiday.name}
                  </div>
                ))}

                {dayBirthdays.map((cliente) => (
                  <div
                    key={cliente.codigo}
                    className="rounded border border-[#d4af37]/50 bg-[#fff7df] px-1.5 py-1 text-[10px] font-black leading-tight text-[#7a5a12] shadow-sm animate-fade-in"
                    title={`Aniversariante: ${cliente.nome_completo}`}
                  >
                    <div className="flex items-center gap-1">
                      <PartyPopper size={11} className="shrink-0 text-[#c79622]" />
                      <span className="truncate">{cliente.nome_completo}</span>
                    </div>
                  </div>
                ))}
                
                {dayAgendamentos.map((agendamento) => {
                  const atrasado = isAtrasado(agendamento.data_agendamento, agendamento.hora_inicio);
                  return (
                    <div
                      key={agendamento.id_agendamento}
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData("text/plain", agendamento.id_agendamento);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={`rounded border px-1.5 py-1 text-[10px] font-black leading-tight shadow-sm cursor-grab active:cursor-grabbing transition-colors duration-150 ${
                        atrasado
                          ? "border-red-400/50 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-blue-400/50 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                      title={`Observação: ${agendamento.observacao || ''}`}
                      onClick={(e) => {
                        e.stopPropagation(); // prevent setting current date when clicking the badge
                        onSelectAgendamento?.(agendamento);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Clock size={11} className={atrasado ? "shrink-0 text-red-600" : "shrink-0 text-blue-600"} />
                        <span className="truncate">{agendamento.hora_inicio} - {agendamento.cliente_nome || 'Cliente'}</span>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
