import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  User,
  Users,
} from 'lucide-react';

export type SistemaQuerLeadData = {
  nome?: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  nascimento?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacao?: string;
  vidas?: Record<string, string>;
  indicacao_id?: string;
  anuncio_url?: string;
};

type ImportResult = {
  type: 'success' | 'error';
  message: string;
  data?: SistemaQuerLeadData;
} | null;

type SistemaQuerImportModalProps = {
  open: boolean;
  initialLeadUrl?: string;
  onClose: () => void;
  onUseLeadData?: (data: SistemaQuerLeadData) => void;
};

const SISTEMA_QUER_INDICATION_URL = 'http://sistemaquer.com.br/alterar-indicacao.php?indicacao_id=';
const indicationIdPattern = /^\d{6}$/;

const extractIndicationId = (value: string): string => {
  const queryValue = value.match(/[?&]indicacao_id=(\d{1,6})/)?.[1];
  const rawValue = queryValue || value;
  return rawValue.replace(/\D/g, '').slice(0, 6);
};

export const SistemaQuerImportModal: React.FC<SistemaQuerImportModalProps> = ({
  open,
  initialLeadUrl = '',
  onClose,
  onUseLeadData,
}) => {
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult>(null);
  const [expandedAdImageUrl, setExpandedAdImageUrl] = useState('');
  const [adImageUnavailable, setAdImageUnavailable] = useState(false);
  const indicationIdInputRef = useRef<HTMLInputElement | null>(null);
  const [credential, setCredential] = useState({
    login: 'Rosilene Rodrigues de Carvalho Molina',
    senha: '123',
    indicationId: extractIndicationId(initialLeadUrl),
  });
  const isIndicationIdReady = indicationIdPattern.test(credential.indicationId);
  const adImageUrl = importResult?.data?.anuncio_url || '';

  useEffect(() => {
    if (!open) return;

    setImportResult(null);
    setAdImageUnavailable(false);
    setCredential((prev) => ({ ...prev, indicationId: extractIndicationId(initialLeadUrl) }));

    const focusTimeout = window.setTimeout(() => {
      indicationIdInputRef.current?.focus();
      indicationIdInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [initialLeadUrl, open]);

  if (!open) return null;

  const closeModal = () => {
    setImportResult(null);
    setExpandedAdImageUrl('');
    setAdImageUnavailable(false);
    onClose();
  };

  const handleImportLead = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isIndicationIdReady) {
      setImportResult({
        type: 'error',
        message: 'Informe exatamente 6 números da indicação.',
      });
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    setAdImageUnavailable(false);

    try {
      const leadUrl = `${SISTEMA_QUER_INDICATION_URL}${credential.indicationId}`;
      const response = await fetch('/api/import-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: credential.login,
          senha: credential.senha,
          leadUrl,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setImportResult({
          type: 'success',
          message: 'Lead importada com sucesso!',
          data: data.data,
        });
      } else {
        setImportResult({
          type: 'error',
          message: data.error || 'Erro ao importar',
        });
      }
    } catch (_error) {
      setImportResult({
        type: 'error',
        message: 'Erro de conexão com o servidor',
      });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex flex-shrink-0 items-center justify-between bg-[#0c1826] p-4">
          <h3 className="flex items-center gap-2 font-bold text-[#b58c2a]">
            <ExternalLink size={20} />
            Importar do Sistema Quer
          </h3>
          <button
            type="button"
            onClick={closeModal}
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
                  disabled
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#b58c2a] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  value={credential.login}
                  onChange={(event) => setCredential({ ...credential, login: event.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-700">Senha</label>
                <input
                  type="password"
                  required
                  disabled
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#b58c2a] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  value={credential.senha}
                  onChange={(event) => setCredential({ ...credential, senha: event.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                  URL da Indicação (Link)
                </label>
                <input
                  ref={indicationIdInputRef}
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="Digite os 6 números da indicação"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm italic outline-none transition-colors focus:border-[#b58c2a]"
                  value={credential.indicationId}
                  onChange={(event) =>
                    setCredential({
                      ...credential,
                      indicationId: event.target.value.replace(/\D/g, '').slice(0, 6),
                    })
                  }
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Aceita somente 6 dígitos. Zeros à esquerda serão preservados.
                </p>
              </div>

              {importResult?.type === 'error' ? (
                <div className="rounded border border-red-100 bg-red-50 p-3 text-xs text-red-600">
                  {importResult.message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={importLoading || !isIndicationIdReady}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#b58c2a] py-3 font-bold text-white shadow-lg transition-all hover:bg-[#806117] disabled:opacity-50"
              >
                {importLoading ? <Loader2 className="animate-spin" size={18} /> : 'IMPORTAR AGORA'}
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
                <div className="grid gap-4 p-4 md:grid-cols-[1fr_1fr_168px]">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Nome</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.nome}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Telefone</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.telefone}</p>
                  </div>
                  <div className="row-span-3">
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Anúncio</label>
                    {adImageUrl && !adImageUnavailable ? (
                      <button
                        type="button"
                        onClick={() => setExpandedAdImageUrl(adImageUrl)}
                        className="mt-1 flex h-32 w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 transition hover:border-[#b58c2a] hover:shadow-sm"
                      >
                        <img
                          src={adImageUrl}
                          alt={`Anúncio ${importResult.data.indicacao_id || ''}`}
                          className="h-full w-full object-cover"
                          onError={() => setAdImageUnavailable(true)}
                        />
                      </button>
                    ) : (
                      <div className="mt-1 flex h-32 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 px-3 text-center text-xs text-gray-400">
                        Thumbnail do anúncio não encontrado.
                      </div>
                    )}
                    {adImageUrl && !adImageUnavailable ? (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#b58c2a]">
                        Clique para ampliar
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">E-mail</label>
                    <p className="break-all text-sm font-medium text-gray-800">{importResult.data.email}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">CPF/CNPJ</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.cpf_cnpj || '---'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Data Nascimento</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.nascimento || '---'}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <MapPin size={16} className="text-[#b58c2a]" />
                  <span className="text-xs font-bold uppercase text-gray-700">Localização</span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Endereço</label>
                    <p className="text-sm font-medium text-gray-800">
                      {importResult.data.endereco} {importResult.data.numero ? `, ${importResult.data.numero}` : ''}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Bairro</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.bairro || '---'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">Cidade</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.cidade || '---'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400">UF</label>
                    <p className="text-sm font-medium text-gray-800">{importResult.data.estado || '---'}</p>
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
                    {importResult.data.observacao || 'Nenhuma observação encontrada.'}
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
                  {Object.entries(importResult.data.vidas || {}).map(([faixa, qtd]) => (
                    <div key={faixa} className="rounded border border-gray-100 bg-gray-50 p-2 text-center">
                      <label className="mb-1 block text-[9px] uppercase leading-none text-gray-400">
                        {faixa}
                      </label>
                      <span className={`${qtd !== '0' ? 'font-bold text-[#b58c2a]' : 'text-gray-300'} text-sm`}>
                        {String(qtd)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (importResult.data) {
                    onUseLeadData?.({
                      ...importResult.data,
                      indicacao_id: importResult.data.indicacao_id || credential.indicationId,
                    });
                  }
                  closeModal();
                }}
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

      {expandedAdImageUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setExpandedAdImageUrl('')}
        >
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpandedAdImageUrl('');
              }}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded bg-white/95 text-lg font-black text-gray-700 shadow-lg transition hover:bg-white hover:text-red-600"
              aria-label="Fechar anúncio ampliado"
            >
              X
            </button>
            <img
              src={expandedAdImageUrl}
              alt="Anúncio ampliado"
              className="max-h-[90vh] w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
