import React from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PartyPopper } from "lucide-react";
import { Holiday } from "../../../lib/holidays";

import { CalendarView } from "../agenda";
import type { AniversarianteMes } from "../../dashboard/rc_menu_principal";
import type { Agendamento } from "../agenda";
import { Clock } from "lucide-react";

interface MonthViewProps {
  currentDate: Date;
  holidays: Holiday[];
  aniversariantesMes?: AniversarianteMes[];
  agendamentos?: Agendamento[];
  onSelectAgendamento?: (agendamento: Agendamento) => void;
  setCurrentDate: (date: Date) => void;
  setActiveView: (view: CalendarView) => void;
}


const birthMonthDay = (value: string) => String(value || "").slice(5, 10);

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  holidays,
  aniversariantesMes = [],
  agendamentos = [],
  onSelectAgendamento,
  setCurrentDate,
  setActiveView,
}) => {
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
      <div className="grid grid-cols-7 border-b border-black">
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
        className="flex-1 grid grid-cols-7 overflow-y-auto custom-scrollbar"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => {
          const dayHolidays = holidays.filter(h => h.date === format(day, "yyyy-MM-dd"));
          const dayAgendamentos = agendamentos.filter(a => String(a.data_agendamento).substring(0, 10) === format(day, "yyyy-MM-dd"));
          const dayBirthdays = aniversariantesMes.filter(
            (cliente) => birthMonthDay(cliente.data_nascimento) === format(day, "MM-dd")
          );
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isSelected = isSameDay(day, currentDate);

          return (
            <div 
              key={i} 
              onClick={() => setCurrentDate(day)}
              className={`min-h-0 border-b border-r border-black p-1 flex flex-col gap-0.5 transition-colors hover:bg-gray-50 cursor-pointer ${
                !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : isWeekend ? "text-red-600" : "text-black"
              } ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""}`}
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
                    className="bg-black text-white p-1 rounded text-[10px] font-bold leading-tight uppercase"
                  >
                    FERIADO: {holiday.name}
                  </div>
                ))}

                {dayBirthdays.map((cliente) => (
                  <div
                    key={cliente.codigo}
                    className="rounded border border-[#d4af37]/50 bg-[#fff7df] px-1.5 py-1 text-[10px] font-black leading-tight text-[#7a5a12] shadow-sm"
                    title={`Aniversariante: ${cliente.nome_completo}`}
                  >
                    <div className="flex items-center gap-1">
                      <PartyPopper size={11} className="shrink-0 text-[#c79622]" />
                      <span className="truncate">{cliente.nome_completo}</span>
                    </div>
                  </div>
                ))}
                {dayAgendamentos.map((agendamento) => (
                  <div
                    key={agendamento.id_agendamento}
                    className="rounded border border-blue-400/50 bg-blue-50 px-1.5 py-1 text-[10px] font-black leading-tight text-blue-700 shadow-sm cursor-pointer hover:bg-blue-100"
                    title={`Agendamento: ${agendamento.cliente_nome || 'Cliente'}`}
                    onClick={(e) => {
                      e.stopPropagation(); // prevent setting current date when clicking the badge
                      onSelectAgendamento?.(agendamento);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="shrink-0 text-blue-600" />
                      <span className="truncate">{agendamento.hora_inicio} - {agendamento.cliente_nome || 'Cliente'}</span>
                    </div>
                  </div>
                ))}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
