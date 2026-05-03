import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  File,
  FileImage,
  FileText,
  Info,
  MapPinned,
  PlusCircle,
  Save,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import {
  formatarCNPJ,
  formatarCPF,
  formatarDataBR,
  formatarRG,
  validarCNPJ,
  validarCPF,
  validarDataNascimentoBR,
  validarEmailRFC5322,
  validarRG,
} from '../../lib/validacoes';
import { SistemaQuerImportModal, type SistemaQuerLeadData } from '../dashboard/sistema_quer_import_modal';

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
  rg: string;
  cnpj: string;
  dataNascimento: string;
};

type DocumentFieldId = keyof FieldErrorState;

type ContactErrorState = Record<number, string>;

type UploadedDocument = {
  id: number;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  previewUrl: string;
  previewKind: 'image' | 'pdf' | 'document';
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

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
  codigo: '',
  dataCadastro: '',
  dataAtualizacao: '',
};

const initialFieldErrors: FieldErrorState = {
  cpf: '',
  rg: '',
  cnpj: '',
  dataNascimento: '',
};

const initialContacts: ContactRow[] = [
  { id: 1, type: 'Celular', value: '', extra: '', notes: '', favorite: false },
];

const maxContactRows = 3;

const estados = ['Selecione...', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const camposTextoMaiusculo = new Set<keyof ClientFormState>([
  'nome',
  'rg',
  'enderecoRua',
  'enderecoNumero',
  'enderecoComplemento',
  'enderecoReferencia',
  'enderecoBairro',
  'enderecoCidade',
  'observacoes',
  'documentacao',
  'marcacoes',
]);

const cidadesPorEstado: Record<string, string[]> = {
    RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Volta Redonda'],
    SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto'],
    MG: ['Belo Horizonte', 'Juiz de Fora', 'Uberlândia', 'Contagem'],
};

const fieldClassName =
  'h-11 w-full rounded-2xl border border-black bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:h-10 sm:px-4';

const compactFieldClassName =
  'h-10 w-full rounded-lg border border-black bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:h-9';

const textAreaClassName =
  'w-full rounded-2xl border border-black bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:px-4';

const compactTextAreaClassName =
  'w-full rounded-lg border border-black bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-4 focus:ring-black/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400';

const sectionCardClassName = 'rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:p-5';

const errorMessageClassName = 'mt-2 text-xs font-semibold text-red-600';
const documentInputAccept =
  '.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const maxVisibleDocumentsBeforeCarouselControls = 6;

const somenteDigitos = (valor: string): string => valor.replace(/\D/g, '');
  const somenteLetrasEEspacos = (valor: string): string => valor.replace(/[^A-Za-zÀ-ÿ\s]/g, '');

const normalizarTextoMaiusculo = (valor: string): string => valor.toLocaleUpperCase('pt-BR');

const formatarCep = (valor: string): string => {
  const digitos = somenteDigitos(valor).slice(0, 8);

  if (digitos.length <= 5) {
    return digitos;
  }

  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
};

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

const normalizarTelefoneImportado = (valor: string): string => {
  const digitos = somenteDigitos(valor);
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
};

const obterNumeroSemDdd = (digitos: string): string => (digitos.length > 10 ? digitos.slice(2) : digitos);

const obterTipoTelefoneImportado = (valor: string): string => {
  const numeroSemDdd = obterNumeroSemDdd(normalizarTelefoneImportado(valor));
  return numeroSemDdd.startsWith('9') ? 'Celular' : 'Residencial';
};

const obterPlaceholderComplementoContato = (tipo: string): string =>
  tipo === 'Celular' ? 'OUTRO' : tipo === 'E-mail' ? 'Outro / complemento' : 'COMPLEMENTO';

const obterTipoNovoContato = (totalAtual: number): string =>
  totalAtual === 0 ? 'Celular' : totalAtual === 1 ? 'E-mail' : 'Residencial';

const obterEmailImportadoValido = (valor?: string): string => {
  const email = (valor || '').trim();
  return email.includes('@') ? email : '';
};

const formatarNascimentoImportado = (valor?: string): string => {
  const nascimento = (valor || '').trim();
  const isoMatch = nascimento.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return nascimento ? formatarDataBR(nascimento) : '';
};

const formatarDataAtualBR = (): string => {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  return `${dia}/${mes}/${ano}`;
};

const obterExtensaoArquivo = (nome: string): string => {
  const partes = nome.split('.');
  return partes.length > 1 ? partes[partes.length - 1].toLowerCase() : '';
};

const obterTipoPreview = (arquivo: File): UploadedDocument['previewKind'] => {
  if (arquivo.type.startsWith('image/')) return 'image';
  if (arquivo.type === 'application/pdf' || obterExtensaoArquivo(arquivo.name) === 'pdf') return 'pdf';
  return 'document';
};

const formatarTamanhoArquivo = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const criarDocumentoAnexado = (arquivo: File): UploadedDocument => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  file: arquivo,
  name: arquivo.name,
  size: arquivo.size,
  mimeType: arquivo.type,
  extension: obterExtensaoArquivo(arquivo.name),
  previewUrl: URL.createObjectURL(arquivo),
  previewKind: obterTipoPreview(arquivo),
});

const obterExtensaoPorMimeType = (mimeType: string): string => {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('svg')) return 'svg';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'jpg';
};

const sanitizarNomeArquivo = (nome: string): string => {
  const nomeLimpo = nome.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return nomeLimpo || 'anuncio-importado.jpg';
};

const obterNomeArquivoImportado = (response: Response, anuncioUrl: URL, importedCode: string): string => {
  const headerFileName = response.headers.get('X-Imported-File-Name') || '';
  const pathFileName = anuncioUrl.pathname.split('/').filter(Boolean).pop() || '';
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const fallbackName = `anuncio-${importedCode || 'lead'}.${obterExtensaoPorMimeType(contentType)}`;
  const fileName = sanitizarNomeArquivo(headerFileName || pathFileName || fallbackName);

  return obterExtensaoArquivo(fileName) ? fileName : `${fileName}.${obterExtensaoPorMimeType(contentType)}`;
};

const importarDocumentoPorUrl = async (rawUrl: string, importedCode: string): Promise<UploadedDocument> => {
  const anuncioUrl = new URL(rawUrl, window.location.origin);
  const proxiedAssetUrl = `/api/import-lead-asset?url=${encodeURIComponent(anuncioUrl.toString())}`;
  const response = await fetch(proxiedAssetUrl);

  if (!response.ok) {
    throw new Error('Falha ao baixar o anuncio remoto.');
  }

  const blob = await response.blob();
  const fileName = obterNomeArquivoImportado(response, anuncioUrl, importedCode);
  const file = new File([blob], fileName, { type: blob.type || response.headers.get('content-type') || 'image/jpeg' });

  return criarDocumentoAnexado(file);
};

const revogarPreviews = (documentos: UploadedDocument[]) => {
  documentos.forEach((documento) => URL.revokeObjectURL(documento.previewUrl));
};

export const ClientRegistrationMultipage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [isClientFormEnabled, setIsClientFormEnabled] = useState(false);
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [selectedDocumentPreview, setSelectedDocumentPreview] = useState<UploadedDocument | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isImportedCodeLocked, setIsImportedCodeLocked] = useState(false);
  const [cepPopupMessage, setCepPopupMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorState>(initialFieldErrors);
  const [contactErrors, setContactErrors] = useState<ContactErrorState>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const uploadedDocumentsRef = useRef<UploadedDocument[]>([]);
  const lastCepLookupRef = useRef('');
  const enderecoNumeroInputRef = useRef<HTMLInputElement | null>(null);
  const documentFieldRefs = useRef<Record<DocumentFieldId, HTMLInputElement | null>>({
    cpf: null,
    rg: null,
    cnpj: null,
    dataNascimento: null,
  });

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const shouldShowDocumentCarouselControls =
    uploadedDocuments.length > maxVisibleDocumentsBeforeCarouselControls;
  const hasFormChanges = useMemo(
    () =>
      JSON.stringify(formState) !== JSON.stringify(initialFormState) ||
      JSON.stringify(contacts) !== JSON.stringify(initialContacts) ||
      uploadedDocuments.length > 0,
    [contacts, formState, uploadedDocuments.length],
  );
  const isClientFormLocked = !isClientFormEnabled;

  useEffect(() => {
    uploadedDocumentsRef.current = uploadedDocuments;
  }, [uploadedDocuments]);

  useEffect(() => {
    return () => {
      revogarPreviews(uploadedDocumentsRef.current);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDocumentPreview(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(() => {
      setFeedback('');
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!cepPopupMessage) return;

    const timeout = window.setTimeout(() => {
      setCepPopupMessage('');
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [cepPopupMessage]);

  const handleFieldChange = <K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) => {
    const nextValue =
      typeof value === 'string' && camposTextoMaiusculo.has(field)
        ? normalizarTextoMaiusculo(value)
        : value;

    setFormState((prev) => ({ ...prev, [field]: nextValue }));
  };

  const updateFieldError = (field: keyof FieldErrorState, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleCPFChange = (value: string) => {
    handleFieldChange('cpf', formatarCPF(value));
    updateFieldError('cpf', '');
  };

  const handleRGChange = (value: string) => {
    handleFieldChange('rg', formatarRG(value));
    updateFieldError('rg', '');
  };

  const handleCNPJChange = (value: string) => {
    handleFieldChange('cnpj', formatarCNPJ(value));
    updateFieldError('cnpj', '');
  };

  const handleDataNascimentoChange = (value: string) => {
    handleFieldChange('dataNascimento', formatarDataBR(value));
    updateFieldError('dataNascimento', '');
  };

  const handleDataCadastroChange = (value: string) => {
    handleFieldChange('dataCadastro', formatarDataBR(value));
  };

  const handleCepChange = (value: string) => {
    lastCepLookupRef.current = '';
    setFormState((prev) => ({
      ...prev,
      enderecoCep: formatarCep(value),
      enderecoRua: '',
      enderecoBairro: '',
      enderecoEstado: '',
      enderecoCidade: '',
    }));
  };

  const fetchAddressByCep = useCallback(async () => {
    const cepDigits = somenteDigitos(formState.enderecoCep);

    if (!cepDigits) {
      return;
    }

    if (cepDigits.length !== 8) {
      setCepPopupMessage('CEP invalido. Informe 8 numeros.');
      return;
    }

    if (lastCepLookupRef.current === cepDigits) {
      enderecoNumeroInputRef.current?.focus();
      return;
    }

    lastCepLookupRef.current = cepDigits;
    setIsFetchingCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);

      if (!response.ok) {
        throw new Error('Falha na consulta do CEP.');
      }

      const data = (await response.json()) as ViaCepResponse;

      if (data.erro) {
        lastCepLookupRef.current = '';
        setCepPopupMessage('CEP invalido.');
        return;
      }

      setFormState((prev) => ({
        ...prev,
        enderecoCep: formatarCep(data.cep || cepDigits),
        enderecoRua: normalizarTextoMaiusculo(data.logradouro || ''),
        enderecoBairro: normalizarTextoMaiusculo(data.bairro || ''),
        enderecoEstado: normalizarTextoMaiusculo(data.uf || ''),
        enderecoCidade: normalizarTextoMaiusculo(data.localidade || ''),
      }));
      setFeedback('Endereço preenchido pelo CEP.');
      window.setTimeout(() => enderecoNumeroInputRef.current?.focus(), 0);
    } catch (_error) {
      lastCepLookupRef.current = '';
      setCepPopupMessage('CEP invalido.');
    } finally {
      setIsFetchingCep(false);
    }
  }, [formState.enderecoCep]);

  const handleCepKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void fetchAddressByCep();
      return;
    }

    if (event.key === 'Tab') {
      void fetchAddressByCep();
    }
  };

  const validateCPFField = () => {
    if (!formState.cpf) {
      updateFieldError('cpf', '');
      return true;
    }
    const isValid = validarCPF(formState.cpf);
      updateFieldError('cpf', isValid ? '' : 'Informe um CPF válido.');
    return isValid;
  };

  const validateRGField = () => {
    if (!formState.rg) {
      updateFieldError('rg', '');
      return true;
    }
    const isValid = validarRG(formState.rg);
      updateFieldError('rg', isValid ? '' : 'Informe um RG válido.');
    return isValid;
  };

  const validateCNPJField = () => {
    if (!formState.cnpj) {
      updateFieldError('cnpj', '');
      return true;
    }
    const isValid = validarCNPJ(formState.cnpj);
      updateFieldError('cnpj', isValid ? '' : 'Informe um CNPJ válido.');
    return isValid;
  };

  const validateBirthDateField = () => {
    if (!formState.dataNascimento) {
      updateFieldError('dataNascimento', '');
      return true;
    }
    const isValid = validarDataNascimentoBR(formState.dataNascimento);
      updateFieldError('dataNascimento', isValid ? '' : 'Informe uma data de nascimento válida.');
    return isValid;
  };

  const focusDocumentField = (field: DocumentFieldId) => {
    setActiveTab('geral');
    window.setTimeout(() => documentFieldRefs.current[field]?.focus(), 0);
  };

  const keepFocusWhenInvalid = (field: DocumentFieldId, isValid: boolean) => {
    if (!isValid) {
      focusDocumentField(field);
    }
  };

  const handleCPFBlur = () => {
    keepFocusWhenInvalid('cpf', validateCPFField());
  };

  const handleRGBlur = () => {
    keepFocusWhenInvalid('rg', validateRGField());
  };

  const handleCNPJBlur = () => {
    keepFocusWhenInvalid('cnpj', validateCNPJField());
  };

  const handleBirthDateBlur = () => {
    keepFocusWhenInvalid('dataNascimento', validateBirthDateField());
  };

  const handleContactChange = (id: number, field: keyof ContactRow, value: string | boolean) => {
    const nextValue =
      typeof value === 'string' && (field === 'extra' || field === 'notes')
        ? normalizarTextoMaiusculo(value)
        : value;

    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, [field]: nextValue } : contact)),
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
    const nextValue =
      type === 'E-mail'
        ? normalizarTextoMaiusculo(value.trimStart())
        : formatarTelefoneContato(value, type);
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
    setContacts((prev) => {
      if (prev.length >= maxContactRows) {
        return prev;
      }

      return [
        ...prev,
        { id: Date.now(), type: obterTipoNovoContato(prev.length), value: '', extra: '', notes: '', favorite: false },
      ];
    });
  };

  const removeContact = (id: number) => {
    setContacts((prev) => (prev.length > 1 ? prev.filter((contact) => contact.id !== id) : prev));
  };

  const adicionarArquivos = (arquivos: FileList | File[]) => {
    if (isClientFormLocked) return;

    const listaArquivos = Array.from(arquivos);

    if (!listaArquivos.length) return;

    const novosDocumentos = listaArquivos.map<UploadedDocument>(criarDocumentoAnexado);

    setUploadedDocuments((prev) => [...prev, ...novosDocumentos]);
    setFeedback(`${novosDocumentos.length} arquivo(s) adicionado(s) à documentação.`);
  };

  const handleDocumentsSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isClientFormLocked) return;
    if (!event.target.files?.length) return;
    adicionarArquivos(event.target.files);
    event.target.value = '';
  };

  const handleDocumentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingDocuments(false);

    if (isClientFormLocked) return;
    if (!event.dataTransfer.files?.length) return;
    adicionarArquivos(event.dataTransfer.files);
  };

  const removeUploadedDocument = (id: number) => {
    setUploadedDocuments((prev) => {
      const documento = prev.find((item) => item.id === id);
      if (documento) URL.revokeObjectURL(documento.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const scrollDocumentsCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;

    const offset = direction === 'left' ? -260 : 260;
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const resetForm = useCallback(() => {
    revogarPreviews(uploadedDocumentsRef.current);
    setFormState(initialFormState);
    setContacts(initialContacts);
    setUploadedDocuments([]);
    setIsDraggingDocuments(false);
    setIsFetchingCep(false);
    setIsImportedCodeLocked(false);
    setCepPopupMessage('');
    setFieldErrors(initialFieldErrors);
    setContactErrors({});
    lastCepLookupRef.current = '';
    setActiveTab('geral');
    setFeedback('Novo cliente pronto para preenchimento.');
  }, []);

  const startNewClient = () => {
    resetForm();
    setIsClientFormEnabled(true);
  };

  const applyImportedLeadToNewClient = useCallback(
    async (leadData: SistemaQuerLeadData) => {
      const importedPhone = normalizarTelefoneImportado(leadData.telefone || '');
      const importedPhoneType = importedPhone ? obterTipoTelefoneImportado(importedPhone) : 'Celular';
      const importedEmail = obterEmailImportadoValido(leadData.email);
      const importedDocumentDigits = somenteDigitos(leadData.cpf_cnpj || '');
      const importedCode = somenteDigitos(leadData.indicacao_id || '').slice(0, 6);
      const anuncioUrl = (leadData.anuncio_url || '').trim();

      resetForm();
      setIsClientFormEnabled(true);
      setIsImportedCodeLocked(Boolean(importedCode));
      setActiveTab('geral');
      setFormState((prev) => ({
        ...prev,
        nome: normalizarTextoMaiusculo(somenteLetrasEEspacos(leadData.nome || '')),
        cpf: importedDocumentDigits.length === 11 ? formatarCPF(importedDocumentDigits) : '',
        cnpj: importedDocumentDigits.length === 14 ? formatarCNPJ(importedDocumentDigits) : '',
        dataNascimento: formatarNascimentoImportado(leadData.nascimento),
        enderecoRua: normalizarTextoMaiusculo(leadData.endereco || ''),
        enderecoNumero: normalizarTextoMaiusculo(leadData.numero || ''),
        enderecoBairro: normalizarTextoMaiusculo(leadData.bairro || ''),
        enderecoCidade: normalizarTextoMaiusculo(leadData.cidade || ''),
        enderecoEstado: normalizarTextoMaiusculo(leadData.estado || ''),
        observacoes: normalizarTextoMaiusculo(leadData.observacao || ''),
        codigo: importedCode || prev.codigo,
        dataCadastro: formatarDataAtualBR(),
      }));
      setContacts((prev) => {
        const nextContacts: ContactRow[] = [
          {
            ...prev[0],
            type: importedPhoneType,
            value: formatarTelefoneContato(importedPhone, importedPhoneType),
            extra: '',
          },
        ];

        if (importedEmail && nextContacts.length < maxContactRows) {
          nextContacts.push({
            id: Date.now(),
            type: 'E-mail',
            value: normalizarTextoMaiusculo(importedEmail),
            extra: '',
            notes: '',
            favorite: false,
          });
        }

        return nextContacts;
      });
      setFeedback('Dados importados aplicados ao novo cliente.');

      if (anuncioUrl) {
        setActiveTab('documentacao');
        setFeedback('Dados importados. Baixando anuncio para os arquivos anexados...');

        try {
          const novoDocumento = await importarDocumentoPorUrl(anuncioUrl, importedCode);
          setUploadedDocuments((prev) => [...prev, novoDocumento]);
          setFeedback('Dados importados e anuncio anexado com sucesso.');
        } catch (error) {
          console.error('Erro ao preparar miniatura do anuncio:', error);
          setFeedback('Dados importados, mas falha ao anexar o anuncio.');
        }
      }
    },
    [resetForm],
  );

  const saveClient = () => {
    if (isClientFormLocked) {
      setFeedback('Clique em Novo Cliente para liberar o preenchimento.');
      return;
    }

    const documentValidations: Array<[DocumentFieldId, boolean]> = [
      ['cpf', validateCPFField()],
      ['rg', validateRGField()],
      ['cnpj', validateCNPJField()],
      ['dataNascimento', validateBirthDateField()],
    ];
    const firstInvalidDocument = documentValidations.find(([, isValid]) => !isValid)?.[0];
    const areDocumentsValid = !firstInvalidDocument;
    contacts.forEach((contact) => validateContactValue(contact.id));

    const areContactsValid = contacts.every((contact) => {
      if (!contact.value) return true;
      if (contact.type === 'E-mail') return validarEmailRFC5322(contact.value);

      const totalDigitos = somenteDigitos(contact.value).length;
      const minimo = contact.type === 'Celular' ? 11 : 10;
      return totalDigitos === minimo;
    });

    if (!areDocumentsValid || !areContactsValid) {
      setFeedback('Corrija os campos destacados antes de salvar.');
      if (firstInvalidDocument) {
        focusDocumentField(firstInvalidDocument);
      }
      return;
    }

    setFeedback('Layout multipage de clientes validado. O próximo passo é persistir no PostgreSQL da Hostinger.');
  };

  const importClient = () => {
    setShowImportModal(true);
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

          <div className="grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={importClient}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-700/15 transition hover:bg-slate-800 sm:min-h-10"
            >
              <Upload size={18} />
              Importar
            </button>
            <button
              type="button"
              onClick={saveClient}
              disabled={isClientFormLocked || !hasFormChanges}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-50 disabled:shadow-none sm:min-h-10"
            >
              <Save size={18} />
              Salvar
            </button>
            <button
              type="button"
              onClick={startNewClient}
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

        {cepPopupMessage ? (
          <div
            role="alert"
            aria-live="assertive"
            className="fixed right-4 top-4 z-[70] w-[min(360px,calc(100vw-32px))] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-xl"
          >
            {cepPopupMessage}
          </div>
        ) : null}

        {isClientFormLocked ? (
          <div className="px-3 pt-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
              Clique em Novo Cliente para liberar o preenchimento das 4 abas.
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

      <fieldset disabled={isClientFormLocked} className="m-0 space-y-3 border-0 p-0">
        <section className={activeTab === 'geral' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-2.5 lg:grid-cols-[0.72fr_0.58fr_0.86fr_0.64fr]">
              <div className="lg:col-span-4">
                <label className="mb-1 block text-sm font-bold text-slate-700">Nome*</label>
                <input
                  className={fieldClassName}
                  value={formState.nome}
                  onChange={(event) => handleFieldChange('nome', somenteLetrasEEspacos(event.target.value))}
                  placeholder="Nome completo do cliente"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">CPF</label>
                <input
                  ref={(node) => {
                    documentFieldRefs.current.cpf = node;
                  }}
                  className={compactFieldClassName}
                  value={formState.cpf}
                  onChange={(event) => handleCPFChange(event.target.value)}
                  onBlur={handleCPFBlur}
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                />
                {fieldErrors.cpf ? <p className={errorMessageClassName}>{fieldErrors.cpf}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">RG</label>
                <input
                  ref={(node) => {
                    documentFieldRefs.current.rg = node;
                  }}
                  className={compactFieldClassName}
                  value={formState.rg}
                  onChange={(event) => handleRGChange(event.target.value)}
                  onBlur={handleRGBlur}
                  maxLength={10}
                  placeholder="00000000-0"
                />
                {fieldErrors.rg ? <p className={errorMessageClassName}>{fieldErrors.rg}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">CNPJ</label>
                <input
                  ref={(node) => {
                    documentFieldRefs.current.cnpj = node;
                  }}
                  className={compactFieldClassName}
                  value={formState.cnpj}
                  onChange={(event) => handleCNPJChange(event.target.value)}
                  onBlur={handleCNPJBlur}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                />
                {fieldErrors.cnpj ? <p className={errorMessageClassName}>{fieldErrors.cnpj}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Data de nascimento</label>
                <input
                  ref={(node) => {
                    documentFieldRefs.current.dataNascimento = node;
                  }}
                  className={compactFieldClassName}
                  value={formState.dataNascimento}
                  onChange={(event) => handleDataNascimentoChange(event.target.value)}
                  onBlur={handleBirthDateBlur}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="dd/mm/aaaa"
                />
                {fieldErrors.dataNascimento ? (
                  <p className={errorMessageClassName}>{fieldErrors.dataNascimento}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 sm:text-lg">Contatos*</h3>
                  <p className="text-xs font-semibold text-slate-500 sm:text-sm">Mantenha os canais principais sempre visíveis e tocáveis.</p>
                </div>
                <button
                  type="button"
                  onClick={addContact}
                  disabled={contacts.length >= maxContactRows}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#4e9bdd] px-4 py-2 text-sm font-black text-white shadow-lg shadow-[#4e9bdd]/20 transition hover:bg-[#377fbf] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusCircle size={18} />
                  Adicionar contato
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="hidden xl:grid xl:grid-cols-[0.9fr_1.15fr_1fr_1fr_auto] xl:gap-2 xl:border-b xl:border-slate-200 xl:bg-white xl:px-3 xl:py-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tipo</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Contato</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Complemento</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Observações</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ações</span>
                </div>

                {contacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className={`bg-white px-3 py-2 ${
                      index !== contacts.length - 1 ? 'border-b border-slate-200' : ''
                    }`}
                  >
                    <div className="grid gap-2 xl:grid-cols-[0.9fr_1.15fr_1fr_1fr_auto]">
                      <select
                        className={compactFieldClassName}
                        value={contact.type}
                        onChange={(event) => handleContactTypeChange(contact.id, event.target.value)}
                      >
                        <option>Celular</option>
                        <option>E-mail</option>
                        <option>Residencial</option>
                        <option>Comercial</option>
                      </select>

                      <input
                        className={compactFieldClassName}
                        value={contact.value}
                        onChange={(event) => handleContactValueChange(contact.id, contact.type, event.target.value)}
                        onBlur={() => validateContactValue(contact.id)}
                        inputMode={contact.type === 'E-mail' ? 'email' : 'numeric'}
                        maxLength={contact.type === 'Celular' ? 15 : contact.type === 'E-mail' ? 120 : 14}
                        placeholder={contact.type === 'E-mail' ? 'E-mail' : 'Número'}
                      />

                      <input
                        className={compactFieldClassName}
                        value={contact.extra}
                        onChange={(event) => handleContactChange(contact.id, 'extra', event.target.value)}
                        placeholder={obterPlaceholderComplementoContato(contact.type)}
                      />

                      <input
                        className={compactFieldClassName}
                        value={contact.notes}
                        onChange={(event) => handleContactChange(contact.id, 'notes', event.target.value)}
                        placeholder="Observações"
                      />

                      <div className="grid grid-cols-2 gap-2 sm:max-w-36 xl:max-w-none">
                        <button
                          type="button"
                          onClick={addContact}
                          disabled={contacts.length >= maxContactRows}
                          aria-label="Adicionar contato"
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition hover:bg-[#4e9bdd]/10 hover:text-[#2e6ea8] disabled:cursor-not-allowed disabled:opacity-35 sm:h-9"
                        >
                          <PlusCircle size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeContact(contact.id)}
                          aria-label="Remover contato"
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {contactErrors[contact.id] ? (
                      <p className={errorMessageClassName}>{contactErrors[contact.id]}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="grid gap-2.5 border-t border-slate-100 pt-3 xl:grid-cols-[minmax(0,1fr)_11.5rem]">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Observações</label>
                  <textarea
                    className={`${compactTextAreaClassName} min-h-24 resize-y`}
                    value={formState.observacoes}
                    onChange={(event) => handleFieldChange('observacoes', event.target.value)}
                    placeholder="Registre detalhes importantes sobre este cliente"
                  />
                </div>

                <div className="grid content-start gap-2.5">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Código</label>
                    <input
                      className={`${compactFieldClassName} bg-slate-100`}
                      value={formState.codigo}
                      onChange={(event) => handleFieldChange('codigo', somenteDigitos(event.target.value).slice(0, 6))}
                      disabled={isImportedCodeLocked}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Data de cadastro</label>
                    <input
                      className={compactFieldClassName}
                      value={formState.dataCadastro}
                      onChange={(event) => handleDataCadastroChange(event.target.value)}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                </div>
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
                  onChange={(event) => handleCepChange(event.target.value)}
                  onBlur={() => void fetchAddressByCep()}
                  onKeyDown={handleCepKeyDown}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                />
                <p className="mt-1.5 text-xs font-semibold text-slate-400">
                  {isFetchingCep ? 'Buscando CEP...' : 'Digite 8 números e pressione Enter ou Tab.'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Endereço</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoRua}
                  onChange={(event) => handleFieldChange('enderecoRua', event.target.value)}
                  disabled
                  placeholder="Rua, avenida ou logradouro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Número</label>
                <input
                  ref={enderecoNumeroInputRef}
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
                  disabled
                  placeholder="Bairro"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Cidade</label>
                <input
                  className={fieldClassName}
                  value={formState.enderecoCidade}
                  onChange={(event) => handleFieldChange('enderecoCidade', event.target.value)}
                  disabled
                  placeholder="Cidade"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Estado</label>
                <select
                  className={fieldClassName}
                  value={formState.enderecoEstado}
                  disabled
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
            </div>
          </div>
        </section>

        <section className={activeTab === 'extras' ? 'block' : 'hidden'}>
          <div className={sectionCardClassName}>
            <div className="grid gap-3">
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
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 ${
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
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 ${
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

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'ATIVO')}
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 ${
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
                      className={`min-h-11 rounded-2xl border px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 ${
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
            <div className="grid gap-2">
              <div className="grid gap-2.5 xl:grid-cols-[1.05fr_0.95fr]">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (isClientFormLocked) return;
                    setIsDraggingDocuments(true);
                  }}
                  onDragLeave={() => setIsDraggingDocuments(false)}
                  onDrop={handleDocumentDrop}
                  className={`rounded-[28px] border-2 border-dashed px-4 py-3.5 text-center transition sm:px-5 xl:h-full ${
                    isClientFormLocked
                      ? 'border-slate-200 bg-slate-100 opacity-70'
                      : isDraggingDocuments
                      ? 'border-[#3d8ed8] bg-[#3d8ed8]/5'
                      : 'border-slate-300 bg-slate-50/80 hover:border-[#3d8ed8]/50 hover:bg-[#3d8ed8]/[0.03]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={documentInputAccept}
                    onChange={handleDocumentsSelected}
                    className="hidden"
                  />

                  <div className="mx-auto flex max-w-2xl flex-col items-center gap-2.5 xl:justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#3d8ed8] shadow-sm">
                      <Upload size={22} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900">Arraste e solte os arquivos aqui</h3>
                      <p className="text-sm leading-5 text-slate-500">
                        {isClientFormLocked
                          ? 'Clique em Novo Cliente antes de anexar arquivos.'
                          : 'Aceita imagens, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT e CSV.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[#0c1826] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#16273b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <PlusCircle size={18} />
                      Selecionar arquivos
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">Documentação</label>
                  <textarea
                    className={`${textAreaClassName} min-h-24 resize-y xl:min-h-[188px]`}
                    value={formState.documentacao}
                    onChange={(event) => handleFieldChange('documentacao', event.target.value)}
                    placeholder="Registre documentos, anexos, números de apólice, vencimentos e observações importantes"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Arquivos anexados</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {uploadedDocuments.length
                        ? 'Deslize para visualizar as miniaturas dos arquivos adicionados.'
                        : 'As miniaturas vão aparecer aqui conforme vãocê anexar arquivãos.'}
                    </p>
                  </div>

                  {shouldShowDocumentCarouselControls ? (
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button
                        type="button"
                        onClick={() => scrollDocumentsCarousel('left')}
                        className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollDocumentsCarousel('right')}
                        className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {uploadedDocuments.length ? (
                  <div className={`mt-2.5 ${shouldShowDocumentCarouselControls ? 'xl:max-w-[1140px]' : ''}`}>
                    <div
                      ref={carouselRef}
                      className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {uploadedDocuments.map((documento) => (
                        <article
                          key={documento.id}
                          onClick={() => setSelectedDocumentPreview(documento)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedDocumentPreview(documento);
                            }
                          }}
                          className="min-w-[176px] max-w-[176px] snap-start rounded-[22px] border border-slate-200 bg-white shadow-sm xl:min-w-[184px] xl:max-w-[184px]"
                        >
                          <div className="relative h-24 overflow-hidden rounded-t-[22px] bg-slate-100 xl:h-28">
                            {documento.previewKind === 'image' ? (
                              <img
                                src={documento.previewUrl}
                                alt={documento.name}
                                className="h-full w-full object-cover"
                              />
                            ) : documento.previewKind === 'pdf' ? (
                              <iframe
                                title={documento.name}
                                src={`${documento.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="h-full w-full border-0"
                              />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                                {documento.mimeType.startsWith('image/') ? (
                                  <FileImage size={30} className="text-[#3d8ed8]" />
                                ) : documento.extension === 'pdf' ? (
                                  <FileText size={30} className="text-[#ef6b74]" />
                                ) : (
                                  <File size={30} className="text-[#3d8ed8]" />
                                )}
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                    {documento.extension || 'arquivo'}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">
                                    Pré-visualização disponível após download
                                  </p>
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeUploadedDocument(documento.id);
                              }}
                              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Remover ${documento.name}`}
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="space-y-1.5 p-2.5">
                            <p className="truncate text-sm font-bold text-slate-800">{documento.name}</p>
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                              <span className="truncate uppercase">{documento.extension || 'arquivo'}</span>
                              <span>{formatarTamanhoArquivo(documento.size)}</span>
                            </div>
                            <p className="text-xs font-semibold text-[#3d8ed8]">Clique para ampliar</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400">
                    Nenhum arquivo anexado ainda.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </fieldset>

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Etapa {activeTabIndex + 1} de {tabs.length}. Todas as telas do multipage estão prontas para navegaçãoo.
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

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm transition-all duration-200 ${
          selectedDocumentPreview ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSelectedDocumentPreview(null)}
      >
        <div
          className={`w-full max-w-6xl rounded-[32px] bg-white shadow-2xl transition-all duration-200 ${
            selectedDocumentPreview ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {selectedDocumentPreview ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900">{selectedDocumentPreview.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {selectedDocumentPreview.extension || 'arquivo'} . {formatarTamanhoArquivo(selectedDocumentPreview.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDocumentPreview(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:text-slate-900"
                  aria-label="Fechar visualização"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-auto p-3 sm:p-5">
                {selectedDocumentPreview.previewKind === 'image' ? (
                  <div className="overflow-hidden rounded-[24px] bg-slate-100">
                    <img
                      src={selectedDocumentPreview.previewUrl}
                      alt={selectedDocumentPreview.name}
                      className="max-h-[72vh] w-full object-contain"
                    />
                  </div>
                ) : selectedDocumentPreview.previewKind === 'pdf' ? (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200">
                    <iframe
                      title={selectedDocumentPreview.name}
                      src={selectedDocumentPreview.previewUrl}
                      className="h-[72vh] w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                    <File size={44} className="text-[#3d8ed8]" />
                    <p className="mt-4 text-lg font-black text-slate-900">{selectedDocumentPreview.name}</p>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                      Este formato não tem leitura embutida na tela. Você ainda pode abrir o arquivo em uma nova aba para visualizar o conteúdo completo.
                    </p>
                    <a
                      href={selectedDocumentPreview.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0c1826] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#16273b]"
                    >
                      Abrir arquivo
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <SistemaQuerImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onUseLeadData={applyImportedLeadToNewClient}
      />
    </section>
  );
};
