import React, { useState, useEffect, useRef } from "react";
import { Scan as ScannerIcon, Download, Loader2, Network, X, Table, FileSpreadsheet, UploadCloud, GripVertical, CheckCircle2, Database } from "lucide-react";
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
  const [extractedData, setExtractedData] = useState<Array<{ nome: string, celular: string, importado: string }>>([]);
  const [showWarningPopup, setShowWarningPopup] = useState<boolean>(false);
  const [showScannerOffPopup, setShowScannerOffPopup] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStats, setImportStats] = useState<{ total: number, imported: number, rejected: number } | null>(null);

  const [excelPreview, setExcelPreview] = useState<{ headers: string[], rows: string[][] } | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<number, string>>({});
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const dbFields = [
    { id: 'nome_completo', label: 'Nome' },
    { id: 'celular', label: 'Celular' },
    { id: 'email', label: 'E-mail' },
    { id: 'cpf', label: 'CPF' },
    { id: 'rg', label: 'RG' },
    { id: 'cnpj', label: 'CNPJ' },
    { id: 'data_nascimento', label: 'Data Nascimento' },
    { id: 'cep', label: 'CEP' },
    { id: 'logradouro', label: 'Logradouro' },
    { id: 'bairro', label: 'Bairro' },
    { id: 'cidade', label: 'Cidade' },
    { id: 'uf', label: 'UF' },
    { id: 'observacoes_extras', label: 'Observações' }
  ];

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
      setTimeout(() => {
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
    const data: Array<{ nome: string, celular: string, importado: string }> = [];

    const patternVmc = /VMC\s*Multimarcas(\s*Form\.?Inst\.?)?/gi;
    let pendingNome = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      line = line.replace(patternVmc, '');
      let nome = line.replace(/[^a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]/g, '');
      nome = nome.replace(/\s+/g, ' ').trim().toUpperCase();

      let telefonesStr = line.replace(/[^\d/]/g, '');
      let telefones = telefonesStr.split('/').filter(t => t.length > 0);

      if (nome && telefones.length === 0) {
        if (pendingNome) {
          data.push({ nome: pendingNome, celular: '', importado: `${pendingNome} - REMALHO` });
        }
        pendingNome = nome;
      } else if (telefones.length > 0) {
        const finalNome = nome || pendingNome || 'CLIENTE';
        const importadoText = `${finalNome} - REMALHO`;

        telefones.forEach(celular => {
          data.push({ nome: finalNome, celular: celular, importado: importadoText });
        });

        pendingNome = '';
      }
    }

    if (pendingNome) {
      data.push({ nome: pendingNome, celular: '', importado: `${pendingNome} - REMALHO` });
    }

    const cleanedData = data.filter(d => {
      if (d.celular.length >= 8) return true;
      if (d.celular.length > 0 && d.celular.length < 8) return false;
      const words = d.nome.split(' ').filter(w => w.length > 0);
      const isGarbageName = words.length === 0 || words.some(w => w.length === 1);
      if (!isGarbageName && d.nome.length >= 4) return true;
      return false;
    });

    setExtractedData(cleanedData);
    
    if (cleanedData.length === 0) {
      setOcrStatus('Nenhum dado válido encontrado.');
    } else {
      setOcrStatus('Extração concluída com sucesso!');
      const hasInvalidNumbers = cleanedData.some(d => d.celular.length > 0 && d.celular.length < 10);
      if (hasInvalidNumbers) {
        setShowWarningPopup(true);
        setTimeout(() => setShowWarningPopup(false), 10000);
      }
    }
  };

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contatos');

    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 45 },
      { header: 'Celular', key: 'celular', width: 25, style: { numFmt: '@' } },
      { header: 'Importado', key: 'importado', width: 15 }
    ];

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

        if (colNumber === 2 && row.celular.length > 0 && row.celular.length < 10) {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else {
          cell.font = { color: { argb: 'FF000000' } };
        }
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
    saveAs(new Blob([buffer]), 'REMALHO.XLSX');
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

    setExcelFile(file);
    setColumnMappings({});

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0]; // Correção: pegar a 1a aba

      if (!worksheet) {
        alert("Planilha vazia ou formato inválido.");
        return;
      }

      let headers: string[] = [];
      const rows: string[][] = [];
      let headerFound = false;

      worksheet.eachRow((row) => {
        if (rows.length >= 5) return;

        let rawValues: any[] = [];
        if (Array.isArray(row.values)) {
          rawValues = row.values;
        } else if (typeof row.values === 'object' && row.values !== null) {
          const keys = Object.keys(row.values).map(Number).filter(k => !isNaN(k));
          if (keys.length > 0) {
            const max = Math.max(...keys);
            for (let i = 1; i <= max; i++) {
              rawValues[i] = (row.values as any)[i];
            }
          }
        }

        const rowData = rawValues.slice(1).map((v) => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') {
            if ('text' in v && v.text) return String(v.text).trim();
            if ('result' in v && v.result) return String(v.result).trim();
            if ('richText' in v && Array.isArray(v.richText)) {
              return v.richText.map((rt: any) => rt.text).join('').trim();
            }
            return String(v);
          }
          return String(v).trim();
        });

        if (!headerFound) {
          if (rowData.some(v => v !== '')) {
            let lastIndex = rowData.length - 1;
            while (lastIndex >= 0 && rowData[lastIndex] === '') {
              lastIndex--;
            }
            headers = rowData.slice(0, lastIndex + 1);
            headerFound = true;
          }
        } else {
          if (rowData.some(v => v !== '')) {
            const paddedRow = [...rowData];
            while (paddedRow.length < headers.length) paddedRow.push('');
            rows.push(paddedRow.slice(0, headers.length));
          }
        }
      });

      // Fill empty header spots
      for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) headers[i] = `Coluna ${i + 1}`;
      }

      if (!headerFound || headers.length === 0) {
        alert("Planilha vazia ou sem dados legíveis.");
        setExcelPreview(null);
        return;
      }

      setExcelPreview({ headers, rows });

    } catch (err: any) {
      alert("Falha ao ler arquivo: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (!excelFile || !excelPreview) return;

    // Check if at least one column is mapped
    if (Object.keys(columnMappings).length === 0) {
      alert("Por favor, mapeie pelo menos um campo para iniciar a importação.");
      return;
    }

    const mappedFields = Object.values(columnMappings);
    if (!mappedFields.includes('nome_completo')) {
      const confirmResult = window.confirm("Você não mapeou o campo 'Nome'. O sistema pode ter dificuldade para identificar o contato. Deseja continuar?");
      if (!confirmResult) return;
    }

    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await excelFile.arrayBuffer());
      const worksheet = workbook.worksheets[0]; // Correção: pegar a 1a aba

      const contactsToImport: Record<string, string>[] = [];

      let headerFound = false;
      if (worksheet) {
        worksheet.eachRow((row) => {
          let maxCols = row.cellCount || 0;
          if (Array.isArray(row.values) && row.values.length > maxCols) {
            maxCols = row.values.length - 1;
          }
          maxCols = Math.max(maxCols, 20);

          const rowData: string[] = [];
          for (let i = 1; i <= maxCols; i++) {
            const val = row.getCell(i).value;
            if (val === null || val === undefined) {
              rowData.push('');
            } else if (typeof val === 'object') {
              if ('text' in val && val.text) rowData.push(String(val.text).trim());
              else if ('result' in val && val.result) rowData.push(String(val.result).trim());
              else if ('richText' in val && Array.isArray(val.richText)) rowData.push(val.richText.map((rt: any) => rt.text).join('').trim());
              else rowData.push(String(val).trim());
            } else {
              rowData.push(String(val).trim());
            }
          }

          if (!headerFound) {
            if (rowData.some(v => v !== '')) {
              headerFound = true; // Skip header row
            }
          } else {
            const contact: Record<string, string> = {};
            let hasAnyData = false;

            Object.entries(columnMappings).forEach(([colIndex, fieldId]) => {
              const cellValue = rowData[parseInt(colIndex)];
              if (cellValue) {
                contact[fieldId as string] = cellValue;
                hasAnyData = true;
              }
            });

            if (hasAnyData) {
              contactsToImport.push(contact);
            }
          }
        });
      }

      if (contactsToImport.length === 0) {
        alert("Nenhum dado válido encontrado nas colunas mapeadas.");
        setIsImporting(false);
        return;
      }

      const chunkSize = 5;
      let totalImported = 0;
      let allRejected = [];
      let hasScopeError = false;
      let hasConnectionError = false;
      let lastErrorMsg = "";

      setImportProgress(0);

      for (let i = 0; i < contactsToImport.length; i += chunkSize) {
        const chunk = contactsToImport.slice(i, i + chunkSize);

        try {
          const response = await fetch('/api/gmail/import-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: chunk })
          });

          if (!response.ok) {
            lastErrorMsg = `Timeout ou erro no servidor (Status ${response.status}). O lote foi muito grande ou o servidor falhou.`;
            break;
          }

          const result = await response.json();

          if (result.success) {
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
        } catch (e) {
          lastErrorMsg = "Falha na comunicação com o servidor ou timeout na resposta.";
          break;
        }

        const progress = Math.min(100, Math.round(((i + chunk.length) / contactsToImport.length) * 100));
        setImportProgress(progress);
        await new Promise(r => setTimeout(r, 50));
      }

      if (hasConnectionError) {
        alert("Por favor, conecte ou reconecte seu Gmail na tela de e-mails para autorizar o Google Contatos.");
      } else if (hasScopeError) {
        alert("O sistema requer uma nova permissão (Contatos) no seu Gmail. Por favor, desconecte e conecte o Gmail novamente.");
      } else if (lastErrorMsg) {
        alert("Importação interrompida: " + lastErrorMsg);
      }

      await new Promise(r => setTimeout(r, 500));
      setImportStats({
        total: contactsToImport.length,
        imported: totalImported,
        rejected: allRejected.length
      });

      if (allRejected.length > 0) {
        await downloadRejectedExcel(allRejected);
      }
    } catch (err: any) {
      alert("Falha ao processar arquivo: " + err.message);
    } finally {
      setIsImporting(false);
      setExcelPreview(null);
      setExcelFile(null);
      setColumnMappings({});
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
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#0c1826] p-4 text-white shrink-0 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#d4af37] ring-1 ring-white/10 backdrop-blur-sm">
            <ScannerIcon size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Configurações do Sistema</h1>
            <p className="text-xs font-medium text-white/50 mt-0.5">
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

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 w-full max-w-[1600px] mx-auto items-start">
          {/* Coluna Esquerda: Scanner */}
          <div className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[650px]">
            <div className="mb-4 border-b border-slate-100 pb-2 flex justify-between items-end">
              <div>
                <h2 className="text-base font-bold text-slate-800">Digitalização de Documentos</h2>
                <p className="text-xs text-slate-500 mt-0.5">
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
                  <Network size={16} className="text-slate-500" />
                  Scanner de Rede (IP)
                </span>
              </label>
            </div>

            <div className="space-y-4 bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-inner min-h-[100px]">
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

          {/* Coluna Direita: Importação Inteligente de Clientes (Excel) */}
          <div className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-end">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UploadCloud className="text-[#0078d4]" size={18} />
                  Importação Inteligente de Clientes (Excel)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Carregue uma planilha, faça o mapeamento das colunas arrastando os campos e importe os dados para o sistema.
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-4 pt-3 flex-1 bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-inner flex flex-col">
              {!excelPreview ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-10 text-center min-h-[40vh]">
                  <FileSpreadsheet size={48} className="text-[#0078d4] mb-4 opacity-80" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Nenhuma planilha carregada</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md">
                    Selecione um arquivo .XLSX do seu computador para visualizar as colunas e fazer a associação com os campos do sistema.
                  </p>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-6 font-bold text-white shadow-lg shadow-[#0078d4]/20 transition-all hover:bg-[#006cbd]"
                  >
                    <UploadCloud size={18} />
                    Carregar Arquivo Excel
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                  {/* Campos do Banco (Esquerda) */}
                  <div className="xl:col-span-1 border border-slate-200 rounded-xl bg-slate-50 p-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <Database size={16} className="text-[#b58c2a]" />
                      Campos do Sistema
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      Arraste estes campos e solte sobre as colunas da planilha ao lado.
                    </p>

                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {dbFields.map(field => {
                        const isMapped = Object.values(columnMappings).includes(field.id);
                        return (
                          <div
                            key={field.id}
                            draggable={!isMapped}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('fieldId', field.id);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className={`px-3 py-2.5 rounded-lg border text-sm font-semibold shadow-sm transition-all flex items-center justify-between ${isMapped
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-white border-slate-200 text-slate-700 cursor-grab hover:border-[#b58c2a] hover:shadow-md'
                              }`}
                          >
                            {field.label}
                            <GripVertical size={14} className={isMapped ? "text-slate-300" : "text-slate-400"} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview da Planilha (Direita) */}
                  <div className="xl:col-span-3 border border-slate-200 rounded-xl bg-white flex flex-col overflow-hidden min-h-[400px]">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <FileSpreadsheet size={16} className="text-green-600" />
                          {excelFile?.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Pré-visualizando as colunas e as primeiras linhas
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setExcelPreview(null);
                          setExcelFile(null);
                          setColumnMappings({});
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors"
                      >
                        Cancelar / Trocar Arquivo
                      </button>
                    </div>

                    <div className="flex-1 overflow-x-auto p-4 custom-scrollbar">
                      <div className="flex gap-4 min-w-max pb-4">
                        {excelPreview.headers.map((header, colIndex) => {
                          const mappedFieldId = columnMappings[colIndex];
                          const mappedField = dbFields.find(f => f.id === mappedFieldId);

                          return (
                            <div key={colIndex} className="flex flex-col w-48 shrink-0">
                              {/* Dropzone */}
                              <div
                                className={`h-12 mb-2 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors relative group ${mappedField
                                    ? 'border-[#b58c2a] bg-[#b58c2a]/10'
                                    : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                                  }`}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const fieldId = e.dataTransfer.getData('fieldId');
                                  if (fieldId) {
                                    setColumnMappings(prev => {
                                      const newMap = { ...prev };
                                      Object.keys(newMap).forEach(key => {
                                        if (newMap[parseInt(key)] === fieldId) delete newMap[parseInt(key)];
                                      });
                                      newMap[colIndex] = fieldId;
                                      return newMap;
                                    });
                                  }
                                }}
                              >
                                {mappedField ? (
                                  <>
                                    <span className="text-sm font-bold text-[#b58c2a] flex items-center gap-1.5">
                                      {mappedField.label}
                                      <CheckCircle2 size={14} />
                                    </span>
                                    <button
                                      onClick={() => {
                                        setColumnMappings(prev => {
                                          const newMap = { ...prev };
                                          delete newMap[colIndex];
                                          return newMap;
                                        });
                                      }}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hidden group-hover:block"
                                    >
                                      <X size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400">Arraste aqui</span>
                                )}
                              </div>

                              {/* Coluna Excel */}
                              <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <div className="bg-slate-100 p-2 border-b border-slate-200 text-xs font-bold text-slate-700 truncate text-center" title={header}>
                                  {header}
                                </div>
                                {excelPreview.rows.map((row, rIndex) => (
                                  <div key={rIndex} className={`p-2 text-xs text-slate-800 truncate border-b border-slate-100 last:border-b-0 ${rIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} title={row[colIndex]}>
                                    {row[colIndex] || '-'}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={handleExecuteImport}
                        disabled={isImporting || Object.keys(columnMappings).length === 0}
                        className="relative flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-8 font-bold text-white shadow-lg shadow-[#0078d4]/20 transition-all hover:bg-[#006cbd] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                      >
                        {isImporting && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[#004e8c] transition-all duration-300 ease-out"
                            style={{ width: `${importProgress}%` }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                          {isImporting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                          {isImporting ? `Importando... ${importProgress}%` : 'Executar Importação'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Scanner Não Encontrado</h3>
            <p className="text-center text-slate-600 mb-6">
              Nenhum scanner foi detectado no seu computador. Verifique se o equipamento está ligado e conectado corretamente.
            </p>
            <button
              onClick={() => setShowScannerOffPopup(false)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {importStats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Importação Concluída</h3>

            <div className="bg-slate-50 rounded-xl p-4 my-6 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Lidos na Planilha:</span>
                <span className="font-bold text-slate-800">{importStats.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-600">Importados com Sucesso:</span>
                <span className="font-bold text-green-600">{importStats.imported}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-600">Rejeitados/Erros:</span>
                <span className="font-bold text-red-600">{importStats.rejected}</span>
              </div>
            </div>

            {importStats.rejected > 0 && (
              <p className="text-xs text-center text-red-600 mb-4 px-2">
                Baixamos automaticamente uma planilha com os erros para você verificar.
              </p>
            )}

            <button
              onClick={() => setImportStats(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};