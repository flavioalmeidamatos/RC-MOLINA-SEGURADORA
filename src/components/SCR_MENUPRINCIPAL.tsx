import React, { useState } from "react";
import {
  Banknote,
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Info,
  Lightbulb,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClientRegistrationMultipage } from "./ClientRegistrationMultipage";
import { supabase } from "../lib/supabase";

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [credential, setCredential] = useState({
    login: "Rosilene Rodrigues de Carvalho Molina",
    senha: "123",
    leadUrl: "",
  });
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/import-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const data = await response.json();

      if (data.success) {
        setImportResult({
          type: "success",
          message: "Lead importada com sucesso!",
          data: data.data,
        });
      } else {
        setImportResult({
          type: "error",
          message: data.error || "Erro ao importar",
        });
      }
    } catch (_error) {
      setImportResult({
        type: "error",
        message: "Erro de conexão com o servidor",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleCardClick = (line1: string, line2: string) => {
    if (line1 === "Simulador") {
      setActiveMenu("Simulador");
      return;
    }

    if (line1 === "Meus" && line2 === "clientes") {
      setActiveMenu("Meus clientes");
      return;
    }

    if (line1 === "Informações") {
      setCredential((prev) => ({
        ...prev,
        leadUrl: "http://sistemaquer.com.br/alterar-indicacao.php?indicacao_id=274959",
      }));
      setShowImportModal(true);
      return;
    }
  };

  const menuItems = [
    { title: "Home", icon: Home },
    { title: "Meus clientes", icon: Briefcase },
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
  ];

  const showSimulator = activeMenu === "Simulador";
  const showClientArea = activeMenu === "Meus clientes";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F0F4F8] font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="w-full flex-shrink-0 bg-[#0c1826] shadow-xl lg:w-64 lg:z-20">
        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[#b58c2a] to-[#806117] px-4 py-6 shadow-inner lg:h-44 lg:pt-4 lg:pb-2">
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/50 bg-white shadow-md transition-all hover:border-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User size={32} className="text-gray-400" />
            )}
          </div>
          <span className="px-4 text-center text-sm font-medium text-white">{userName}</span>
        </div>

        <div className="custom-scrollbar flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-0 lg:overflow-y-auto lg:px-0 lg:py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.title;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setActiveMenu(item.title)}
                className={`flex min-w-max items-center justify-between gap-3 rounded-2xl border-l-4 px-4 py-3 text-left transition-colors lg:w-full lg:rounded-none lg:px-6 ${
                  isActive
                    ? "border-[#b58c2a] bg-[#152a42] text-white"
                    : "border-transparent text-gray-400 hover:bg-[#112338] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? "text-[#b58c2a]" : "text-gray-500"} />
                  <span className="text-sm">{item.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-4 bg-white px-4 py-4 shadow-sm sm:px-6 md:px-8 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col items-start bg-white px-2 py-1">
              <div className="text-xl font-bold leading-none tracking-widest text-[#d4af37]">
                RC MOLINA
              </div>
              <div className="mt-1 text-center text-[10px] font-bold tracking-[0.3em] text-[#0c1826]">
                SEGUROS
              </div>
            </div>

            <span className="border-l border-gray-200 pl-4 text-sm text-gray-400">
              {activeMenu === "Home" ? "Painel Administrativo" : activeMenu}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <button className="flex items-center gap-2 text-gray-500 transition-colors hover:text-[#b58c2a]">
              <Calendar size={18} />
              <span className="text-sm">Agenda</span>
            </button>

            <div className="hidden h-8 w-px bg-gray-200 sm:block" />

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 shadow-sm">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={16} className="text-gray-400" />
                )}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 md:inline">
                {userName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 transition-colors hover:text-red-600"
            >
              <LogOut size={18} />
              <span className="text-sm">Sair</span>
            </button>
          </div>
        </header>

        {showSimulator ? (
          <div className="relative flex-1 overflow-hidden bg-gray-50">
            <iframe
              src="https://app.simuladoronline.com/login/"
              title="Simulador Online"
              className="absolute inset-0 h-full w-full border-none bg-white"
              allowFullScreen
            />
          </div>
        ) : showClientArea ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            <ClientRegistrationMultipage />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <button
                      key={`${card.line1}-${card.line2}`}
                      type="button"
                      onClick={() => handleCardClick(card.line1, card.line2)}
                      className="group flex h-auto min-h-[112px] overflow-hidden bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex w-2/3 flex-col justify-center border-l-4 border-transparent p-5 transition-all group-hover:border-[#b58c2a]">
                        <span className="text-sm leading-tight text-[#a48641] transition-colors group-hover:text-[#8e733b]">
                          {card.line1}
                        </span>
                        {card.line2 ? (
                          <span className="text-sm font-bold leading-tight text-[#8e733b]">
                            {card.line2}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex w-1/3 items-center justify-center bg-[#a2812a] text-white transition-colors group-hover:bg-[#8f7124]">
                        <Icon
                          size={34}
                          strokeWidth={1.5}
                          className="transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <aside className="h-fit w-full max-h-full flex-shrink-0 overflow-hidden rounded-sm border border-gray-100 bg-white shadow-sm lg:w-80">
                <div className="bg-[#0c1826] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-white">
                  Agenda do dia
                </div>

                <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <input
                    type="text"
                    placeholder="Nova tarefa..."
                    className="w-full bg-transparent italic text-gray-500 outline-none placeholder-gray-400 sm:w-2/3"
                  />
                  <div className="flex items-center gap-1 text-gray-400">
                    <input
                      type="text"
                      placeholder="Hora"
                      className="w-12 bg-transparent text-center outline-none"
                    />
                    <span>:</span>
                    <input
                      type="text"
                      placeholder="Min."
                      className="w-12 bg-transparent text-center outline-none"
                    />
                  </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto">
                  {agendaItems.map((item) => (
                    <div
                      key={`${item.name}-${item.time}`}
                      className={`flex cursor-pointer items-start gap-4 border-b border-gray-100 p-4 transition-colors hover:bg-gray-50 ${
                        item.highlight ? "text-red-500" : "text-gray-600"
                      }`}
                    >
                      <div className="mt-1 flex flex-col items-center gap-2">
                        <User
                          fill="currentColor"
                          size={14}
                          className={item.highlight ? "text-red-500" : "text-gray-500"}
                        />
                        <Phone
                          fill="currentColor"
                          size={14}
                          className={item.highlight ? "text-red-500" : "text-gray-500"}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div
                          className={`text-sm font-semibold ${
                            item.highlight ? "text-red-500" : "text-[#555]"
                          }`}
                        >
                          {item.name}
                        </div>
                        <div
                          className={`text-xs ${
                            item.highlight ? "text-red-500" : "text-gray-500"
                          }`}
                        >
                          {item.phone}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={item.highlight ? "font-medium text-red-400" : ""}>
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
              </aside>
            </div>
          </div>
        )}
      </div>

      {showImportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl animate-in fade-in zoom-in duration-300"
          >
            <div className="flex flex-shrink-0 items-center justify-between bg-[#0c1826] p-4">
              <h3 className="flex items-center gap-2 font-bold text-[#b58c2a]">
                <ExternalLink size={20} />
                Importar do Sistema Quer
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                className="text-gray-400 transition-colors hover:text-white"
              >
                X
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
              {!importResult?.data ? (
                <form onSubmit={handleImportLead} className="space-y-4">
                  <p className="mb-4 text-xs text-gray-500">
                    Insira suas credenciais do <b>Sistema Quer</b> para capturarmos os dados da indicação automaticamente.
                  </p>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">Login</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#b58c2a]"
                      value={credential.login}
                      onChange={(e) => setCredential({ ...credential, login: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">Senha</label>
                    <input
                      type="password"
                      required
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#b58c2a]"
                      value={credential.senha}
                      onChange={(e) => setCredential({ ...credential, senha: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      URL da Indicação (Link)
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="Cole o link do Sistema Quer aqui"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm italic outline-none transition-colors focus:border-[#b58c2a]"
                      value={credential.leadUrl}
                      onChange={(e) => setCredential({ ...credential, leadUrl: e.target.value })}
                    />
                  </div>

                  {importResult?.type === "error" ? (
                    <div className="rounded border border-red-100 bg-red-50 p-3 text-xs text-red-600">
                      {importResult.message}
                    </div>
                  ) : null}

                  <button
                    disabled={importLoading}
                    className="flex w-full items-center justify-center gap-2 rounded bg-[#b58c2a] py-3 font-bold text-white shadow-lg transition-all hover:bg-[#806117] disabled:opacity-50"
                  >
                    {importLoading ? <Loader2 className="animate-spin" size={18} /> : "IMPORTAR AGORA"}
                  </button>
                </form>
              ) : (
                <div className="animate-in slide-in-from-bottom-2 space-y-6 pb-4">
                  <div className="mb-2 flex items-center justify-center gap-2 text-lg font-bold text-green-600">
                    <Loader2 className="animate-pulse" size={24} />
                    Dados Recuperados com Sucesso!
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <User size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Dados Pessoais</span>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Nome</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.nome}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Telefone</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.telefone}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">E-mail</label>
                        <p className="break-all text-sm font-medium text-gray-800">{importResult.data.email}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">CPF/CNPJ</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.cpf_cnpj || "---"}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Data Nascimento</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.nascimento || "---"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <MapPin size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Localização</span>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Endereço</label>
                        <p className="text-sm font-medium text-gray-800">
                          {importResult.data.endereco} {importResult.data.numero ? `, ${importResult.data.numero}` : ""}
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Bairro</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.bairro || "---"}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400">Cidade</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.cidade || "---"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <FileText size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Dados do Cálculo / Observações</span>
                    </div>
                    <div className="p-4">
                      <p className="whitespace-pre-wrap rounded border border-yellow-100 bg-yellow-50/50 p-3 text-sm text-gray-700">
                        {importResult.data.observacao || "Nenhuma observação encontrada."}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
                      <Users size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Composição de Vidas (Faixas Etárias)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
                      {Object.entries(importResult.data.vidas || {}).map(([faixa, qtd]: [any, any]) => (
                        <div
                          key={faixa}
                          className="rounded border border-gray-100 bg-gray-50 p-2 text-center"
                        >
                          <label className="mb-1 block text-[9px] uppercase leading-none text-gray-400">
                            {faixa}
                          </label>
                          <span className={`${qtd !== "0" ? "font-bold text-[#b58c2a]" : "text-gray-300"} text-sm`}>
                            {qtd}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowImportModal(false)}
                    className="flex w-full items-center justify-center gap-2 rounded bg-[#0c1826] py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-black"
                  >
                    CONCLUIR E USAR DADOS
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-3 text-center text-[10px] uppercase tracking-widest text-gray-400">
              Sessão temporária • Criptografada
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
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
