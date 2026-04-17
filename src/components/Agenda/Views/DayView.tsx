import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface DayViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const DayView: React.FC<DayViewProps> = ({ currentDate, holidays }) => {
  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hour}:${minutes}`;
  });
  const holiday = holidays.find(h => h.date === format(currentDate, "yyyy-MM-dd"));
  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className={`border-b border-black py-1 text-center flex flex-col items-center gap-1 ${isWeekend ? "bg-red-50/20" : "bg-gray-50/30"}`}>
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
            {timeSlots.map((time, index) => (
              <div 
                key={time}
                className={`flex-1 border-black transition-colors hover:bg-gray-50/50 cursor-pointer ${
                  index !== timeSlots.length - 1 ? 'border-b' : ''
                } ${isWeekend ? "bg-red-50/10" : ""}`}
              >
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
