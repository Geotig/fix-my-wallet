import React, { useState } from 'react';
import Card from './ui/Card';
import CategorySelect from './CategorySelect';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { useLocalization } from '../contexts/LocalizationContext';

const TransactionList = ({ transactions, categories, onTransactionUpdate, onLinkTransfer }) => {
  const { formatCurrency } = useLocalization();

  const [selectedIds, setSelectedIds] = useState([]);

  // Formateadores (Mantenemos los mismos)
  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  };

  // Manejar selección de Checkbox
  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // Acción de Vincular
  const handleLinkClick = () => {
    if (selectedIds.length === 2) {
      onLinkTransfer(selectedIds[0], selectedIds[1]);
      setSelectedIds([]); // Limpiar selección
    }
  };

  return (
    <div className="relative pb-20 md:pb-0"> {/* Padding bottom extra en móvil para que no lo tape la barra de nav */}
      
      {/* BARRA FLOTANTE DE ACCIONES (Igual que antes) */}
      {selectedIds.length === 2 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-fade-in-up w-11/12 md:w-auto justify-between">
          <span className="text-sm font-medium whitespace-nowrap">2 seleccionadas</span>
          <div className="flex items-center gap-2">
            <Button 
                size="sm" 
                variant="primary"
                onClick={handleLinkClick}
            >
                🔗 Unir
            </Button>
            <button onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-white p-1">✕</button>
          </div>
        </div>
      )}

      {/* --- VISTA ESCRITORIO (Tabla) --- */}
      <div className="hidden md:block">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-4 py-3"></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-24">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Payee</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-48">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Cuenta</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Monto</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(tx.id) ? 'bg-blue-50' : ''}`}>
                      {/* ... (Copia aquí el contenido de los <td> que ya tenías para escritorio) ... */}
                      {/* ... o usa el código completo de abajo ... */}
                      <td className="px-4 py-3 text-center">
                        {!tx.is_transfer && !tx.is_adjustment && (
                            <input 
                                type="checkbox" 
                                checked={selectedIds.includes(tx.id)}
                                onChange={() => toggleSelection(tx.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(tx.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                            {tx.is_transfer && <span title="Transferencia">🔄</span>}
                            {tx.display_payee}
                        </div>
                        {tx.memo && <div className="text-xs text-gray-400 font-normal truncate max-w-[200px]">{tx.memo}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                            if (tx.is_transfer) return <Badge color="blue">↔ {tx.transfer_account_name}</Badge>;
                            if (tx.is_adjustment) return <Badge color="gray">⚖️ Ajuste</Badge>;
                            return <CategorySelect transaction={tx} categories={categories} onCategoryChange={onTransactionUpdate} />;
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{tx.account_name}</td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
      </div>

      {/* --- VISTA MÓVIL (Lista de Tarjetas) --- */}
      <div className="md:hidden space-y-3">
        {transactions.map((tx) => (
            <div 
                key={tx.id} 
                className={`bg-white p-3 rounded-lg shadow border transition-colors ${
                    selectedIds.includes(tx.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-100'
                }`}
                // Permitir selección manteniendo presionado o click en un área específica?
                // Por simplicidad móvil: Click en tarjeta = Nada (o expandir detalles), 
                // Click en checkbox explícito = Seleccionar.
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3 overflow-hidden">
                        {/* Checkbox Móvil Grande */}
                        {!tx.is_transfer && !tx.is_adjustment && (
                            <div className="pt-1">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.includes(tx.id)}
                                    onChange={() => toggleSelection(tx.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                        )}
                        
                        {/* Info Principal */}
                        <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate flex items-center gap-1">
                                {tx.is_transfer && <span>🔄</span>}
                                {tx.display_payee}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{tx.account_name}</span>
                                <span>•</span>
                                <span>{formatDate(tx.date)}</span>
                            </div>
                            {tx.memo && <div className="text-xs text-gray-400 italic mt-0.5 truncate">{tx.memo}</div>}
                        </div>
                    </div>

                    {/* Monto */}
                    <div className={`font-bold text-sm whitespace-nowrap ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(tx.amount)}
                    </div>
                </div>

                {/* Línea Inferior: Categoría */}
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end w-full">
                     {(() => {
                        if (tx.is_transfer) return <Badge color="blue" className="text-xs">↔ {tx.transfer_account_name}</Badge>;
                        if (tx.is_adjustment) return <Badge color="gray" className="text-xs">⚖️ Ajuste</Badge>;
                        
                        // Versión móvil del Select: Usamos el mismo componente pero le damos ancho full
                        return (
                            <div className="w-full">
                                <CategorySelect 
                                    transaction={tx} 
                                    categories={categories} 
                                    onCategoryChange={onTransactionUpdate}
                                    containerClassName="w-full" // Clase para que ocupe todo el ancho
                                />
                            </div>
                        );
                    })()}
                </div>
            </div>
        ))}

        {transactions.length === 0 && (
             <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed">
                No hay transacciones.
            </div>
        )}
      </div>

    </div>
  );
};

export default TransactionList;