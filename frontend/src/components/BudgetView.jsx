import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';

const BudgetView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);

  const getApiDateString = (dateObj) => dateObj.toISOString().split('T')[0];

  const fetchBudget = async () => {
    setLoading(true);
    const dateStr = getApiDateString(currentDate);
    try {
      const res = await apiFetch(`/api/budget_summary/?month=${dateStr}`, { headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      setBudgetData(data);
    } catch (error) {
      console.error("Error cargando presupuesto:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, [currentDate]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const formatMonth = (dateObj) => {
    return dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const handleAssignmentChange = async (categoryId, newAmount) => {
    const updatedCategories = budgetData.categories.map(cat => {
      if (cat.category_id === categoryId) {
        const diff = newAmount - cat.assigned;
        return { ...cat, assigned: newAmount, available: cat.available + diff };
      }
      return cat;
    });
    
    const newTotalAssigned = updatedCategories.reduce((acc, curr) => acc + Number(curr.assigned), 0);
    
    setBudgetData({ 
        ...budgetData, 
        categories: updatedCategories,
        totals: { ...budgetData.totals, assigned: newTotalAssigned }
    });

    try {
      await apiFetch('/api/budget_assignment/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId,
          month: getApiDateString(currentDate),
          amount: newAmount
        })
      });
    } catch (error) {
      console.error("Error guardando asignación:", error);
      fetchBudget();
    }
  };

  if (loading && !budgetData) return <div className="text-center py-10 text-gray-500">Cargando presupuesto...</div>;

  return (
    <div className="space-y-6">
      {/* Header: Navegación y Resumen */}
      <Card className="p-4 flex flex-col md:flex-row justify-between items-center bg-white">
        
        {/* Navegación Mes */}
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>
            &lt; Anterior
          </Button>
          <h2 className="text-xl font-bold capitalize w-48 text-center text-gray-800">
            {formatMonth(currentDate)}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>
            Siguiente &gt;
          </Button>
        </div>

        {/* Resumen Totales */}
        <div className="flex space-x-8 text-sm">
            <div className="text-center">
                <div className="text-gray-500 uppercase text-xs font-bold mb-1">Asignado</div>
                <div className="font-bold text-gray-800 text-lg">{budgetData && formatCurrency(budgetData.totals.assigned)}</div>
            </div>
            <div className="text-center">
                <div className="text-gray-500 uppercase text-xs font-bold mb-1">Actividad</div>
                <div className="font-bold text-red-600 text-lg">{budgetData && formatCurrency(budgetData.totals.activity)}</div>
            </div>
            <div className="text-center">
                <div className="text-gray-500 uppercase text-xs font-bold mb-1">Disponible</div>
                <div className={`font-bold text-lg ${
                    (budgetData && budgetData.totals.available < 0) ? 'text-red-600' : 'text-green-600'
                }`}>
                    {budgetData && formatCurrency(budgetData.totals.available)}
                </div>
            </div>
        </div>
      </Card>

      {/* Tabla de Presupuesto */}
      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Categoría</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Asignado</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actividad</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Disponible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {budgetData?.categories.map((cat) => (
              <tr key={cat.category_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {cat.category_name}
                </td>
                
                {/* Input Editable (Estilo minimalista directo en la celda) */}
                <td className="px-6 py-4 text-right">
                    <input 
                        type="number"
                        defaultValue={cat.assigned}
                        className="w-28 text-right p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== parseFloat(cat.assigned)) {
                                handleAssignmentChange(cat.category_id, val);
                            }
                        }}
                    />
                </td>

                <td className="px-6 py-4 text-sm text-right text-gray-500">
                    {formatCurrency(cat.activity)}
                </td>
                
                {/* Badge de Disponibilidad */}
                <td className="px-6 py-4 text-right">
                    <Badge color={
                        cat.available < 0 ? 'red' : 
                        cat.available > 0 ? 'green' : 'gray'
                    }>
                        {formatCurrency(cat.available)}
                    </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default BudgetView;