import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";
import { AniversarianteMes } from "../../dashboard/rc_menu_principal";
import type { Agendamento } from "../agenda";

interface DayViewProps {
  currentDate: Date;
  holidays: Holiday[];
  aniversariantesMes?: AniversarianteMes[];
  agendamentos?: Agendamento[];
  onSelectAgendamento?: (agendamento: Agendamento | null) => void;
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

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  holidays,
  aniversariantesMes = [],
  agendamentos = [],
  onSelectAgendamento,
}) => {
  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minutes}`;
  });
  const holiday = holidays.find(h => h.date === format(currentDate, "yyyy-MM-dd"));
  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
  const dayBirthdays = aniversariantesMes.filter(
    (cliente) => birthMonthDay(cliente.data_nascimento) === format(currentDate, "MM-dd")
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className={`border-b border-black py-1 text-center flex flex-col items-center gap-1 overflow-y-auto max-h-24 no-scrollbar shrink-0 ${isWeekend ? "bg-red-50/20" : "bg-gray-50/30"}`}>
        <div className={`text-sm font-bold uppercase tracking-widest shrink-0 ${isWeekend ? "text-red-600" : "text-black"}`}>
          {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </div>
        {holiday && (
          <div className="text-[10px] bg-black text-white px-2 py-1 rounded font-bold uppercase shrink-0 mt-1">
            FERIADO: {holiday.name}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1 px-2 pb-1 shrink-0">
          {dayBirthdays.map((cliente) => (
            <div
              key={cliente.codigo}
              className="rounded border border-[#d4af37]/50 bg-[#fff7df] px-2 py-1 text-[10px] font-black leading-tight text-[#7a5a12] shadow-sm shrink-0"
              title={`Aniversariante: ${cliente.nome_completo}`}
            >
              🎉 {cliente.nome_completo}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full border-r border-black">
          {/* Time column */}
          <div className="w-[60px] flex flex-col bg-gray-50 border-r border-black">
            {timeSlots.map((time, index) => (
              <div 
                key={time} 
                className={`flex-1 border-black flex items-center justify-center p-0.5 ${
                  index !== timeSlots.length - 1 ? 'border-b' : ''
                }`}
              >
                <span className="text-[10px] font-bold text-black">{time}</span>
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col">
            {(() => {
              const dateStr = format(currentDate, "yyyy-MM-dd");
              const dayAgendamentos = agendamentos.filter(
                (a) => String(a.data_agendamento).substring(0, 10) === dateStr
              );

              return timeSlots.map((time, index) => {
                const agendamento = dayAgendamentos.find(
                  (a) => a.hora_inicio?.slice(0, 5) === time
                );
                const atrasado = agendamento ? isAtrasado(agendamento.data_agendamento, agendamento.hora_inicio) : false;

                return (
                  <div 
                    key={time}
                    onClick={() => onSelectAgendamento?.(agendamento || null)}
                    className={`flex-1 border-black transition-colors p-0.5 min-h-0 flex items-stretch ${
                      index !== timeSlots.length - 1 ? 'border-b' : ''
                    } ${
                      agendamento 
                        ? (atrasado ? "bg-red-50/50 hover:bg-red-100/50 cursor-pointer" : "bg-blue-50/50 hover:bg-blue-100/50 cursor-pointer")
                        : "hover:bg-gray-50/50 cursor-pointer"
                    } ${isWeekend ? "bg-red-50/10" : ""}`}
                  >
                    {agendamento && (
                      <div 
                        title={`Observação: ${agendamento.observacao || ''}`}
                        className={`flex-1 rounded border px-1.5 py-0.5 text-[9px] font-black shadow-sm flex items-center justify-between gap-1 overflow-hidden ${
                          atrasado 
                            ? "border-red-400/50 bg-red-50/90 text-red-700" 
                            : "border-blue-400/50 bg-blue-50/90 text-blue-700"
                        }`}
                      >
                        <span className="truncate leading-none">{agendamento.cliente_nome}</span>
                        {agendamento.hora_fim && (
                          <span className={`text-[7px] font-semibold shrink-0 leading-none ${atrasado ? "text-red-500" : "text-blue-500"}`}>
                            Até {agendamento.hora_fim.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
