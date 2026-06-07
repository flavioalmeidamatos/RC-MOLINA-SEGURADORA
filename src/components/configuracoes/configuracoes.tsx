import React, { useState, useEffect, useRef } from "react";
import { Scan as ScannerIcon, Download, Loader2, Network, X, Table, FileSpreadsheet } from "lucide-react";
import Tesseract from 'tesseract.js';
import * as XLSX from 'xlsx';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: any) => void;
        addEventListener: (type: string, listener: (event: any) => void) => void;
        removeEventListener: (type: string, listener: (event: any) => void) => void;
      };
    };
  }
}

export const Configuracoes: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [scanners, setScanners] = useState<string[]>([]);
  const [selectedScanner, setSelectedScanner] = useState<string>("");
  const [useIpScanner, setUseIpScanner] = useState<boolean>(false);
  const [scannerIp, setScannerIp] = useState<string>("");
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<Array<{nome: string, celular: string, importado: string}>>([]);

  useEffect(() => {
    const handleMessage = (event: any) => {
      try {
        if (event.data) {
          const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (payload.action === "scanner_list_result") {
            setScanners(payload.scanners || []);
            if (payload.scanners && payload.scanners.length > 0) {
              setSelectedScanner(payload.scanners[0]);
            }
            if (payload.error) {
              alert("Erro ao buscar scanners: " + payload.error);
            }
            setIsSearching(false);
          } else if (payload.action === "scanner_scan_result") {
            if (payload.success) {
              setScannedImage(payload.image);
            } else {
              alert("Erro ao escanear: " + payload.error);
            }
            setIsScanning(false);
          }
        }
      } catch (err) {
        console.error("Erro ao fazer parse da mensagem do WebView2", err);
      }
    };

    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener("message", handleMessage);
    }

    return () => {
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.removeEventListener("message", handleMessage);
      }
    };
  }, []);

  const buscarScanners = async () => {
    setIsSearching(true);
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ action: "list_scanners" }));
    } else {
      // Mocking fallback
      setTimeout(() => {
        setScanners([
          "Scanner Local (Mock)",
          "Epson L3150 (Mock)",
        ]);
        setSelectedScanner("Scanner Local (Mock)");
        setIsSearching(false);
      }, 1500);
    }
  };

  useEffect(() => {
    if (scannedImage) {
      processOcr(scannedImage);
    }
  }, [scannedImage]);

  const processOcr = async (imageBase64: string) => {
    setIsOcrProcessing(true);
    setOcrStatus('Iniciando reconhecimento de texto...');
    setOcrProgress(0);

    try {
      const worker = await Tesseract.createWorker('por', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStatus('Extraindo texto...');
            setOcrProgress(Math.round(m.progress * 100));
          } else {
            setOcrStatus(m.status);
          }
        }
      });

      const { data: { text } } = await worker.recognize(imageBase64);
      await worker.terminate();
      
      parseOcrText(text);

    } catch (error) {
      console.error("Erro no OCR:", error);
      setOcrStatus('Erro na leitura de texto');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const parseOcrText = (text: string) => {
    const lines = text.split('\n');
    const data: Array<{nome: string, celular: string, importado: string}> = [];
    
    // Expressão regular para remover a marca VMC e variações
    const patternVmc = /VMC\s*Multimarcas(\s*Form\.?Inst\.?)?/gi;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 1. Remover a assinatura da VMC
      line = line.replace(patternVmc, '');

      // 2. Limpar caracteres indesejados (hífen, colchetes, chaves, parênteses, underscore)
      line = line.replace(/[-\[\](){}_]/g, ' ');

      // 3. Limpar múltiplos espaços
      line = line.replace(/\s+/g, ' ').trim();

      if (!line) continue;

      // 4. Capturar número (8 dígitos ou mais) que esteja no final da linha
      const match = line.match(/(.*?)\s+(\d{8,})$/);
      let nome = '';
      let celular = '';

      if (match) {
        nome = match[1].trim();
        celular = match[2].trim();
      } else {
        nome = line.trim();
        celular = '';
      }

      // 5. Se o nome contiver números soltos, remove-os e os adiciona ao celular
      const numerosNome = nome.match(/\d+/g);
      if (numerosNome) {
        celular = (celular + numerosNome.join('')).trim();
        nome = nome.replace(/\d+/g, '').trim();
      }

      // 6. Limpar novamente múltiplos espaços no nome gerados pela limpeza
      nome = nome.replace(/\s+/g, ' ').trim();

      // Salva apenas se sobrou nome ou celular válido
      if (nome || celular) {
        data.push({ nome, celular, importado: '' });
      }
    }

    setExtractedData(data);
    setOcrStatus('Extração concluída com sucesso!');
  };

  const downloadExcel = () => {
    const wsData = [
      ["Nome", "Celular", "Importado"],
      ...extractedData.map(d => [d.nome, d.celular, d.importado])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contatos");
    XLSX.writeFile(wb, "contatos_vmcmultimarcas_final.xlsx");
  };

  const escanearDocumento = () => {
    if ((!useIpScanner && !selectedScanner) || (useIpScanner && !scannerIp)) return;
    setIsScanning(true);
    
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ 
        action: "scan_document",
        useIp: useIpScanner,
        scannerId: useIpScanner ? scannerIp : selectedScanner
      }));
    } else {
      // Mocking fallback
      setTimeout(() => {
        setScannedImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        setIsScanning(false);
      }, 3000);
    }
  };

  const salvarImagem = () => {
    if (!scannedImage) return;
    const link = document.createElement("a");
    link.href = scannedImage;
    link.download = `documento_escaneado_${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#0c1826] p-6 text-white shrink-0 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
            <ScannerIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Configurações do Sistema</h1>
            <p className="text-xs font-medium text-white/50 mt-1">
              Gerencie opções de hardware e integrações locais
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="mb-8 border-b border-slate-100 pb-4 flex justify-between items-end">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Digitalização de Documentos</h2>
              <p className="text-sm text-slate-500 mt-1">
                Busque scanners locais (WIA) ou configure um IP para digitalizar diretamente para o sistema.
              </p>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-[#b58c2a] focus:ring-[#b58c2a]"
                checked={useIpScanner}
                onChange={(e) => setUseIpScanner(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                <Network size={16} className="text-slate-500"/>
                Scanner de Rede (IP)
              </span>
            </label>
          </div>

          <div className="space-y-6">
            {!useIpScanner ? (
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Scanner Local (WIA)
                  </label>
                  <select
                    value={selectedScanner}
                    onChange={(e) => setSelectedScanner(e.target.value)}
                    disabled={scanners.length === 0 || isSearching || isScanning}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-black outline-none transition-all focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a] disabled:opacity-60"
                  >
                    {scanners.length === 0 ? (
                      <option value="">Nenhum scanner encontrado (Clique em Buscar)</option>
                    ) : (
                      scanners.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={buscarScanners}
                  disabled={isSearching || isScanning}
                  className="flex h-[42px] items-center gap-2 rounded-xl bg-[#0c1826] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1a2e44] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <ScannerIcon size={16} />}
                  Buscar Scanners
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Endereço IP do Scanner
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 192.168.1.100"
                    value={scannerIp}
                    onChange={(e) => setScannerIp(e.target.value)}
                    disabled={isScanning}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-black outline-none transition-all focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a] disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={escanearDocumento}
                disabled={(!useIpScanner && !selectedScanner) || (useIpScanner && !scannerIp) || isScanning}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#b58c2a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#a27d25] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isScanning ? <Loader2 size={16} className="animate-spin" /> : <ScannerIcon size={16} />}
                Escanear Documento
              </button>

              {scannedImage && (
                <button
                  type="button"
                  onClick={salvarImagem}
                  className="flex h-11 items-center gap-2 rounded-xl border border-[#b58c2a] bg-transparent px-5 text-sm font-semibold text-[#b58c2a] transition-colors hover:bg-[#b58c2a]/10"
                >
                  <Download size={16} />
                  Salvar Imagem
                </button>
              )}
            </div>

            {(isScanning || scannedImage) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* Coluna 1: Preview do Scanner */}
                <div className="flex flex-col gap-4">
                  {isScanning && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Digitalizando Documento...
                      </p>
                      <div className="relative flex justify-center bg-white border border-slate-200 shadow-sm rounded-lg p-2 mx-auto overflow-hidden aspect-[210/297] max-h-[40vh]">
                        <style>{`
                          @keyframes scanLaser {
                            0% { top: 0%; }
                            50% { top: 100%; }
                            100% { top: 0%; }
                          }
                          .animate-laser {
                            animation: scanLaser 3s linear infinite;
                          }
                        `}</style>
                        {/* Placeholder de papel */}
                        <div className="w-full h-full bg-slate-50/50 flex flex-col gap-4 p-8 opacity-30 mx-auto">
                          <div className="w-3/4 h-3 bg-slate-300 rounded"></div>
                          <div className="w-full h-3 bg-slate-300 rounded"></div>
                          <div className="w-5/6 h-3 bg-slate-300 rounded"></div>
                          <div className="w-full h-3 bg-slate-300 rounded"></div>
                          <div className="w-2/4 h-3 bg-slate-300 rounded mt-4"></div>
                        </div>
                        
                        {/* Feixe de luz verde */}
                        <div className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_20px_5px_rgba(34,197,94,0.6)] animate-laser z-10" />
                        {/* Rastro do laser */}
                        <div className="absolute left-0 right-0 h-32 bg-gradient-to-t from-green-500/20 to-transparent animate-laser z-0" style={{ marginTop: '-8rem' }} />
                      </div>
                    </div>
                  )}

                  {scannedImage && !isScanning && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Preview da Digitalização
                      </p>
                      <div className="flex justify-center bg-white border border-slate-200 shadow-sm rounded-lg p-2 mx-auto aspect-[210/297] max-h-[40vh]">
                        <img
                          src={scannedImage}
                          alt="Documento escaneado"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna 2: Dados Tratados (OCR + Excel) */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col h-full min-h-[40vh]">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Table size={14} />
                        Dados Extraídos (Excel)
                      </p>
                      {extractedData.length > 0 && !isOcrProcessing && (
                        <button
                          onClick={downloadExcel}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <FileSpreadsheet size={14} />
                          Baixar Planilha
                        </button>
                      )}
                    </div>

                    {isOcrProcessing ? (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 size={32} className="animate-spin text-[#b58c2a] mb-4" />
                        <p className="text-sm font-semibold text-slate-700">{ocrStatus}</p>
                        <div className="w-48 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
                          <div 
                            className="h-full bg-[#b58c2a] transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">{ocrProgress}%</p>
                      </div>
                    ) : extractedData.length > 0 ? (
                      <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white max-h-[40vh]">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                          <thead className="bg-slate-100 sticky top-0 text-slate-600 text-xs uppercase shadow-sm">
                            <tr>
                              <th className="px-4 py-3 font-semibold border-b border-slate-200">Nome</th>
                              <th className="px-4 py-3 font-semibold border-b border-slate-200">Celular</th>
                              <th className="px-4 py-3 font-semibold border-b border-slate-200">Importado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extractedData.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 text-slate-700">{row.nome}</td>
                                <td className="px-4 py-2 text-slate-600 font-mono text-xs">{row.celular}</td>
                                <td className="px-4 py-2"></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                        <FileSpreadsheet size={32} className="text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">
                          {isScanning ? "Aguardando imagem para iniciar leitura..." : "Nenhum dado extraído ainda."}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          A extração começará automaticamente após a digitalização.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
