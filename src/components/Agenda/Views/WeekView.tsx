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

  const hours = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${hour}:${minutes}`;
  });

  return (
    <div className="h-full flex flex-col bg-white overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-white z-10">
        <div className="border-r"></div>
        {weekDays.map((day) => {
          const holiday = holidays.find(h => h.date === format(day, "yyyy-MM-dd"));
          return (
            <div key={day.toString()} className="py-2 text-center border-r last:border-r-0 flex flex-col items-center">
              <div className="text-sm font-bold text-gray-700">
                {format(day, "eee d/M", { locale: ptBR }).replace(".", "")}
              </div>
              {holiday && (
                <div className="text-[9px] bg-red-500 text-white px-1 rounded font-bold uppercase mt-1 max-w-[90%] truncate">
                  {holiday.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 min-w-[700px]">
        {hours.map((time) => (
          <div key={time} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 h-[40px]">
            <div className="flex items-start justify-center text-[10px] text-gray-400 py-1 bg-gray-50 border-r">
              {time.split(":")[1] === "00" ? time.split(":")[0] : ""}
              {time.split(":")[1] === "30" ? "8:30" : ""} {/* Following the style in image where 8:30 is explicitly shown */}
            </div>
            {weekDays.map((day) => (
              <div key={day.toString()} className="border-r last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
                {/* Space for appointments */}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
