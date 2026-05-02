import React, { useState, useEffect, useCallback } from "react";
import { startOfDay } from "date-fns";
import { fetchHolidays, Holiday } from "../../lib/holidays";
import { AgendaSidebar } from "./agenda_sidebar";
import { AgendaHeader } from "./agenda_header";
import { MonthView } from "./views/month_view";
import { WeekView } from "./views/week_view";
import { DayView } from "./views/day_view";

export type CalendarView = "month" | "week" | "day";

export const Agenda: React.FC = () => {
  const [activeView, setActiveView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDateRaw] = useState(() => startOfDay(new Date()));

  const setCurrentDate = useCallback((date: Date) => {
    setCurrentDateRaw(startOfDay(date));
  }, []);
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
              <MonthView 
                currentDate={currentDate} 
                holidays={holidays} 
                setCurrentDate={setCurrentDate} 
                setActiveView={setActiveView} 
              />
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
