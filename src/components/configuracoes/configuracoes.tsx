import React, { useState, useEffect, useRef } from "react";
import { Scan as ScannerIcon, Download, Loader2, Network, X, Table, FileSpreadsheet, UploadCloud } from "lucide-react";
import Tesseract from 'tesseract.js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
  const [showWarningPopup, setShowWarningPopup] = useState<boolean>(false);
  const [showScannerOffPopup, setShowScannerOffPopup] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState<{ total: number, imported: number, rejected: number } | null>(null);

  useEffect(() => {
    const handleMessage = (event: any) => {
      try {
        if (event.data) {
          const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (payload.action === "scanner_list_result") {
            setScanners(payload.scanners || []);
            if (payload.error || !payload.scanners || payload.scanners.length === 0) {
              setShowScannerOffPopup(true);
              setTimeout(() => setShowScannerOffPopup(false), 5000);
            } else {
              setScanners(payload.scanners);
              setSelectedScanner(payload.scanners[0]);
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
        // setScanners([
        //   "Scanner Local (Mock)",
        //   "Epson L3150 (Mock)",
        // ]);
        // setSelectedScanner("Scanner Local (Mock)");
        setScanners([]);
        setShowScannerOffPopup(true);
        setTimeout(() => setShowScannerOffPopup(false), 5000);
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

      // 2. Extrair APENAS letras (e espaços) para formar o nome
      // O campo nome deve conter SOMENTE caracteres alfabéticos (incluindo acentos) e espaços
      let nome = line.replace(/[^a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '');
      nome = nome.replace(/\s+/g, ' ').trim().toUpperCase();

      // 3. Extrair APENAS números e a barra '/' para formar os telefones.
      // A regex /[^\d/]/g remove tudo que não for dígito ou barra (ex: espaços, hifens, parênteses)
      let telefonesStr = line.replace(/[^\d/]/g, '');

      // 4. Separar pelos caracteres de barra '/' para o caso de múltiplos números na mesma linha
      let telefones = telefonesStr.split('/').filter(t => t.length > 0);

      const importadoText = nome ? `${nome} - REMALHO` : '';

      // 5. Adicionar à tabela
      if (telefones.length === 0) {
        // Se não tem telefone, mas tem nome
        if (nome) {
          data.push({ nome, celular: '', importado: importadoText });
        }
      } else {
        // Se tem telefones, cria uma linha para cada um mantendo o mesmo nome
        telefones.forEach(celular => {
          if (nome || celular) {
            data.push({ nome, celular: `+55${celular}`, importado: importadoText });
          }
        });
      }
    }

    setExtractedData(data);
    setOcrStatus('Extração concluída com sucesso!');

    const hasInvalidNumbers = data.some(d => d.celular.length > 0 && d.celular.replace('+55', '').length < 11);
    if (hasInvalidNumbers) {
      setShowWarningPopup(true);
      setTimeout(() => setShowWarningPopup(false), 10000);
    }
  };

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contatos');

    // Definir colunas com auto-fit
    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 45 },
      { header: 'Celular', key: 'celular', width: 25 },
      { header: 'Importado', key: 'importado', width: 15 }
    ];

    // Estilizar cabeçalho
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Adicionar e estilizar linhas
    extractedData.forEach((row, index) => {
      const addedRow = worksheet.addRow({
        nome: row.nome,
        celular: row.celular,
        importado: row.importado
      });

      const isZebra = index % 2 === 0;
      const fgColor = isZebra ? 'FFFFFFFF' : 'FFF2F2F2';

      addedRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fgColor }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        if (colNumber === 2 && row.celular.length > 0 && row.celular.replace('+55', '').length < 11) {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else {
          cell.font = { color: { argb: 'FF000000' } };
        }
      });
    });

    // Ajustar largura das colunas (Auto-fit)
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      if (column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'REMALHO.XLSX');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const downloadRejectedExcel = async (rejectedContacts: any[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Problemas');

    worksheet.columns = [
      { header: 'Nome Original (Importado)', key: 'name', width: 45 },
      { header: 'Celular', key: 'phone', width: 25 },
      { header: 'Motivo', key: 'reason', width: 45 }
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    rejectedContacts.forEach((contact, index) => {
      const addedRow = worksheet.addRow({
        name: contact.name,
        phone: contact.phone,
        reason: contact.reason
      });

      const isZebra = index % 2 === 0;
      const fgColor = isZebra ? 'FFFFFFFF' : 'FFF2F2F2';

      addedRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fgColor }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      if (column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'REMALHO_PROBLEMATICO.XLSX');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);
      
      const contactsToImport: { name: string, phone: string }[] = [];

      if (worksheet) {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { 
            const importado = row.getCell(3).text?.trim(); 
            const celular = row.getCell(2).text?.trim();   
            
            if (importado) {
               contactsToImport.push({
                 name: importado,
                 phone: celular || ''
               });
            }
          }
        });
      }

      if (contactsToImport.length === 0) {
        alert("Nenhum dado válido encontrado na planilha.");
        setIsImporting(false);
        return;
      }

      const chunkSize = 50;
      let totalImported = 0;
      let allRejected = [];
      let hasScopeError = false;
      let hasConnectionError = false;
      let lastErrorMsg = "";

      setImportProgress(0);

      for (let i = 0; i < contactsToImport.length; i += chunkSize) {
        const chunk = contactsToImport.slice(i, i + chunkSize);
        const response = await fetch('/api/gmail/import-contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: chunk })
        });

        let result;
        try {
          result = await response.json();
        } catch (e) {
          throw new Error(`Timeout ou erro no servidor (Status ${response.status}). O lote foi muito grande ou o servidor falhou.`);
        }
        
        if (response.ok && result.success) {
          totalImported += result.importedCount || 0;
          if (result.rejectedContacts) {
             allRejected = allRejected.concat(result.rejectedContacts);
          }
        } else {
          if (result.error === 'Conta Gmail nao conectada.' || result.code === 'gmail_account_not_connected') {
             hasConnectionError = true;
          } else if (result.error && result.error.includes("insufficient_scope")) {
             hasScopeError = true;
          } else {
             lastErrorMsg = result.error || "Erro desconhecido.";
          }
          break; // Stop processing further chunks on error
        }
        
        const progress = Math.min(100, Math.round(((i + chunk.length) / contactsToImport.length) * 100));
        setImportProgress(progress);
      }

      if (hasConnectionError) {
         alert("Por favor, conecte ou reconecte seu Gmail na tela de e-mails para autorizar o Google Contatos.");
      } else if (hasScopeError) {
         alert("O sistema requer uma nova permissão (Contatos) no seu Gmail. Por favor, desconecte e conecte o Gmail novamente.");
      } else if (lastErrorMsg) {
         alert("Erro na importação: " + lastErrorMsg);
      } else {
        setImportStats({
          total: contactsToImport.length,
          imported: totalImported,
          rejected: allRejected.length
        });

        if (allRejected.length > 0) {
           await downloadRejectedExcel(allRejected);
        }
      }
    } catch (err: any) {
      alert("Falha ao processar arquivo: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 whitespace-nowrap">
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

              <input 
                type="file" 
                accept=".xlsx" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="relative flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-5 text-sm font-semibold text-white transition-all hover:bg-[#006cbd] disabled:opacity-90 disabled:cursor-not-allowed ml-auto overflow-hidden min-w-[280px]"
                >
                  {isImporting && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-[#004e8c] transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isImporting ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {isImporting ? `Importando... ${importProgress}%` : 'Importar Contatos para Conta Outlook'}
                  </span>
                </button>
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
                      <div className="flex-1 overflow-auto border-2 border-black rounded-lg bg-white max-h-[40vh]">
                        <table className="w-full text-sm text-left whitespace-nowrap border-collapse border border-black">
                          <thead className="bg-slate-200 sticky top-0 text-slate-800 text-xs uppercase shadow-sm border-b-2 border-black">
                            <tr>
                              <th className="px-4 py-3 font-bold border border-black">Nome</th>
                              <th className="px-4 py-3 font-bold border border-black">Celular</th>
                              <th className="px-4 py-3 font-bold border border-black">Importado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedData.map((row, idx) => (
                              <tr key={idx} className={`transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                <td className="px-4 py-2 text-black font-medium border border-black">{row.nome}</td>
                                <td className={`px-4 py-2 font-mono text-xs border border-black ${row.celular.length > 0 && row.celular.replace('+55', '').length < 11 ? 'text-red-600 font-bold' : 'text-black'}`}>{row.celular}</td>
                                <td className="px-4 py-2 text-black font-medium border border-black">{row.importado}</td>
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

      {/* Popup de Aviso (Números Inválidos) */}
      {showWarningPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-red-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Atenção aos Números</h3>
            <p className="text-center text-slate-600 mb-6">
              Existem números de telefone com menos de 11 dígitos destacados em <span className="font-bold text-red-600">vermelho</span>. Eles estão fora do padrão para o envio de WhatsApp e precisarão ser tratados manualmente.
            </p>
            <button 
              onClick={() => setShowWarningPopup(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Ciente
            </button>
          </div>
        </div>
      )}
      {/* Popup de Aviso (Scanner Desligado) */}
      {showScannerOffPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-orange-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-4 mx-auto">
              <ScannerIcon className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Scanner não detectado</h3>
            <p className="text-center text-slate-600 mb-6">
              Não foi possível localizar o scanner. Verifique se o equipamento está <span className="font-bold text-orange-600">ligado</span> e conectado corretamente.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Estatísticas da Importação */}
      {importStats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4 mx-auto">
              <UploadCloud className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-center text-slate-800 mb-6">Resultado da Importação</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-sm font-semibold text-slate-600">Total Analisado:</span>
                <span className="text-lg font-bold text-slate-800">{importStats.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 border border-green-100">
                <span className="text-sm font-semibold text-green-700">Sucesso:</span>
                <span className="text-lg font-bold text-green-700">{importStats.imported}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-red-50 border border-red-100">
                <span className="text-sm font-semibold text-red-700">Recusado(s)/Duplicado(s):</span>
                <span className="text-lg font-bold text-red-700">{importStats.rejected}</span>
              </div>
            </div>

            {importStats.rejected > 0 && (
              <p className="text-xs text-center text-slate-500 mb-6 px-4">
                Uma planilha chamada <span className="font-bold">REMALHO_PROBLEMATICO.XLSX</span> foi baixada automaticamente apenas com os registros problemáticos.
              </p>
            )}

            <button 
              onClick={() => setImportStats(null)}
              className="w-full bg-[#0078d4] hover:bg-[#006cbd] text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
