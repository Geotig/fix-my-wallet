import React, { useState } from 'react';
import { API_URL } from '../api';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Select from './ui/Select';
import Input from './ui/Input';

const FileImportModal = ({ isOpen, onClose, accounts, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [previewData, setPreviewData] = useState(null);
  
  const [mapping, setMapping] = useState({
    date_col: '',
    payee_col: '',
    amount_mode: 'separate', 
    amount_col: '',
    amount_in_col: '',
    amount_out_col: '',
    invert_amount: false
  });

  const resetState = () => {
    setStep(1);
    setSelectedFile(null);
    setSelectedAccount('');
    setPreviewData(null);
    setLoading(false);
    setError(null);
    setMapping({ date_col: '', payee_col: '', amount_mode: 'separate', amount_col: '', amount_in_col: '', amount_out_col: '', invert_amount: false });
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!selectedFile || !selectedAccount) {
        setError("Selecciona una cuenta y un archivo.");
        return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        const res = await fetch(`${API_URL}/api/import/preview/`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Error leyendo el archivo.");
        
        const data = await res.json();
        setPreviewData(data);
        
        const cols = data.columns.map(c => c.toLowerCase());
        setMapping(prev => ({
            ...prev,
            date_col: data.columns.find(c => c.toLowerCase().includes('fecha') || c.toLowerCase().includes('date')) || '',
            payee_col: data.columns.find(c => c.toLowerCase().includes('descrip') || c.toLowerCase().includes('glosa')) || '',
            amount_in_col: data.columns.find(c => c.toLowerCase().includes('abono')) || '',
            amount_out_col: data.columns.find(c => c.toLowerCase().includes('cargo')) || '',
            header_row: data.detected_header_row
        }));

        setStep(2);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('account_id', selectedAccount);
    formData.append('mapping', JSON.stringify(mapping));

    try {
        const res = await fetch(`${API_URL}/api/import/execute/`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Error procesando el archivo.");
        const result = await res.json();
        
        alert(`Proceso finalizado.\n\n✅ Nuevas importadas: ${result.imported}\n⚠️ Duplicadas (omitidas): ${result.duplicated}`);
        onSuccess(); 
        onClose();
        resetState();
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  // --- COMPONENTE AUXILIAR PARA MOSTRAR VALORES DE EJEMPLO ---
  const ColumnPreviewSample = ({ colName }) => {
    if (!colName || !previewData) return null;
    // Obtener los primeros 3 valores de esa columna
    const samples = previewData.sample.map(row => row[colName]).filter(v => v !== null && v !== '').slice(0, 3);
    if (samples.length === 0) return <div className="text-xs text-gray-400 mt-1 italic">Sin datos en muestra</div>;
    
    return (
        <div className="text-xs text-gray-500 mt-1 bg-yellow-50 p-1 rounded border border-yellow-100">
            <strong>Ej:</strong> {samples.join(', ')} ...
        </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Cartola Bancaria">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1"> {/* Scroll vertical para el modal */}
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm mb-4">{error}</div>}

        {step === 1 && (
            <form onSubmit={handlePreview} className="space-y-4">
                <Select label="1. Cuenta de Destino" required value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">2. Archivo</label>
                    <input type="file" accept=".xlsx, .xls, .csv" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={e => setSelectedFile(e.target.files[0])} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={loading}>{loading ? 'Analizando...' : 'Siguiente >'}</Button>
                </div>
            </form>
        )}

        {step === 2 && previewData && (
            <div className="space-y-6">
                <p className="text-sm text-gray-600">Confirma las columnas detectadas:</p>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <Select label="Columna Fecha" value={mapping.date_col} onChange={e => setMapping({...mapping, date_col: e.target.value})}>
                            <option value="">(Ignorar)</option>
                            {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <ColumnPreviewSample colName={mapping.date_col} />
                    </div>

                    <div>
                        <Select label="Columna Descripción" value={mapping.payee_col} onChange={e => setMapping({...mapping, payee_col: e.target.value})}>
                            <option value="">(Ignorar)</option>
                            {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <ColumnPreviewSample colName={mapping.payee_col} />
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <label className="text-xs font-bold text-gray-700 uppercase mb-2 block">Montos</label>
                    <div className="flex gap-4 mb-4 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="mode" checked={mapping.amount_mode === 'separate'} onChange={() => setMapping({...mapping, amount_mode: 'separate'})} />
                            Separado (Cargos / Abonos)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="mode" checked={mapping.amount_mode === 'single'} onChange={() => setMapping({...mapping, amount_mode: 'single'})} />
                            Columna Única (+/-)
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {mapping.amount_mode === 'separate' ? (
                            <>
                                <div>
                                    <Select label="Col. Cargos (Salidas)" value={mapping.amount_out_col} onChange={e => setMapping({...mapping, amount_out_col: e.target.value})}>
                                        <option value="">Seleccionar...</option>
                                        {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </Select>
                                    <ColumnPreviewSample colName={mapping.amount_out_col} />
                                </div>
                                <div>
                                    <Select label="Col. Abonos (Entradas)" value={mapping.amount_in_col} onChange={e => setMapping({...mapping, amount_in_col: e.target.value})}>
                                        <option value="">Seleccionar...</option>
                                        {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </Select>
                                    <ColumnPreviewSample colName={mapping.amount_in_col} />
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 space-y-2">
                                <Select label="Columna Monto" value={mapping.amount_col} onChange={e => setMapping({...mapping, amount_col: e.target.value})}>
                                    <option value="">Seleccionar...</option>
                                    {previewData.columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </Select>
                                <ColumnPreviewSample colName={mapping.amount_col} />
                                
                                <label className="flex items-center gap-2 text-sm text-gray-700 mt-2 p-2 bg-white border rounded cursor-pointer">
                                    <input type="checkbox" checked={mapping.invert_amount} onChange={(e) => setMapping({...mapping, invert_amount: e.target.checked})} className="rounded text-blue-600" />
                                    <span>Invertir Signo (Positivo = Gasto)</span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {/* VISTA PREVIA MEJORADA */}
                <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Tabla Completa (Scroll Horizontal)</h4>
                    <div className="overflow-x-auto border rounded text-xs max-w-full">
                        <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                            <thead className="bg-gray-50">
                                <tr>
                                    {/* CAMBIO AQUÍ: Quitamos .slice(0, 5) para mostrar TODO */}
                                    {previewData.columns.map(c => (
                                        <th key={c} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 bg-gray-50 sticky top-0">
                                            {c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.sample.map((row, i) => (
                                    <tr key={i}>
                                        {previewData.columns.map(c => (
                                            <td key={c} className="px-3 py-2 border-b border-gray-100 text-gray-700">
                                                {row[c]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setStep(1)}>&lt; Volver</Button>
                    <Button type="button" onClick={handleExecute} disabled={loading}>{loading ? 'Importando...' : 'Confirmar Importación'}</Button>
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
};

export default FileImportModal;