import React from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface MonthViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const MonthView: React.FC<MonthViewProps> = ({ currentDate, holidays }) => {
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
            className={`py-2 text-center text-sm font-bold border-r border-black last:border-r-0 ${
              day.isWeekend ? "text-red-600" : "text-black"
            }`}
          >
            {day.name}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar">
        {days.map((day, i) => {
          const dayHolidays = holidays.filter(h => h.date === format(day, "yyyy-MM-dd"));
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <div 
              key={i} 
              className={`min-h-[75px] border-b border-r border-black p-1.5 flex flex-col gap-1 transition-colors hover:bg-gray-50 ${
                !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : isWeekend ? "text-red-600" : "text-black"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold ${
                  isToday 
                    ? "bg-[#00B5AD] text-white w-6 h-6 flex items-center justify-center rounded-full" 
                    : isWeekend && isCurrentMonth ? "text-red-600" : ""
                }`}>
                  {format(day, "d")}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
                {dayHolidays.map((holiday, idx) => (
                  <div 
                    key={idx} 
                    className="bg-black text-white p-1 rounded text-[10px] font-bold leading-tight uppercase"
                  >
                    FERIADO: {holiday.name}
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
