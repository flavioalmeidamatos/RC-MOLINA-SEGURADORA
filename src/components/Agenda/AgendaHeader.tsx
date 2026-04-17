import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarView } from "./Agenda";

interface AgendaHeaderProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  activeView: CalendarView;
  setActiveView: (view: CalendarView) => void;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  currentDate,
  setCurrentDate,
  activeView,
  setActiveView,
}) => {
  const handlePrevious = () => {
    if (activeView === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (activeView === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (activeView === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (activeView === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const switchView = (view: CalendarView) => {
    setActiveView(view);
    if (view === "week" || view === "day") {
      setCurrentDate(new Date());
    }
  };

  const getTitle = () => {
    if (activeView === "month") {
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    } else if (activeView === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM yyyy", {
        locale: ptBR,
      })}`;
    } else {
      return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-black bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex border border-black rounded overflow-hidden">
          <button 
            onClick={handlePrevious}
            className="p-1.5 hover:bg-gray-100 border-r border-black text-black transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext}
            className="p-1.5 hover:bg-gray-100 text-black transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <button 
          onClick={handleToday}
          className="px-4 py-1.5 text-sm font-bold border border-black rounded hover:bg-gray-100 text-black transition-colors"
        >
          Hoje
        </button>
        
        <button className="px-4 py-1.5 text-sm font-bold border border-black rounded hover:bg-gray-100 text-black transition-colors">
          Ausência
        </button>
      </div>

      <div className="text-lg font-bold text-black uppercase tracking-tight">
        {getTitle()}
      </div>

      <div className="flex border border-black rounded overflow-hidden">
        <button
          onClick={() => switchView("month")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "month" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-black border-r border-black"
          }`}
        >
          Mês
        </button>
        <button
          onClick={() => switchView("week")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "week" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-black border-r border-black"
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => switchView("day")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "day" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-black"
          }`}
        >
          Dia
        </button>
      </div>
    </div>
  );
};
