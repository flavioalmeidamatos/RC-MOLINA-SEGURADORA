import React, { useState } from 'react';
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Info,
  MapPinned,
  PlusCircle,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';

type TabId = 'geral' | 'endereco' | 'extras' | 'credito';

type ContactRow = {
  id: number;
  type: string;
  value: string;
  extra: string;
  notes: string;
  favorite: boolean;
};

type ClientFormState = {
  nome: string;
  cpf: string;
  rg: string;
  cnpj: string;
  dataNascimento: string;
  enderecoCep: string;
  enderecoRua: string;
  enderecoNumero: string;
  enderecoComplemento: string;
  enderecoReferencia: string;
  enderecoBairro: string;
  enderecoEstado: string;
  enderecoCidade: string;
  observacoes: string;
  marcacoes: string;
  comoConheceu: string;
  permiteAgendarOnline: boolean;
  status: 'ATIVO' | 'INATIVO';
  codigo: string;
  dataCadastro: string;
  dataAtualizacao: string;
  limiteCredito: string;
  creditoDisponivel: string;
  vencimentoCredito: string;
  responsavelFinanceiro: string;
  observacoesCredito: string;
};

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'geral', label: 'Geral', icon: UserRound },
  { id: 'endereco', label: 'Endereco', icon: MapPinned },
  { id: 'extras', label: 'Extras', icon: FileText },
  { id: 'credito', label: 'Credito do Cliente', icon: BadgeDollarSign },
];

const initialFormState: ClientFormState = {
  nome: '',
  cpf: '',
  rg: '',
  cnpj: '',
  dataNascimento: '',
  enderecoCep: '',
  enderecoRua: '',
  enderecoNumero: '',
  enderecoComplemento: '',
  enderecoReferencia: '',
  enderecoBairro: '',
  enderecoEstado: '',
  enderecoCidade: '',
  observacoes: '',
  marcacoes: '',
  comoConheceu: '0 - Nao informado',
  permiteAgendarOnline: true,
  status: 'ATIVO',
  codigo: 'Novo',
  dataCadastro: '',
  dataAtualizacao: '',
  limiteCredito: '',
  creditoDisponivel: '',
  vencimentoCredito: '',
  responsavelFinanceiro: '',
  observacoesCredito: '',
};

const initialContacts: ContactRow[] = [
  { id: 1, type: 'Celular', value: '', extra: 'Outro', notes: '', favorite: false },
  { id: 2, type: 'E-mail', value: '', extra: '', notes: '', favorite: false },
  { id: 3, type: 'Residencial', value: '', extra: 'Complemento', notes: '', favorite: false },
];

const states = ['Selecione...', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const citiesByState: Record<string, string[]> = {
  RJ: ['Rio de Janeiro', 'Niteroi', 'Petropolis', 'Volta Redonda'],
  SP: ['Sao Paulo', 'Campinas', 'Santos', 'Ribeirao Preto'],
  MG: ['Belo Horizonte', 'Juiz de Fora', 'Uberlandia', 'Contagem'],
};

const inputClassName =
  'w-full rounded-2xl border border-black bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10';

const sectionCardClassName = 'rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6';

export const ClientRegistrationMultipage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [feedback, setFeedback] = useState('');

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const handleFieldChange = <K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (id: number, field: keyof ContactRow, value: string | boolean) => {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)),
    );
  };

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { id: Date.now(), type: 'Celular', value: '', extra: 'Outro', notes: '', favorite: false },
    ]);
  };

  const removeContact = (id: number) => {
    setContacts((prev) => (prev.length > 1 ? prev.filter((contact) => contact.id !== id) : prev));
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setContacts(initialContacts);
    setActiveTab('geral');
    setFeedback('Novo cliente pronto para preenchimento.');
  };

  const saveClient = () => {
    setFeedback('Layout multipage de clientes pronto. O proximo passo pode ser conectar ao Supabase.');
  };

  const goToPreviousTab = () => {
    if (activeTabIndex > 0) {
      setActiveTab(tabs[activeTabIndex - 1].id);
    }
  };

  const goToNextTab = () => {
    if (activeTabIndex < tabs.length - 1) {
      setActiveTab(tabs[activeTabIndex + 1].id);
    }
  };

  const cityOptions = citiesByState[formState.enderecoEstado] || [];

  return (
    <section className="flex-1 space-y-4 sm:space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[#3d8ed8]">
            <span className="text-xs font-black uppercase tracking-[0.24em]">Cadastro de Clientes</span>
            <Info size={16} className="shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={saveClient}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
            >
              <Save size={18} />
              Salvar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#4e9bdd] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#4e9bdd]/20 transition hover:bg-[#377fbf]"
            >
              <PlusCircle size={18} />
              Novo Cliente
            </button>
          </div>
        </div>

        {feedback ? (
          <div className="px-3 pt-3">
            <div className="rounded-2xl border border-[#3d8ed8]/20 bg-[#3d8ed8]/5 px-4 py-3 text-sm text-[#225f97]">
              {feedback}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? 'border-[#ef6b74] bg-[#fff6f6] text-[#2e6ea8] shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2e6ea8]' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <section className={activeTab === 'geral' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">Nome*</label>
                <input
                  className={inputClassName}
                  value={formState.nome}
                  onChange={(event) => handleFieldChange('nome', event.target.value)}
                  placeholder="Nome completo do cliente"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">CPF</label>
                <input
                  className={inputClassName}
                  value={formState.cpf}
                  onChange={(event) => handleFieldChange('cpf', event.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">RG</label>
                <input
                  className={inputClassName}
                  value={formState.rg}
                  onChange={(event) => handleFieldChange('rg', event.target.value)}
                  placeholder="RG"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">CNPJ</label>
                <input
                  className={inputClassName}
                  value={formState.cnpj}
                  onChange={(event) => handleFieldChange('cnpj', event.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Data Nascimento</label>
                <input
                  className={inputClassName}
                  value={formState.dataNascimento}
                  onChange={(event) => handleFieldChange('dataNascimento', event.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Contatos*</h3>
                  <p className="text-sm text-slate-500">Mantenha os canais principais sempre visiveis e tocaveis.</p>
                </div>
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#4e9bdd] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#4e9bdd]/20 transition hover:bg-[#377fbf]"
                >
                  <PlusCircle size={18} />
                  Contatos
                </button>
              </div>

              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4"
                >
                  <div className="grid gap-3 xl:grid-cols-[1.1fr_1.6fr_1.2fr_1.6fr_auto]">
                    <select
                      className={inputClassName}
                      value={contact.type}
                      onChange={(event) => handleContactChange(contact.id, 'type', event.target.value)}
                    >
                      <option>Celular</option>
                      <option>E-mail</option>
                      <option>Residencial</option>
                      <option>Comercial</option>
                    </select>

                    <input
                      className={inputClassName}
                      value={contact.value}
                      onChange={(event) => handleContactChange(contact.id, 'value', event.target.value)}
                      placeholder={contact.type === 'E-mail' ? 'Email' : 'Numero'}
                    />

                    <input
                      className={inputClassName}
                      value={contact.extra}
                      onChange={(event) => handleContactChange(contact.id, 'extra', event.target.value)}
                      placeholder="Outro / Complemento"
                    />

                    <input
                      className={inputClassName}
                      value={contact.notes}
                      onChange={(event) => handleContactChange(contact.id, 'notes', event.target.value)}
                      placeholder="Observacoes"
                    />

                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => handleContactChange(contact.id, 'favorite', !contact.favorite)}
                        className={`inline-flex min-h-12 items-center justify-center rounded-2xl border transition ${
                          contact.favorite
                            ? 'border-rose-200 bg-rose-50 text-rose-500'
                            : 'border-slate-200 bg-white text-slate-400 hover:text-rose-500'
                        }`}
                      >
                        <Heart size={18} fill={contact.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeContact(contact.id)}
                        className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={activeTab === 'endereco' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-4 xl:grid-cols-[0.8fr_2.2fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">CEP</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoCep}
                  onChange={(event) => handleFieldChange('enderecoCep', event.target.value)}
                  placeholder="Pesquisar"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Endereco</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoRua}
                  onChange={(event) => handleFieldChange('enderecoRua', event.target.value)}
                  placeholder="Rua, avenida ou logradouro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Numero</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoNumero}
                  onChange={(event) => handleFieldChange('enderecoNumero', event.target.value)}
                  placeholder="Numero"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Complemento</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoComplemento}
                  onChange={(event) => handleFieldChange('enderecoComplemento', event.target.value)}
                  placeholder="Apartamento, bloco, sala"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">Ponto de referencia</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoReferencia}
                  onChange={(event) => handleFieldChange('enderecoReferencia', event.target.value)}
                  placeholder="Ex.: proximo a praca central"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Bairro</label>
                <input
                  className={inputClassName}
                  value={formState.enderecoBairro}
                  onChange={(event) => handleFieldChange('enderecoBairro', event.target.value)}
                  placeholder="Bairro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Estado</label>
                <select
                  className={inputClassName}
                  value={formState.enderecoEstado}
                  onChange={(event) => {
                    handleFieldChange('enderecoEstado', event.target.value);
                    handleFieldChange('enderecoCidade', '');
                  }}
                >
                  {states.map((state) => (
                    <option key={state} value={state === 'Selecione...' ? '' : state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Cidade</label>
                <select
                  className={inputClassName}
                  value={formState.enderecoCidade}
                  onChange={(event) => handleFieldChange('enderecoCidade', event.target.value)}
                >
                  <option value="">Selecione uma cidade...</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className={activeTab === 'extras' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Observacoes</label>
                <textarea
                  className={`${inputClassName} min-h-40 resize-y`}
                  value={formState.observacoes}
                  onChange={(event) => handleFieldChange('observacoes', event.target.value)}
                  placeholder="Registre detalhes importantes sobre este cliente"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_0.8fr]">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Marcacoes</label>
                  <input
                    className={inputClassName}
                    value={formState.marcacoes}
                    onChange={(event) => handleFieldChange('marcacoes', event.target.value)}
                    placeholder="Digite o texto e pressione enter"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Como nos conheceu?</label>
                  <select
                    className={inputClassName}
                    value={formState.comoConheceu}
                    onChange={(event) => handleFieldChange('comoConheceu', event.target.value)}
                  >
                    <option>0 - Nao informado</option>
                    <option>1 - Indicacao</option>
                    <option>2 - Google</option>
                    <option>3 - Instagram</option>
                    <option>4 - Evento</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Permite Agendar Online?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('permiteAgendarOnline', true)}
                      className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        formState.permiteAgendarOnline
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('permiteAgendarOnline', false)}
                      className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        !formState.permiteAgendarOnline
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      NAO
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'ATIVO')}
                      className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        formState.status === 'ATIVO'
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      ATIVO
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'INATIVO')}
                      className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                        formState.status === 'INATIVO'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      INATIVO
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Codigo</label>
                  <input
                    className={`${inputClassName} bg-slate-100`}
                    value={formState.codigo}
                    onChange={(event) => handleFieldChange('codigo', event.target.value)}
                    placeholder="Novo"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Data Cadastro</label>
                  <input
                    className={inputClassName}
                    value={formState.dataCadastro}
                    onChange={(event) => handleFieldChange('dataCadastro', event.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Data Atualizacao</label>
                  <input
                    className={inputClassName}
                    value={formState.dataAtualizacao}
                    onChange={(event) => handleFieldChange('dataAtualizacao', event.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={activeTab === 'credito' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Limite de credito</label>
                <input
                  className={inputClassName}
                  value={formState.limiteCredito}
                  onChange={(event) => handleFieldChange('limiteCredito', event.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Credito disponivel</label>
                <input
                  className={inputClassName}
                  value={formState.creditoDisponivel}
                  onChange={(event) => handleFieldChange('creditoDisponivel', event.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Vencimento do credito</label>
                <input
                  className={inputClassName}
                  value={formState.vencimentoCredito}
                  onChange={(event) => handleFieldChange('vencimentoCredito', event.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Responsavel financeiro</label>
                <input
                  className={inputClassName}
                  value={formState.responsavelFinanceiro}
                  onChange={(event) => handleFieldChange('responsavelFinanceiro', event.target.value)}
                  placeholder="Nome do responsavel"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">Observacoes do credito</label>
                <textarea
                  className={`${inputClassName} min-h-36 resize-y`}
                  value={formState.observacoesCredito}
                  onChange={(event) => handleFieldChange('observacoesCredito', event.target.value)}
                  placeholder="Condicoes especiais, historico e acordos"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Etapa {activeTabIndex + 1} de {tabs.length}. Todas as telas do multipage estao prontas para navegacao.
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={goToPreviousTab}
              disabled={activeTabIndex === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={18} />
              Voltar
            </button>

            <button
              type="button"
              onClick={goToNextTab}
              disabled={activeTabIndex === tabs.length - 1}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0c1826] px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Proximo
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
