import React, { useState } from "react";
import {
  Home,
  Mail,
  Calendar,
  Info,
  Lightbulb,
  Banknote,
  Briefcase,
  PhoneCall,
  FolderOpen,
  Wrench,
  User,
  LogOut,
  Phone,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  session?: any;
  perfil?: any;
}

export const SCR_MENUPRINCIPAL: React.FC<DashboardProps> = ({
  session,
  perfil,
}) => {
  const navigate = useNavigate();
  const userName =
    perfil?.nome_completo ||
    session?.user?.email?.split("@")[0] ||
    "Nome do Usuário";
  const avatarUrl = perfil?.avatar_url || null;

  const [activeMenu, setActiveMenu] = useState("Home");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const menuItems = [
    { title: "Home", icon: Home, active: true },
    { title: "Indicações", icon: User },
    { title: "Agenda", icon: Calendar },
    { title: "Simulador", icon: FolderOpen },
    { title: "Webmail", icon: Mail },
    { title: "Informações", icon: Info },
    { title: "Sugestões", icon: Lightbulb },
    { title: "Financeiro", icon: Banknote },
    { title: "Configurações", icon: Wrench },
  ];

  const cards = [
    { line1: "Sugestões", line2: "", icon: Lightbulb },
    { line1: "Meus", line2: "clientes", icon: Briefcase },
    { line1: "Todas", line2: "indicações", icon: User },
    { line1: "Ligações", line2: "", icon: PhoneCall },
    { line1: "Agenda", line2: "", icon: Calendar },
    { line1: "Simulador", line2: "", icon: FolderOpen },
    { line1: "Informações", line2: "", icon: Info },
    { line1: "Financeiro", line2: "", icon: Banknote },
    { line1: "Configurar", line2: "", icon: Wrench },
  ];

  const agendaItems = [
    {
      name: "Ana cristina",
      phone: "24998366001",
      time: "14:00",
      status: "ligarei novamente",
      highlight: true,
    },
    {
      name: "Sonia Pompeo",
      phone: "21997847136",
      time: "15:00",
      status: "ligarei novamente",
      highlight: false,
    },
    {
      name: "Fernando Rocha",
      phone: "(21) 99741-4301",
      time: "15:00",
      status: "ligarei novamente",
      highlight: false,
    },
    {
      name: "Regina Célia",
      phone: "21988563903",
      time: "15:00",
      status: "Ligarei novamente",
      highlight: false,
    },
    {
      name: "Ana Cristina",
      phone: "22997200969",
      time: "16:00",
      status: "ligarei novamente",
      highlight: false,
    },
    {
      name: "Marseile Peixoto",
      phone: "21965522650",
      time: "16:00",
      status: "ligarei novamente",
      highlight: false,
    },
    {
      name: "Frederico Alexandre",
      phone: "21974531502",
      time: "16:00",
      status: "ligarei novamente",
      highlight: false,
    },
  ];

  return (
    <div className="flex h-screen w-full bg-[#F0F4F8] font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 flex-shrink-0 bg-[#0c1826] flex flex-col shadow-xl z-20">
        {/* Profile Area */}
        <div className="h-44 bg-gradient-to-b from-[#b58c2a] to-[#806117] flex flex-col items-center justify-center pt-4 pb-2 shadow-inner">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden mb-3 border-2 border-white/50 shadow-md cursor-pointer hover:border-white transition-all">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={32} className="text-gray-400" />
            )}
          </div>
          <span className="text-white font-medium text-sm px-4 text-center">
            {userName}
          </span>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => setActiveMenu(item.title)}
                className={`flex items-center justify-between px-6 py-3 cursor-pointer transition-colors border-l-4 ${activeMenu === item.title
                  ? "bg-[#152a42] border-[#b58c2a] text-white"
                  : "border-transparent text-gray-400 hover:bg-[#112338] hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={
                      activeMenu === item.title
                        ? "text-[#b58c2a]"
                        : "text-gray-500"
                    }
                  />
                  <span className="text-sm">{item.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}
        <div className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white px-2 py-1 flex flex-col items-center">
              <div className="text-[#d4af37] font-serif text-xl tracking-widest font-bold leading-none">
                RC MOLINA
              </div>
              <div className="text-[#0c1826] text-[10px] tracking-[0.3em] text-center font-bold mt-1">
                SEGUROS
              </div>
            </div>
            <span className="text-gray-400 text-sm ml-4 border-l pl-4 border-gray-200">
              Painel Administrativo
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 text-gray-500 hover:text-[#b58c2a] transition-colors">
              <Calendar size={18} />
              <span className="text-sm hidden sm:inline">Agenda</span>
            </button>

            <div className="h-8 w-px bg-gray-200 mx-2"></div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm cursor-pointer">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={16} className="text-gray-400" />
                )}
              </div>
              <span className="text-gray-700 font-medium text-sm hidden md:inline">
                {userName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors ml-2"
            >
              <LogOut size={18} />
              <span className="text-sm hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* DASHBOARD BODY */}
        {activeMenu === "Simulador" ? (
          <div className="flex-1 w-full relative bg-gray-50 flex items-center justify-center overflow-hidden">
            <iframe
              src="https://app.simuladoronline.com/login/"
              title="Simulador Online"
              className="absolute inset-0 w-full h-full border-none z-10 bg-white"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-6">
            {/* GRID DE CARDS */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 content-start">
              {cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (card.line1 === "Simulador") setActiveMenu("Simulador");
                    }}
                    className="bg-white flex h-[100px] shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="w-2/3 p-5 flex flex-col justify-center border-l-4 border-transparent group-hover:border-[#b58c2a] transition-all">
                      <span className="text-[#a48641] text-sm leading-tight transition-colors group-hover:text-[#8e733b]">
                        {card.line1}
                      </span>
                      {card.line2 && (
                        <span className="text-[#8e733b] font-bold text-sm leading-tight">
                          {card.line2}
                        </span>
                      )}
                    </div>
                    <div className="w-1/3 bg-[#a2812a] group-hover:bg-[#8f7124] transition-colors flex items-center justify-center text-white">
                      <Icon
                        size={34}
                        strokeWidth={1.5}
                        className="group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT SIDEBAR (AGENDA DO DIA) */}
            <div className="w-full lg:w-80 flex-shrink-0 bg-white shadow-sm flex flex-col border border-gray-100 rounded-sm overflow-hidden h-fit max-h-full">
              <div className="bg-[#0c1826] text-white py-3 px-4 text-center text-xs font-bold tracking-[0.15em] uppercase">
                Agenda do dia
              </div>

              {/* Input Rápido */}
              <div className="px-4 py-3 flex border-b border-gray-100 items-center justify-between text-sm">
                <input
                  type="text"
                  placeholder="Nova tarefa..."
                  className="w-2/3 outline-none text-gray-500 placeholder-gray-400 italic bg-transparent"
                />
                <div className="flex items-center gap-1 text-gray-400">
                  <input
                    type="text"
                    placeholder="Hora"
                    className="w-10 text-center outline-none bg-transparent"
                  />
                  <span>:</span>
                  <input
                    type="text"
                    placeholder="Min."
                    className="w-10 text-center outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Lista de Tarefas */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {agendaItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${item.highlight ? "text-red-500" : "text-gray-600"
                      }`}
                  >
                    <div className="flex flex-col items-center gap-2 mt-1">
                      <User
                        fill="currentColor"
                        size={14}
                        className={
                          item.highlight ? "text-red-500" : "text-gray-500"
                        }
                      />
                      <Phone
                        fill="currentColor"
                        size={14}
                        className={
                          item.highlight ? "text-red-500" : "text-gray-500"
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div
                        className={`text-sm font-semibold ${item.highlight ? "text-red-500" : "text-[#555]"}`}
                      >
                        {item.name}
                      </div>
                      <div
                        className={`text-xs ${item.highlight ? "text-red-500" : "text-gray-500"}`}
                      >
                        {item.phone}
                      </div>
                      <div className="flex gap-2 items-center text-xs text-gray-500">
                        <span
                          className={
                            item.highlight ? "text-red-400 font-medium" : ""
                          }
                        >
                          {item.time}
                        </span>
                        <span className={item.highlight ? "text-red-400" : ""}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
      `}</style>
    </div>
  );
};
