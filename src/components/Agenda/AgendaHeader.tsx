import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
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

  const getTitle = () => {
    if (activeView === "month") {
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    } else if (activeView === "week") {
      const start = format(currentDate, "d", { locale: ptBR });
      const end = format(addDays(currentDate, 6), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      return `${start} - ${end}`;
    } else {
      return format(currentDate, "EEEE, d 'abril de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex border rounded overflow-hidden">
          <button 
            onClick={handlePrevious}
            className="p-1.5 hover:bg-gray-50 border-r text-gray-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext}
            className="p-1.5 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <button 
          onClick={handleToday}
          className="px-4 py-1.5 text-sm font-medium border rounded hover:bg-gray-50 text-gray-700 transition-colors"
        >
          Hoje
        </button>
        
        <button className="px-4 py-1.5 text-sm font-medium border rounded hover:bg-gray-50 text-gray-700 transition-colors">
          Ausência
        </button>
      </div>

      <div className="text-lg font-medium text-gray-600">
        {getTitle()}
      </div>

      <div className="flex border rounded overflow-hidden">
        <button
          onClick={() => setActiveView("month")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "month" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-gray-600 border-r"
          }`}
        >
          Mês
        </button>
        <button
          onClick={() => setActiveView("week")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "week" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-gray-600 border-r text-gray-600"
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setActiveView("day")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            activeView === "day" ? "bg-[#00B5AD] text-white" : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          Dia
        </button>
      </div>
    </div>
  );
};
