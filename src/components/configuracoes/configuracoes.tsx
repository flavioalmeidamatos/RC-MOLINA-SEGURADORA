import React, { useState, useRef } from "react";
import { FileSpreadsheet, GripVertical, CheckCircle2, X, UploadCloud } from "lucide-react";
import ExcelJS from "exceljs";

interface Field {
  id: string;
  label: string;
}

export const Configuracoes: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreview, setExcelPreview] = useState<{ headers: string[], rows: string[][] } | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<number, string>>({});

  const dbFields: Field[] = [
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setColumnMappings({});

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        alert("Planilha vazia ou formato inválido.");
        return;
      }

      let headers: string[] = [];
      const rows: string[][] = [];
      let headerFound = false;

      worksheet.eachRow((row, rowNumber) => {
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
            while(lastIndex >= 0 && rowData[lastIndex] === '') lastIndex--;
            headers = rowData.slice(0, lastIndex + 1);
            headerFound = true;
          }
        } else {
          // Apenas adiciona linhas que não são completamente vazias
          if (rowData.some(v => v !== '')) {
             rows.push(rowData);
          }
        }
      });

      if (!headerFound || headers.length === 0) {
        alert("A primeira linha não contém cabeçalhos válidos.");
        setExcelPreview(null);
        return;
      }

      // Preenche colunas vazias com nomes genéricos
      for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) headers[i] = `Coluna ${i + 1}`;
      }

      setExcelPreview({ headers, rows });
    } catch (err: any) {
      alert("Falha ao ler arquivo: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx"
        className="hidden"
      />

      {!excelPreview ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
          <FileSpreadsheet size={48} className="text-blue-600 mb-4" />
          <h3 className="text-lg font-bold mb-2">Nenhuma planilha carregada</h3>
          <p className="text-sm text-gray-500 mb-4 text-center">
            Selecione um arquivo .XLSX do seu computador para visualizar as colunas e fazer a associação com os campos do sistema.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            <UploadCloud size={18} className="inline mr-2" />
            Carregar Arquivo Excel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {/* Campos do sistema */}
          <div className="col-span-1 border p-4 rounded-lg bg-gray-50">
            <h4 className="font-bold mb-2">Campos do Sistema</h4>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {dbFields.map(field => {
                const isMapped = Object.values(columnMappings).includes(field.id);
                return (
                  <div
                    key={field.id}
                    draggable={!isMapped}
                    onDragStart={e => {
                      e.dataTransfer.setData('fieldId', field.id);
                    }}
                    className={`p-2 border rounded-lg ${isMapped ? 'bg-gray-200 cursor-not-allowed opacity-60' : 'bg-white hover:border-blue-500 cursor-grab'}`}
                  >
                    <div className="flex justify-between items-center">
                      {field.label}
                      <GripVertical size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview do Excel */}
          <div className="col-span-3 border p-4 rounded-lg overflow-x-auto bg-white">
            <h4 className="font-bold mb-2">{excelFile?.name}</h4>
            <div className="flex gap-4 min-w-max">
              {excelPreview.headers.map((header, colIndex) => {
                const mappedFieldId = columnMappings[colIndex];
                const mappedField = dbFields.find(f => f.id === mappedFieldId);

                return (
                  <div key={colIndex} className="flex flex-col w-48 shrink-0">
                    <div
                      className={`h-12 mb-2 rounded-lg border-2 border-dashed flex items-center justify-center ${
                        mappedField ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-gray-50'
                      }`}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
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
                        <div className="flex items-center gap-1">
                          {mappedField.label}
                          <CheckCircle2 size={14} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Arraste aqui</span>
                      )}
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-gray-100 p-2 text-xs font-bold text-center border-b border-gray-200 truncate">{header}</div>
                      {excelPreview.rows.map((row, rIndex) => (
                        <div key={rIndex} className={`p-2 text-xs truncate border-b border-gray-100 ${rIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`} title={row[colIndex]}>
                          {row[colIndex] || '-'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};