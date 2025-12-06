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
    const oldCategory = budgetData.categories.find(c => c.category_id === categoryId);
    if (!oldCategory) return;
    
    const difference = newAmount - oldCategory.assigned;

    const updatedCategories = budgetData.categories.map(cat => {
      if (cat.category_id === categoryId) {
        return { 
            ...cat, 
            assigned: newAmount, 
            available: cat.available + difference
        };
      }
      return cat;
    });
    
    const newReadyToAssign = budgetData.ready_to_assign - difference;
    const newTotalAssigned = budgetData.totals.assigned + difference;
    
    setBudgetData({ 
        ...budgetData, 
        ready_to_assign: newReadyToAssign, // <--- AQUÍ ESTABA EL FALTANTE
        categories: updatedCategories,
        totals: { 
            ...budgetData.totals, 
            assigned: newTotalAssigned 
        }
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
      {/* Header: Navegación y RTA */}
      <Card className="p-6 bg-white mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              
              {/* Navegación Mes (Izquierda) */}
              <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>&lt;</Button>
                  <h2 className="text-2xl font-bold capitalize text-gray-800 w-48 text-center">
                      {formatMonth(currentDate)}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>&gt;</Button>
              </div>

              {/* EL NÚMERO MÁGICO (Centro/Derecha) */}
              <div className="bg-blue-50 px-6 py-3 rounded-xl border border-blue-100 flex flex-col items-center min-w-[200px]">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                      Por Asignar
                  </span>
                  <span className={`text-3xl font-extrabold ${
                      (budgetData?.ready_to_assign || 0) < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                      {budgetData && formatCurrency(budgetData.ready_to_assign)}
                  </span>
              </div>

          </div>

          {/* Totales Secundarios (Abajo, más discretos) */}
          <div className="flex justify-center space-x-12 mt-6 pt-6 border-t border-gray-100 text-sm">
              <div className="text-center">
                  <div className="text-gray-400 mb-1">Total Asignado</div>
                  <div className="font-semibold text-gray-700">{budgetData && formatCurrency(budgetData.totals.assigned)}</div>
              </div>
              <div className="text-center">
                  <div className="text-gray-400 mb-1">Total Gastado</div>
                  <div className="font-semibold text-red-600">{budgetData && formatCurrency(budgetData.totals.activity)}</div>
              </div>
              <div className="text-center">
                  <div className="text-gray-400 mb-1">Restante Categorías</div>
                  <div className="font-semibold text-gray-700">{budgetData && formatCurrency(budgetData.totals.available)}</div>
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