import React, { useState, useEffect } from "react";
import { fetchHolidays, Holiday } from "../../lib/holidays";
import { AgendaSidebar } from "./AgendaSidebar";
import { AgendaHeader } from "./AgendaHeader";
import { MonthView } from "./Views/MonthView";
import { WeekView } from "./Views/WeekView";
import { DayView } from "./Views/DayView";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export type CalendarView = "month" | "week" | "day";

export const Agenda: React.FC = () => {
  const [activeView, setActiveView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 6)); // Default to April 6, 2026 as per images
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    fetchHolidays(year).then(setHolidays);
  }, [currentDate]);

  return (
    <div className="flex flex-1 flex-col h-full bg-[#F0F4F8] overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar fixed at the left */}
        <AgendaSidebar />
        
        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0 bg-white shadow-sm border-l border-gray-200">
          <AgendaHeader 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            activeView={activeView} 
            setActiveView={setActiveView}
          />
          
          <div className="flex-1 overflow-y-auto">
            {activeView === "month" && (
              <MonthView currentDate={currentDate} holidays={holidays} />
            )}
            {activeView === "week" && (
              <WeekView currentDate={currentDate} holidays={holidays} />
            )}
            {activeView === "day" && (
              <DayView currentDate={currentDate} holidays={holidays} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
