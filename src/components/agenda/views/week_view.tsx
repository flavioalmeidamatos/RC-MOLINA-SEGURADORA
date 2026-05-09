import React from "react";
import { format, startOfWeek, addDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

import { AniversarianteMes } from "../../dashboard/rc_menu_principal";

interface WeekViewProps {
  currentDate: Date;
  holidays: Holiday[];
  aniversariantesMes?: AniversarianteMes[];
}

const birthMonthDay = (value: string) => String(value || "").slice(5, 10);

export const WeekView: React.FC<WeekViewProps> = ({ currentDate, holidays, aniversariantesMes = [] }) => {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = addDays(startDate, 6);
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });

  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hour}:${minutes}`;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-black">
        <div className="w-[60px] border-r border-black bg-gray-50 uppercase text-[10px] flex items-center justify-center font-bold">Hora</div>
        <div className="flex flex-1 grid grid-cols-7 border-r border-black">
          {weekDays.map((day) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const holiday = holidays.find(h => h.date === format(day, "yyyy-MM-dd"));
            const dayBirthdays = aniversariantesMes.filter(
              (cliente) => birthMonthDay(cliente.data_nascimento) === format(day, "MM-dd")
            );
            
            return (
              <div 
                key={day.toString()} 
                className={`flex flex-col items-center justify-start py-0.5 border-r border-black overflow-y-auto no-scrollbar max-h-24 ${
                  isWeekend ? "bg-red-50/30" : ""
                }`}
              >
                <div className={`text-[10px] font-bold uppercase shrink-0 ${isWeekend ? "text-red-600" : "text-black"}`}>
                  {format(day, "eee", { locale: ptBR })}
                </div>
                <div className={`text-sm font-black leading-none mt-0.5 shrink-0 ${isWeekend ? "text-red-600" : "text-black"}`}>
                  {format(day, "d")}
                </div>
                {holiday && (
                  <div className="mt-1 w-[90%] truncate rounded bg-black px-1.5 py-0.5 text-[7px] font-bold uppercase text-white shrink-0 text-center">
                    {holiday.name}
                  </div>
                )}
                {dayBirthdays.map((cliente) => (
                  <div
                    key={cliente.codigo}
                    className="mt-1 w-[90%] truncate rounded border border-[#d4af37]/50 bg-[#fff7df] px-1 py-0.5 text-[8px] font-black leading-tight text-[#7a5a12] shadow-sm shrink-0"
                    title={`Aniversariante: ${cliente.nome_completo}`}
                  >
                    🎉 {cliente.nome_completo}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full">
          {/* Time column */}
          <div className="w-[60px] flex flex-col bg-gray-50 border-r border-black">
            {timeSlots.map((time) => (
              <div 
                key={time} 
                className="flex-1 border-b border-black last:border-b-0 flex items-center justify-center"
              >
                <span className="text-[10px] font-bold text-black">{time}</span>
              </div>
            ))}
          </div>

          {/* Days columns */}
          <div className="flex-1 grid grid-cols-7 border-r border-black h-full">
            {weekDays.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div 
                  key={day.toString()} 
                  className={`relative flex flex-col border-r border-black ${
                    isWeekend ? "bg-red-50/10" : ""
                  }`}
                >
                  {timeSlots.map((time) => (
                    <div 
                      key={`${day}-${time}`}
                      className="flex-1 border-b border-black last:border-b-0 transition-colors hover:bg-gray-50/50 cursor-pointer"
                    >
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
