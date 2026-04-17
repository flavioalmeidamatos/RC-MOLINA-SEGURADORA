import React from "react";
import { format, startOfWeek, addDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Holiday } from "../../../lib/holidays";

interface WeekViewProps {
  currentDate: Date;
  holidays: Holiday[];
}

export const WeekView: React.FC<WeekViewProps> = ({ currentDate, holidays }) => {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = addDays(startDate, 6);
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });

  const timeSlots = Array.from({ length: 31 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      key: `${hour}:${minutes.toString().padStart(2, "0")}`,
      label: minutes === 0 ? `${hour}:00` : `${hour}:${minutes.toString().padStart(2, "0")}`,
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-black bg-white">
        <div className="border-r border-black"></div>
        {weekDays.map((day) => {
          const holiday = holidays.find(h => h.date === format(day, "yyyy-MM-dd"));
          return (
            <div key={day.toString()} className="flex flex-col items-center border-r border-black py-2 text-center last:border-r-0">
              <div className="text-sm font-bold text-black uppercase">
                {format(day, "eee d/M", { locale: ptBR }).replace(".", "")}
              </div>
              {holiday && (
                <div className="text-[9px] bg-black text-white px-1 rounded font-bold uppercase mt-1 max-w-[90%] truncate">
                  {holiday.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div
        className="grid flex-1 min-h-0 grid-cols-[72px_repeat(7,minmax(0,1fr))]"
        style={{ gridTemplateRows: `repeat(${timeSlots.length}, minmax(0, 1fr))` }}
      >
        {timeSlots.map((slot) => (
          <div key={slot.key} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-black">
            <div className="flex items-start justify-center border-r border-black bg-white py-1 text-[10px] font-bold text-black">
              {slot.label}
            </div>
            {weekDays.map((day) => (
              <div
                key={`${slot.key}-${day.toString()}`}
                className="cursor-pointer border-r border-black transition-colors hover:bg-gray-50 last:border-r-0"
              >
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
