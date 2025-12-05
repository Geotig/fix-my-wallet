import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

const BudgetView = () => {
  const [currentDate, setCurrentDate] = useState(new Date()); // Fecha actual por defecto
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formato para enviar a la API (YYYY-MM-DD)
  const getApiDateString = (dateObj) => {
    return dateObj.toISOString().split('T')[0];
  };

  // Cargar datos
  const fetchBudget = async () => {
    setLoading(true);
    const dateStr = getApiDateString(currentDate);
    try {
      const res = await apiFetch(`/api/budget_summary/?month=${dateStr}`);
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
  }, [currentDate]); // Recargar si cambia la fecha

  // Cambiar mes
  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  // Formateadores
  const formatMonth = (dateObj) => {
    return dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  // Manejar cambio en "Asignado" (Guardar en Backend)
  const handleAssignmentChange = async (categoryId, newAmount) => {
    // 1. Actualización Optimista (UI primero)
    const updatedCategories = budgetData.categories.map(cat => {
      if (cat.category_id === categoryId) {
        const diff = newAmount - cat.assigned;
        return { 
            ...cat, 
            assigned: newAmount, 
            available: cat.available + diff 
        };
      }
      return cat;
    });
    
    // Recalcular totales locales (simplificado para la UI)
    const newTotalAssigned = updatedCategories.reduce((acc, curr) => acc + Number(curr.assigned), 0);
    
    setBudgetData({ 
        ...budgetData, 
        categories: updatedCategories,
        totals: { ...budgetData.totals, assigned: newTotalAssigned }
    });

    // 2. Enviar al Backend
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
      // Opcional: fetchBudget() de nuevo para asegurar sincronización total
    } catch (error) {
      console.error("Error guardando asignación:", error);
      alert("Error al guardar el cambio");
      fetchBudget(); // Revertir cambios en error
    }
  };

  if (loading && !budgetData) return <div>Cargando presupuesto...</div>;

  return (
    <div className="space-y-6">
      {/* Header de Navegación y Resumen */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-center">
        
        {/* Navegación Mes */}
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            &lt;
          </button>
          <h2 className="text-xl font-bold capitalize w-48 text-center">{formatMonth(currentDate)}</h2>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full">
            &gt;
          </button>
        </div>

        {/* Resumen Totales */}
        <div className="flex space-x-8 text-sm">
            <div className="text-center">
                <div className="text-gray-500">Asignado</div>
                <div className="font-bold text-gray-800">{budgetData && formatCurrency(budgetData.totals.assigned)}</div>
            </div>
            <div className="text-center">
                <div className="text-gray-500">Actividad</div>
                <div className="font-bold text-red-600">{budgetData && formatCurrency(budgetData.totals.activity)}</div>
            </div>
            <div className="text-center">
            <div className="text-gray-500">Disponible</div>
            {/* Lógica condicional para el color del total global */}
            <div className={`font-bold ${
                (budgetData && budgetData.totals.available < 0) ? 'text-red-600' : 'text-green-600'
            }`}>
                {budgetData && formatCurrency(budgetData.totals.available)}
            </div>
        </div>
        </div>
      </div>

      {/* Tabla de Presupuesto */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Asignado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actividad</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Disponible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {budgetData?.categories.map((cat) => (
              <tr key={cat.category_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.category_name}</td>
                
                {/* Input Editable de Asignado */}
                <td className="px-6 py-4 text-right">
                    <input 
                        type="number"
                        defaultValue={cat.assigned}
                        className="w-24 text-right p-1 border rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.target.blur(); // Quitar foco para disparar onBlur
                            }
                        }}
                        onBlur={(e) => {
                            // Solo guardar si el valor cambió
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
                
                {/* Columna Disponible con Colores */}
                <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold
                        ${cat.available < 0 ? 'bg-red-100 text-red-800' : 
                          cat.available > 0 ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-500'}`}>
                        {formatCurrency(cat.available)}
                    </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetView;