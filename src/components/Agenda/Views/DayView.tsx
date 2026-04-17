import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface DayViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const DayView: React.FC<DayViewProps> = ({ currentDate, holidays }) => {
  const timeSlots = Array.from({ length: 31 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      key: `${hour}:${minutes.toString().padStart(2, "0")}`,
      label: minutes === 0 ? `${hour}:00` : `${hour}:${minutes.toString().padStart(2, "0")}`,
    };
  });

  const holiday = holidays.find(h => h.date === format(currentDate, "yyyy-MM-dd"));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="border-b border-black bg-white py-3 text-center flex flex-col items-center gap-1">
        <div className="text-xs font-bold uppercase tracking-widest text-black">
          FLAVIO ALMEIDA MATOS
        </div>
        {holiday && (
          <div className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-bold uppercase">
            FERIADO: {holiday.name}
          </div>
        )}
      </div>

      <div
        className="grid flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}
      >
        {timeSlots.map((slot) => (
          <div key={slot.key} className="grid grid-cols-[72px_1fr] border-b border-black">
            <div className="flex items-start justify-center border-r border-black bg-white py-1 text-[10px] font-bold text-black">
              {slot.label}
            </div>
            <div className="cursor-pointer transition-colors hover:bg-gray-50">
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
