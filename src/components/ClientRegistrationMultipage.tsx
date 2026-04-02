import React, { useMemo, useState } from 'react';
import {
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
import {
  formatarCNPJ,
  formatarCPF,
  formatarDataBR,
  validarCNPJ,
  validarCPF,
  validarDataNascimentoBR,
  validarEmailRFC5322,
} from '../lib/validacoes';

type TabId = 'geral' | 'endereco' | 'extras' | 'documentacao';

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
  documentacao: string;
  marcacoes: string;
  comoConheceu: string;
  permiteAgendarOnline: boolean;
  status: 'ATIVO' | 'INATIVO';
  codigo: string;
  dataCadastro: string;
  dataAtualizacao: string;
};

type FieldErrorState = {
  cpf: string;
  cnpj: string;
  dataNascimento: string;
};

type ContactErrorState = Record<number, string>;

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'geral', label: 'Geral', icon: UserRound },
  { id: 'endereco', label: 'Endereço', icon: MapPinned },
  { id: 'extras', label: 'Extras', icon: FileText },
  { id: 'documentacao', label: 'Documentação', icon: FileText },
];

const tabLabels: Record<TabId, string> = {
  geral: 'Geral',
  endereco: 'Endereço',
  extras: 'Extras',
  documentacao: 'Documentação',
};

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
  documentacao: '',
  marcacoes: '',
  comoConheceu: '0 - Não informado',
  permiteAgendarOnline: true,
  status: 'ATIVO',
  codigo: 'Novo',
  dataCadastro: '',
  dataAtualizacao: '',
};

const initialFieldErrors: FieldErrorState = {
  cpf: '',
  cnpj: '',
  dataNascimento: '',
};

const initialContacts: ContactRow[] = [
  { id: 1, type: 'Celular', value: '', extra: 'Outro', notes: '', favorite: false },
  { id: 2, type: 'E-mail', value: '', extra: '', notes: '', favorite: false },
  { id: 3, type: 'Residencial', value: '', extra: 'Complemento', notes: '', favorite: false },
];

const estados = ['Selecione...', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const cidadesPorEstado: Record<string, string[]> = {
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Volta Redonda'],
  SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto'],
  MG: ['Belo Horizonte', 'Juiz de Fora', 'Uberlândia', 'Contagem'],
};

const fieldClassName =
  'h-11 w-full rounded-2xl border border-black bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 sm:h-10 sm:px-4';

const textAreaClassName =
  'w-full rounded-2xl border border-black bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 sm:px-4';

const sectionCardClassName = 'rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:p-5';

const errorMessageClassName = 'mt-2 text-xs font-semibold text-red-600';

const somenteDigitos = (valor: string): string => valor.replace(/\D/g, '');
const somenteLetrasEEspacos = (valor: string): string => valor.replace(/[^A-Za-zÀ-ÿ\s]/g, '');

const formatarTelefoneContato = (valor: string, tipo: string): string => {
  const digitos = somenteDigitos(valor).slice(0, tipo === 'Celular' ? 11 : 10);

  if (tipo === 'Celular') {
    if (digitos.length <= 2) return digitos;
    if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
};

export const ClientRegistrationMultipage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [feedback, setFeedback] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>(initialFieldErrors);
  const [contactErrors, setContactErrors] = useState<ContactErrorState>({});

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const cidadeOptions = useMemo(() => cidadesPorEstado[formState.enderecoEstado] || [], [formState.enderecoEstado]);
  const hasFormChanges = useMemo(
    () =>
      JSON.stringify(formState) !== JSON.stringify(initialFormState) ||
      JSON.stringify(contacts) !== JSON.stringify(initialContacts),
    [contacts, formState],
  );

  const handleFieldChange = <K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateFieldError = (field: keyof FieldErrorState, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleCPFChange = (value: string) => {
    handleFieldChange('cpf', formatarCPF(value));
    updateFieldError('cpf', '');
  };

  const handleCNPJChange = (value: string) => {
    handleFieldChange('cnpj', formatarCNPJ(value));
    updateFieldError('cnpj', '');
  };

  const handleDataNascimentoChange = (value: string) => {
    handleFieldChange('dataNascimento', formatarDataBR(value));
    updateFieldError('dataNascimento', '');
  };

  const validateCPFField = () => {
    if (!formState.cpf) {
      updateFieldError('cpf', '');
      return;
    }
    updateFieldError('cpf', validarCPF(formState.cpf) ? '' : 'Informe um CPF válido.');
  };

  const validateCNPJField = () => {
    if (!formState.cnpj) {
      updateFieldError('cnpj', '');
      return;
    }
    updateFieldError('cnpj', validarCNPJ(formState.cnpj) ? '' : 'Informe um CNPJ válido.');
  };

  const validateBirthDateField = () => {
    if (!formState.dataNascimento) {
      updateFieldError('dataNascimento', '');
      return;
    }
    updateFieldError(
      'dataNascimento',
      validarDataNascimentoBR(formState.dataNascimento) ? '' : 'Informe uma data de nascimento válida.',
    );
  };

  const handleContactChange = (id: number, field: keyof ContactRow, value: string | boolean) => {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)),
    );
  };

  const handleContactTypeChange = (id: number, nextType: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              type: nextType,
              value:
                nextType === 'E-mail'
                  ? ''
                  : formatarTelefoneContato(contact.value, nextType),
            }
          : contact,
      ),
    );
    setContactErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const handleContactValueChange = (id: number, type: string, value: string) => {
    const nextValue = type === 'E-mail' ? value.trimStart() : formatarTelefoneContato(value, type);
    handleContactChange(id, 'value', nextValue);
    setContactErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const validateContactValue = (id: number) => {
    const contact = contacts.find((item) => item.id === id);
    if (!contact || !contact.value) {
      setContactErrors((prev) => ({ ...prev, [id]: '' }));
      return;
    }

    if (contact.type === 'E-mail') {
      setContactErrors((prev) => ({
        ...prev,
        [id]: validarEmailRFC5322(contact.value) ? '' : 'Informe um e-mail válido.',
      }));
      return;
    }

    const totalDigitos = somenteDigitos(contact.value).length;
    const minimo = contact.type === 'Celular' ? 11 : 10;
    setContactErrors((prev) => ({
      ...prev,
      [id]: totalDigitos === minimo ? '' : 'Informe um telefone válido.',
    }));
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
    setFieldErrors(initialFieldErrors);
    setContactErrors({});
    setActiveTab('geral');
    setFeedback('Novo cliente pronto para preenchimento.');
  };

  const saveClient = () => {
    validateCPFField();
    validateCNPJField();
    validateBirthDateField();
    contacts.forEach((contact) => validateContactValue(contact.id));
    setFeedback('Layout multipage de clientes pronto. O próximo passo pode ser conectar ao Supabase.');
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

  return (
    <section className="flex-1 space-y-3 sm:space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-3 pb-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[#3d8ed8]">
            <span className="text-xs font-black uppercase tracking-[0.24em]">Cadastro de clientes</span>
            <Info size={16} className="shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={saveClient}
              disabled={!hasFormChanges}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-50 disabled:shadow-none sm:min-h-10"
            >
              <Save size={18} />
              Salvar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#4e9bdd] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#4e9bdd]/20 transition hover:bg-[#377fbf] sm:min-h-10"
            >
              <PlusCircle size={18} />
              Novo cliente
            </button>
          </div>
        </div>

        {feedback ? (
          <div className="px-3 pt-3">
            <div className="rounded-2xl border border-[#3d8ed8]/20 bg-[#3d8ed8]/5 px-4 py-2.5 text-sm text-[#225f97]">
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition sm:min-h-10 ${
                  isActive
                    ? 'border-[#ef6b74] bg-[#fff6f6] text-[#2e6ea8] shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2e6ea8]' : 'text-slate-400'} />
                {tabLabels[tab.id]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <section className={activeTab === 'geral' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Nome*</label>
                <input
                  className={fieldClassName}
                  value={formState.nome}
                  onChange={(event) => handleFieldChange('nome', somenteLetrasEEspacos(event.target.value))}
                  placeholder="Nome completo do cliente"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">CPF</label>
                <input
                  className={fieldClassName}
                  value={formState.cpf}
                  onChange={(event) => handleCPFChange(event.target.value)}
                  onBlur={validateCPFField}
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                />
                {fieldErrors.cpf ? <p className={errorMessageClassName}>{fieldErrors.cpf}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">RG</label>
                <input
                  className={fieldClassName}
                  value={formState.rg}
                  onChange={(event) => handleFieldChange('rg', event.target.value)}
                  placeholder="RG"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">CNPJ</label>
                <input
                  className={fieldClassName}
                  value={formState.cnpj}
                  onChange={(event) => handleCNPJChange(event.target.value)}
                  onBlur={validateCNPJField}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                />
                {fieldErrors.cnpj ? <p className={errorMessageClassName}>{fieldErrors.cnpj}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Data de nascimento</label>
                <input
                  className={fieldClassName}
                  value={formState.dataNascimento}
                  onChange={(event) => handleDataNascimentoChange(event.target.value)}
                  onBlur={validateBirthDateField}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="dd/mm/aaaa"
                />
                {fieldErrors.dataNascimento ? (
                  <p className={errorMessageClassName}>{fieldErrors.dataNascimento}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 sm:text-lg">Contatos*</h3>
                  <p className="text-sm text-slate-500">Mantenha os canais principais sempre visíveis e tocáveis.</p>
                </div>
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#4e9bdd] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#4e9bdd]/20 transition hover:bg-[#377fbf] sm:min-h-10"
                >
                  <PlusCircle size={18} />
                  Adicionar contato
                </button>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/70">
                <div className="hidden xl:grid xl:grid-cols-[0.9fr_1.15fr_1fr_1fr_auto] xl:gap-2.5 xl:border-b xl:border-slate-200 xl:bg-white xl:px-4 xl:py-2.5">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tipo</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Contato</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Complemento</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Observações</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ações</span>
                </div>

                {contacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className={`bg-white px-3 py-2.5 sm:px-4 sm:py-3 ${
                      index !== contacts.length - 1 ? 'border-b border-slate-200' : ''
                    }`}
                  >
                    <div className="grid gap-2.5 xl:grid-cols-[0.9fr_1.15fr_1fr_1fr_auto]">
                    <select
                      className={fieldClassName}
                      value={contact.type}
                      onChange={(event) => handleContactTypeChange(contact.id, event.target.value)}
                    >
                      <option>Celular</option>
                      <option>E-mail</option>
                      <option>Residencial</option>
                      <option>Comercial</option>
                    </select>

                    <input
                      className={fieldClassName}
                      value={contact.value}
                      onChange={(event) => handleContactValueChange(contact.id, contact.type, event.target.value)}
                      onBlur={() => validateContactValue(contact.id)}
                      inputMode={contact.type === 'E-mail' ? 'email' : 'numeric'}
                      maxLength={contact.type === 'Celular' ? 15 : contact.type === 'E-mail' ? 120 : 14}
                      placeholder={contact.type === 'E-mail' ? 'E-mail' : 'Número'}
                    />

                    <input
                      className={fieldClassName}
                      value={contact.extra}
                      onChange={(event) => handleContactChange(contact.id, 'extra', event.target.value)}
                      placeholder="Outro / complemento"
                    />

                    <input
                      className={fieldClassName}
                      value={contact.notes}
                      onChange={(event) => handleContactChange(contact.id, 'notes', event.target.value)}
                      placeholder="Observações"
                    />

                      <div className="grid grid-cols-2 gap-2 sm:max-w-36 xl:max-w-none">
                      <button
                        type="button"
                        onClick={() => handleContactChange(contact.id, 'favorite', !contact.favorite)}
                        aria-label={contact.favorite ? 'Desmarcar favorito' : 'Marcar favorito'}
                          className={`inline-flex h-11 items-center justify-center rounded-2xl transition sm:h-10 ${
                            contact.favorite
                              ? 'bg-rose-50 text-rose-500'
                              : 'bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-500'
                          }`}
                      >
                        <Heart size={18} fill={contact.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeContact(contact.id)}
                        aria-label="Remover contato"
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-transparent text-slate-400 transition hover:bg-red-50 hover:text-red-500 sm:h-10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {contactErrors[contact.id] ? <p className={errorMessageClassName}>{contactErrors[contact.id]}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        </section>

        <section className={activeTab === 'endereco' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-3 xl:grid-cols-[0.8fr_2.2fr_0.8fr]">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">CEP</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoCep}
                  onChange={(event) => handleFieldChange('enderecoCep', event.target.value)}
                  placeholder="Pesquisar"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Endereço</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoRua}
                  onChange={(event) => handleFieldChange('enderecoRua', event.target.value)}
                  placeholder="Rua, avenida ou logradouro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Número</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoNumero}
                  onChange={(event) => handleFieldChange('enderecoNumero', event.target.value)}
                  placeholder="Número"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Complemento</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoComplemento}
                  onChange={(event) => handleFieldChange('enderecoComplemento', event.target.value)}
                  placeholder="Apartamento, bloco, sala"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">Ponto de referência</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoReferencia}
                  onChange={(event) => handleFieldChange('enderecoReferencia', event.target.value)}
                  placeholder="Ex.: próximo à praça central"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Bairro</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoBairro}
                  onChange={(event) => handleFieldChange('enderecoBairro', event.target.value)}
                  placeholder="Bairro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Estado</label>
                <select
                  className={fieldClassName}
                  value={formState.enderecoEstado}
                  onChange={(event) => {
                    handleFieldChange('enderecoEstado', event.target.value);
                    handleFieldChange('enderecoCidade', '');
                  }}
                >
                  {estados.map((state) => (
                    <option key={state} value={state === 'Selecione...' ? '' : state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Cidade</label>
                <select
                  className={fieldClassName}
                  value={formState.enderecoCidade}
                  onChange={(event) => handleFieldChange('enderecoCidade', event.target.value)}
                >
                  <option value="">Selecione uma cidade...</option>
                  {cidadeOptions.map((city) => (
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
            <div className="grid gap-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Observações</label>
                <textarea
                  className={`${textAreaClassName} min-h-32 resize-y`}
                  value={formState.observacoes}
                  onChange={(event) => handleFieldChange('observacoes', event.target.value)}
                  placeholder="Registre detalhes importantes sobre este cliente"
                />
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_0.8fr]">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Marcações</label>
                  <input
                    className={fieldClassName}
                    value={formState.marcacoes}
                    onChange={(event) => handleFieldChange('marcacoes', event.target.value)}
                    placeholder="Digite o texto e pressione enter"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Como nos conheceu?</label>
                  <select
                    className={fieldClassName}
                    value={formState.comoConheceu}
                    onChange={(event) => handleFieldChange('comoConheceu', event.target.value)}
                  >
                    <option>0 - Não informado</option>
                    <option>1 - Indicação</option>
                    <option>2 - Google</option>
                    <option>3 - Instagram</option>
                    <option>4 - Evento</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Permite agendar online?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('permiteAgendarOnline', true)}
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition sm:min-h-10 ${
                        formState.permiteAgendarOnline
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-black bg-white text-slate-500'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('permiteAgendarOnline', false)}
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition sm:min-h-10 ${
                        !formState.permiteAgendarOnline
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-black bg-white text-slate-500'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'ATIVO')}
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition sm:min-h-10 ${
                        formState.status === 'ATIVO'
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-black bg-white text-slate-500'
                      }`}
                    >
                      ATIVO
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'INATIVO')}
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition sm:min-h-10 ${
                        formState.status === 'INATIVO'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-black bg-white text-slate-500'
                      }`}
                    >
                      INATIVO
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Código</label>
                  <input
                    className={`${fieldClassName} bg-slate-100`}
                    value={formState.codigo}
                    onChange={(event) => handleFieldChange('codigo', event.target.value)}
                    placeholder="Novo"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Data de cadastro</label>
                  <input
                    className={fieldClassName}
                    value={formState.dataCadastro}
                    onChange={(event) => handleFieldChange('dataCadastro', event.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Data de atualização</label>
                  <input
                    className={fieldClassName}
                    value={formState.dataAtualizacao}
                    onChange={(event) => handleFieldChange('dataAtualizacao', event.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={activeTab === 'documentacao' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Documentação</label>
                <textarea
                  className={`${textAreaClassName} min-h-40 resize-y`}
                  value={formState.documentacao}
                  onChange={(event) => handleFieldChange('documentacao', event.target.value)}
                  placeholder="Registre documentos, anexos, números de apólice, vencimentos e observações importantes"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Checklist</p>
                  <p className="mt-2 text-sm text-slate-600">Use esta aba para centralizar RG, CPF, comprovantes e dados da apólice.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Organização</p>
                  <p className="mt-2 text-sm text-slate-600">Mantenha um resumo rápido para consulta no celular sem precisar abrir vários blocos.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2 xl:col-span-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Próxima ação</p>
                  <p className="mt-2 text-sm text-slate-600">Anote pendências de envio, retorno do cliente e validações que ainda faltam.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Etapa {activeTabIndex + 1} de {tabs.length}. Todas as telas do multipage estão prontas para navegação.
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={goToPreviousTab}
              disabled={activeTabIndex === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
            >
              <ChevronLeft size={18} />
              Voltar
            </button>

            <button
              type="button"
              onClick={goToNextTab}
              disabled={activeTabIndex === tabs.length - 1}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#0c1826] px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
            >
              Próximo
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
