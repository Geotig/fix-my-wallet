import React from 'react';
import CategorySelect from './CategorySelect'; // <--- Importar

const TransactionList = ({ transactions, categories, onTransactionUpdate }) => {
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const formatDate = (dateString) => {
    // Truco para evitar problemas de zona horaria al formatear fechas simples 'YYYY-MM-DD'
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto"> {/* Para scroll en móviles */}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {tx.payee}
                  {tx.memo && <div className="text-xs text-gray-400 font-normal">{tx.memo}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {/* AQUÍ ESTÁ LA MAGIA: El Selector */}
                  <CategorySelect 
                    transaction={tx} 
                    categories={categories} 
                    onCategoryChange={onTransactionUpdate} 
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {tx.account_name}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
            
            {transactions.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                  No hay transacciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;