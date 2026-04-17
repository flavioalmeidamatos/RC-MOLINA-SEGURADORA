import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface DayViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const DayView: React.FC<DayViewProps> = ({ currentDate, holidays }) => {
  const timeSlots = Array.from({ length: 16 }, (_, i) => 6 + i);
  const holiday = holidays.find(h => h.date === format(currentDate, "yyyy-MM-dd"));
  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className={`border-b border-black py-4 text-center flex flex-col items-center gap-1 ${isWeekend ? "bg-red-50/20" : "bg-gray-50/30"}`}>
        <div className={`text-sm font-bold uppercase tracking-widest ${isWeekend ? "text-red-600" : "text-black"}`}>
          {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </div>
        {holiday && (
          <div className="text-[10px] bg-black text-white px-2 py-1 rounded font-bold uppercase mt-1">
            FERIADO: {holiday.name}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative flex min-h-full">
          {/* Time column */}
          <div className="w-[80px] flex flex-col bg-gray-50 border-r border-black">
            {timeSlots.map((hour) => (
              <div 
                key={hour} 
                className="h-[80px] border-b border-black last:border-b-0 p-2 text-right"
              >
                <span className="text-xs font-bold text-black">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col">
            {timeSlots.map((hour) => (
              <div 
                key={hour}
                className={`h-[80px] border-b border-black last:border-b-0 transition-colors hover:bg-gray-50/50 cursor-pointer ${
                  isWeekend ? "bg-red-50/10" : ""
                }`}
              >
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
