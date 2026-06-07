import React, { useState } from "react";
import { Scan as ScannerIcon, Download, Loader2 } from "lucide-react";

export const Configuracoes: React.FC = () => {
  const [scanners, setScanners] = useState<string[]>([]);
  const [selectedScanner, setSelectedScanner] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const buscarScanners = async () => {
    setIsSearching(true);
    // TODO: Implementar chamada real para o agente desktop ou host C#
    // Mockando para testes
    setTimeout(() => {
      setScanners([
        "Scanner Brother MFC-L2740DW",
        "Epson L3150 Series",
        "HP DeskJet 2700"
      ]);
      setSelectedScanner("Scanner Brother MFC-L2740DW");
      setIsSearching(false);
    }, 1500);
  };

  const escanearDocumento = async () => {
    if (!selectedScanner) return;
    setIsScanning(true);
    // TODO: Implementar chamada real para o agente desktop ou host C#
    // Mockando para testes
    setTimeout(() => {
      // Fake base64 image (um pequeno pixel cinza para preview mockado)
      setScannedImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
      setIsScanning(false);
    }, 3000);
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
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="mb-8 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-800">Digitalização de Documentos</h2>
            <p className="text-sm text-slate-500">
              Busque scanners conectados ao computador para digitalizar documentos físicos diretamente para o sistema.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Scanner Selecionado
                </label>
                <select
                  value={selectedScanner}
                  onChange={(e) => setSelectedScanner(e.target.value)}
                  disabled={scanners.length === 0 || isSearching || isScanning}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-[#b58c2a] focus:ring-1 focus:ring-[#b58c2a] disabled:opacity-60"
                >
                  {scanners.length === 0 ? (
                    <option value="">Nenhum scanner encontrado</option>
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
                className="flex h-11 items-center gap-2 rounded-xl bg-[#0c1826] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1a2e44] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <ScannerIcon size={16} />}
                Buscar Scanners
              </button>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={escanearDocumento}
                disabled={!selectedScanner || isScanning}
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

            {scannedImage && (
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Preview da Digitalização
                </p>
                <div className="flex justify-center bg-white border border-slate-200 shadow-sm rounded-lg p-2 min-h-[300px]">
                  <img
                    src={scannedImage}
                    alt="Documento escaneado"
                    className="max-w-full max-h-[600px] object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
