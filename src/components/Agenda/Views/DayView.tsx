import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface DayViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const DayView: React.FC<DayViewProps> = ({ currentDate, holidays }) => {
  const hours = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hour}:${minutes}`;
  });

  const holiday = holidays.find(h => h.date === format(currentDate, "yyyy-MM-dd"));

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50 py-3 text-center flex flex-col items-center gap-1">
        <div className="text-xs font-bold uppercase tracking-widest text-[#0c1826]">
          FLAVIO ALMEIDA MATOS
        </div>
        {holiday && (
          <div className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-bold uppercase">
            FERIADO: {holiday.name}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {hours.map((time) => (
          <div key={time} className="grid grid-cols-[60px_1fr] border-b last:border-b-0 h-[40px]">
            <div className="flex items-start justify-center text-[10px] text-gray-400 py-1 bg-gray-50 border-r">
              {time.split(":")[1] === "00" ? time.split(":")[0] : time}
            </div>
            <div className="hover:bg-gray-50 transition-colors cursor-pointer">
              {/* Space for appointments */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
