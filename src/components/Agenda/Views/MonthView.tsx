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

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Week Day Headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div key={day} className="py-2 text-center text-sm font-bold text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day, i) => {
          const dayHolidays = holidays.filter(h => h.date === format(day, "yyyy-MM-dd"));
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={i} 
              className={`min-h-[100px] border-b border-r p-2 flex flex-col gap-1 ${
                !isCurrentMonth ? "bg-gray-50 text-gray-300" : "text-gray-700"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-xs font-medium ${isToday ? "bg-[#00B5AD] text-white w-6 h-6 flex items-center justify-center rounded-full" : ""}`}>
                  {format(day, "d")}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 overflow-y-auto">
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
