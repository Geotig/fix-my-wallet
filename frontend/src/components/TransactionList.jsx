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
    <div className="relative">
      
      {/* BARRA FLOTANTE DE ACCIONES (Aparece al seleccionar 2) */}
      {selectedIds.length === 2 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-fade-in-up">
          <span className="text-sm font-medium">2 transacciones seleccionadas</span>
          <Button 
            size="sm" 
            variant="primary"
            onClick={handleLinkClick}
          >
            🔗 Unir como Transferencia
          </Button>
          <button onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th> {/* Columna Checkbox */}
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payee</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cuenta</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((tx) => (
                <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(tx.id) ? 'bg-blue-50' : ''}`}>
                  
                  {/* 1. CHECKBOX */}
                  <td className="px-4 py-3 text-center">
                    {!tx.is_transfer && !tx.is_adjustment && ( // Solo permitimos seleccionar si NO es transferencia aún y NO es ajuste
                        <input 
                            type="checkbox" 
                            checked={selectedIds.includes(tx.id)}
                            onChange={() => toggleSelection(tx.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                    )}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(tx.date)}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                        {tx.is_transfer && <span title="Transferencia">🔄</span>}
                        {tx.display_payee}
                    </div>
                    {tx.memo && <div className="text-xs text-gray-400 font-normal truncate max-w-[200px]">{tx.memo}</div>}
                  </td>

                  {/* 2. CATEGORÍA O INDICADOR DE TRANSFERENCIA */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                        // Caso 1: Es Transferencia
                        if (tx.is_transfer) {
                            return (
                                <div className="flex flex-col gap-1 items-start">
                                    {/* Badge de Transferencia */}
                                    <Badge color="blue" className="flex items-center gap-1 w-fit">
                                        <span>↔</span> {tx.transfer_account_name}
                                    </Badge>
                                    
                                    {/* Si tiene categoría asignada (ej: Hipoteca), mostrarla también */}
                                    {tx.category && (
                                        <span className="text-xs text-gray-600 ml-1">
                                            Cat: <strong>{tx.category_name}</strong>
                                        </span>
                                    )}
                                </div>
                            );
                        }
                        // Caso 2: Es Ajuste de Saldo (NUEVO)
                        if (tx.is_adjustment) {
                            return (
                                <Badge color="gray" className="flex items-center gap-1 w-fit cursor-help" title="Impacta directamente al 'Por Asignar'">
                                    <span>⚖️</span> Ajuste de Saldo
                                </Badge>
                            );
                        }
                        // Caso 3: Transacción Normal
                        return (
                            <CategorySelect 
                                transaction={tx} 
                                categories={categories} 
                                onCategoryChange={onTransactionUpdate} 
                            />
                        );
                    })()}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {tx.account_name}
                  </td>
                  
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
  );
};

export default TransactionList;