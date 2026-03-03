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
  Loader2,
  ExternalLink,
  MapPin,
  FileText,
  Users
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [credential, setCredential] = useState({
    login: 'Rosilene Rodrigues de Carvalho Molina',
    senha: '123',
    leadUrl: ''
  });
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportResult(null);
    try {
      const response = await fetch('/api/import-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential)
      });
      const data = await response.json();
      if (data.success) {
        setImportResult({ type: 'success', message: 'Lead importada com sucesso!', data: data.data });
      } else {
        setImportResult({ type: 'error', message: data.error || 'Erro ao importar' });
      }
    } catch (err) {
      setImportResult({ type: 'error', message: 'Erro de conexão com o servidor' });
    } finally {
      setImportLoading(false);
    }
  };

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
                      if (card.line1 === "Informações") {
                        setCredential(prev => ({ ...prev, leadUrl: 'http://sistemaquer.com.br/alterar-indicacao.php?indicacao_id=274959' }));
                        setShowImportModal(true);
                      }
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

      {/* MODAL DE IMPORTAÇÃO */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="bg-[#0c1826] p-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-[#b58c2a] font-bold flex items-center gap-2">
                <ExternalLink size={20} />
                Importar do Sistema Quer
              </h3>
              <button
                onClick={() => { setShowImportModal(false); setImportResult(null); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {!importResult?.data ? (
                <form onSubmit={handleImportLead} className="space-y-4">
                  <p className="text-xs text-gray-500 mb-4">
                    Insira suas credenciais do <b>Sistema Quer</b> para capturarmos os dados da indicação automaticamente.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Login</label>
                    <input
                      type="text"
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#b58c2a] outline-none transition-colors"
                      value={credential.login}
                      onChange={e => setCredential({ ...credential, login: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Senha</label>
                    <input
                      type="password"
                      required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#b58c2a] outline-none transition-colors"
                      value={credential.senha}
                      onChange={e => setCredential({ ...credential, senha: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">URL da Indicação (Link)</label>
                    <input
                      type="url"
                      required
                      placeholder="Cole o link do Sistema Quer aqui"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#b58c2a] outline-none transition-colors italic"
                      value={credential.leadUrl}
                      onChange={e => setCredential({ ...credential, leadUrl: e.target.value })}
                    />
                  </div>

                  {importResult?.type === 'error' && (
                    <div className="bg-red-50 text-red-600 p-3 rounded text-xs border border-red-100">
                      {importResult.message}
                    </div>
                  )}

                  <button
                    disabled={importLoading}
                    className="w-full bg-[#b58c2a] hover:bg-[#806117] text-white font-bold py-3 rounded shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {importLoading ? <Loader2 className="animate-spin" size={18} /> : 'IMPORTAR AGORA'}
                  </button>
                </form>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 pb-4">
                  <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-lg mb-2">
                    <Loader2 className="animate-pulse" size={24} />
                    Dados Recuperados com Sucesso!
                  </div>

                  {/* SEÇÃO: DADOS PESSOAIS */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                      <User size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Dados Pessoais</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Nome</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.nome}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Telefone</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.telefone}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">E-mail</label>
                        <p className="text-sm font-medium text-gray-800 break-all">{importResult.data.email}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">CPF/CNPJ</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.cpf_cnpj || '---'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Data Nascimento</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.nascimento || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO: ENDEREÇO */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                      <MapPin size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Localização</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Endereço</label>
                        <p className="text-sm font-medium text-gray-800">
                          {importResult.data.endereco} {importResult.data.numero ? `, ${importResult.data.numero}` : ''}
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Bairro</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.bairro || '---'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Cidade</label>
                        <p className="text-sm font-medium text-gray-800">{importResult.data.cidade || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO: DADOS DO CÁLCULO */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                      <FileText size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Dados do Cálculo / Observações</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-yellow-50/50 p-3 rounded border border-yellow-100">
                        {importResult.data.observacao || 'Nenhuma observação encontrada.'}
                      </p>
                    </div>
                  </div>

                  {/* SEÇÃO: COMPOSIÇÃO DE VIDAS */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                      <Users size={16} className="text-[#b58c2a]" />
                      <span className="text-xs font-bold uppercase text-gray-700">Composição de Vidas (Faixas Etárias)</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Object.entries(importResult.data.vidas || {}).map(([faixa, qtd]: [any, any]) => (
                        <div key={faixa} className="bg-gray-50 p-2 rounded border border-gray-100 text-center">
                          <label className="text-[9px] text-gray-400 uppercase block leading-none mb-1">{faixa}</label>
                          <span className={`${qtd !== "0" ? "text-[#b58c2a] font-bold" : "text-gray-300"} text-sm`}>{qtd}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowImportModal(false)}
                    className="w-full bg-[#0c1826] text-white py-4 rounded font-bold text-sm hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    CONCLUIR E USAR DADOS
                  </button>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-3 text-[10px] text-gray-400 text-center uppercase tracking-widest flex-shrink-0">
              Sessão temporária • Criptografada
            </div>
          </div>
        </div>
      )}

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
