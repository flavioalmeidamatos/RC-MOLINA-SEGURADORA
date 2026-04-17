import React, { useState, useEffect } from "react";
import { fetchHolidays, Holiday } from "../../lib/holidays";
import { AgendaSidebar } from "./AgendaSidebar";
import { AgendaHeader } from "./AgendaHeader";
import { MonthView } from "./Views/MonthView";
import { WeekView } from "./Views/WeekView";
import { DayView } from "./Views/DayView";

export type CalendarView = "month" | "week" | "day";

export const Agenda: React.FC = () => {
  const [activeView, setActiveView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    fetchHolidays(year).then(setHolidays);
  }, [currentDate]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
      <div className="flex flex-1 overflow-hidden">
        <AgendaSidebar 
          setCurrentDate={setCurrentDate} 
          setActiveView={setActiveView} 
        />

        <div className="flex min-w-0 flex-1 flex-col border-l border-black bg-white">
          <AgendaHeader 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            activeView={activeView} 
            setActiveView={setActiveView}
          />
          
          <div className="flex-1 overflow-hidden min-h-0 border-t border-black">
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
