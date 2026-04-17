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

  const timeSlots = Array.from({ length: 16 }, (_, i) => 6 + i); // 06:00 to 21:00

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="flex border-b border-black">
        <div className="w-[80px] border-r border-black bg-gray-50"></div>
        <div className="flex flex-1 grid grid-cols-7">
          {weekDays.map((day) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const holiday = holidays.find(h => h.date === format(day, "yyyy-MM-dd"));
            
            return (
              <div 
                key={day.toString()} 
                className={`flex flex-col items-center justify-center py-2 border-r border-black last:border-r-0 ${
                  isWeekend ? "bg-red-50/30" : ""
                }`}
              >
                <div className={`text-xs font-bold uppercase ${isWeekend ? "text-red-600" : "text-black"}`}>
                  {format(day, "eee", { locale: ptBR })}
                </div>
                <div className={`text-lg font-black leading-none mt-0.5 ${isWeekend ? "text-red-600" : "text-black"}`}>
                  {format(day, "d")}
                </div>
                {holiday && (
                  <div className="mt-1 max-w-[90%] truncate rounded bg-black px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                    {holiday.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

          {/* Days columns */}
          <div className="flex-1 grid grid-cols-7 relative">
            {weekDays.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div 
                  key={day.toString()} 
                  className={`relative flex flex-col border-r border-black last:border-r-0 ${
                    isWeekend ? "bg-red-50/10" : ""
                  }`}
                >
                  {timeSlots.map((hour) => (
                    <div 
                      key={`${day}-${hour}`}
                      className="h-[80px] border-b border-black last:border-b-0 transition-colors hover:bg-gray-50/50 cursor-pointer"
                    >
                      {/* Interaction areas or events would go here */}
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
