import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { useLocalization } from '../contexts/LocalizationContext'; // <--- 1. Importar Contexto
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import Input from './ui/Input';
import GoalForm from './GoalForm';

const BudgetView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', is_active: true });

  // <--- 2. Usar el hook de localización
  const { formatCurrency } = useLocalization();

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
    // Usamos 'es-CL' o podrías usar la variable 'locale' del contexto si quisieras
    return dateObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  };
  
  // (La función formatCurrency local se eliminó, usamos la del hook)

  // --- LÓGICA DE GESTIÓN (CRUD) ---
  const openCreateGroup = () => {
    setModalMode('create_group');
    setFormData({ name: '', is_active: true });
    setModalOpen(true);
  };

  const openEditGroup = (group) => {
    setModalMode('edit_group');
    setSelectedItem(group);
    setFormData({ name: group.group_name, is_active: true });
    setModalOpen(true);
  };

  const openCreateCategory = (group) => {
    setModalMode('create_cat');
    setSelectedItem(group);
    setFormData({ name: '', is_active: true });
    setModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setModalMode('edit_cat');
    setSelectedItem(cat);
    setFormData({ name: cat.category_name, is_active: true });
    setModalOpen(true);
  };

  const openEditGoal = (cat) => {
    apiFetch(`/api/categories/${cat.category_id}/`).then(res => res.json()).then(realCat => {
        setSelectedItem(realCat);
        setModalMode('edit_goal');
        setModalOpen(true);
    });
  };

  const handleModalSave = async () => {
    try {
      let url = '';
      let method = 'POST';
      let body = {};

      if (modalMode === 'create_group') {
        url = '/api/groups/';
        body = { name: formData.name, order: 99 };
      } else if (modalMode === 'edit_group') {
        url = `/api/groups/${selectedItem.group_id}/`;
        method = 'PATCH';
        body = { name: formData.name, is_active: formData.is_active };
      } else if (modalMode === 'create_cat') {
        url = '/api/categories/';
        body = { name: formData.name, group: selectedItem.group_id, order: 99 };
      } else if (modalMode === 'edit_cat') {
        url = `/api/categories/${selectedItem.category_id}/`;
        method = 'PATCH';
        body = { name: formData.name, is_active: formData.is_active };
      }

      const res = await apiFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("Error al guardar");
      
      setModalOpen(false);
      fetchBudget(); 

    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleGoalSave = async (goalData) => {
    try {
        const res = await apiFetch(`/api/categories/${selectedItem.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData)
        });
        
        if (!res.ok) throw new Error("Error guardando meta");
        setModalOpen(false);
        fetchBudget(); 
    } catch (error) {
        alert(error.message);
    }
  };

  const handleAssignmentChange = async (categoryId, newAmount) => {
    let oldAssigned = 0;
    const updatedGroups = budgetData.groups.map(group => {
      const updatedCategories = group.categories.map(cat => {
        if (cat.category_id === categoryId) {
          oldAssigned = cat.assigned;
          const diff = newAmount - cat.assigned;
          return { ...cat, assigned: newAmount, available: cat.available + diff };
        }
        return cat;
      });
      return { ...group, categories: updatedCategories };
    });

    const difference = newAmount - oldAssigned;
    const newReadyToAssign = budgetData.ready_to_assign - difference;
    const newTotalAssigned = budgetData.totals.assigned + difference;
    
    setBudgetData({ 
        ...budgetData, 
        ready_to_assign: newReadyToAssign,
        groups: updatedGroups,
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

  // --- COMPONENTE VISUAL DE META (Mejorado con Localización) ---
  const GoalIndicator = ({ goal, available }) => {
    if (!goal || goal.type === 'NONE') return null;

    const isMet = goal.is_met;
    const percentage = goal.percentage || 0;
    const isOverspent = available < 0;
    const required = parseFloat(goal.required);
    
    let textColor = "text-amber-600";
    let barColor = "bg-amber-400";
    let text = goal.message; // Texto por defecto del backend

    // REGLAS DE TEXTO DINÁMICO (Frontend overrides Backend text for formatting)
    // Reconstruimos el mensaje para usar el formatCurrency del contexto actual
    
    if (isMet) {
        textColor = "text-green-600";
        barColor = "bg-green-500";
        text = "Meta Cumplida 🎉"; 
        if (goal.type === 'TARGET_DATE') text = "¡Meta lograda!";
        if (goal.type === 'TARGET_DATE' && goal.message.includes("Vas bien")) text = "Vas bien este mes 👍";
        
    } else if (isOverspent) {
        textColor = "text-red-600 font-bold";
        barColor = "bg-red-200";
        // Si hay sobregasto, el mensaje de meta pasa a segundo plano, pero mantenemos el de falta
        text = `Falta ${formatCurrency(required)}`;
    } else {
        // Estado normal: No cumplido aún
        if (goal.type === 'MONTHLY' || goal.type === 'TARGET_BALANCE') {
            text = `Falta ${formatCurrency(required)}`;
        } else if (goal.type === 'TARGET_DATE') {
            text = `Aporta ${formatCurrency(required)}`;
        }
    }

    if (goal.type === 'TARGET_DATE' && percentage >= 100) {
        textColor = "text-blue-600";
        barColor = "bg-blue-500";
    }

    return (
        <div className="mt-1.5 w-full max-w-[140px] animate-fade-in group/goal">
            <div className={`text-[10px] font-bold mb-0.5 flex justify-between ${textColor}`}>
                <span className="truncate">{text}</span>
                <span className="opacity-0 group-hover/goal:opacity-100 transition-opacity ml-1">
                    {percentage}%
                </span>
            </div>

            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
                    style={{ width: `${percentage}%` }} 
                ></div> 
            </div>
        </div>
    );
  };

  if (loading && !budgetData) return <div className="text-center py-10 text-gray-500">Cargando presupuesto...</div>;

  return (
    <div className="space-y-6">
      {/* Header RTA + Navegación */}
      <Card className="p-6 bg-white mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>&lt;</Button>
                <h2 className="text-2xl font-bold capitalize text-gray-800 w-48 text-center">
                    {formatMonth(currentDate)}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>&gt;</Button>
            </div>

            <div className={`px-6 py-3 rounded-xl border flex flex-col items-center min-w-[200px] transition-colors ${
                (budgetData?.ready_to_assign || 0) < 0 
                ? 'bg-red-50 border-red-100' 
                : 'bg-green-50 border-green-100'
            }`}>
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                     (budgetData?.ready_to_assign || 0) < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                    Por Asignar
                </span>
                <span className={`text-3xl font-extrabold ${
                    (budgetData?.ready_to_assign || 0) < 0 ? 'text-red-700' : 'text-green-700'
                }`}>
                    {/* Usando el formateador global */}
                    {budgetData && formatCurrency(budgetData.ready_to_assign)}
                </span>
            </div>
        </div>
        
        <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={openCreateGroup}>
                + Añadir Grupo
            </Button>
        </div>

        {/* Totales Secundarios */}
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
                <div className="text-gray-400 mb-1">Restante</div>
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
          <tbody className="bg-white">
            {budgetData?.groups.map((group) => (
              <React.Fragment key={group.group_id}>
                <tr className="bg-gray-100 border-t border-b border-gray-200 group">
                    <td colSpan="4" className="px-6 py-2">
                        <div className="flex items-center justify-between">
                            <span 
                                className="text-sm font-bold text-gray-700 uppercase tracking-wide cursor-pointer hover:text-blue-600 hover:underline"
                                onClick={() => openEditGroup(group)}
                            >
                                {group.group_name}
                            </span>
                            <button 
                                onClick={() => openCreateCategory(group)}
                                className="text-gray-400 hover:text-blue-600 font-bold text-lg px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                +
                            </button>
                        </div>
                    </td>
                </tr>

                {group.categories.map((cat) => (
                  <tr key={cat.category_id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group/row">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 pl-8 relative">
                        <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                                <span 
                                    className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted"
                                    onClick={() => openEditCategory(cat)}
                                >
                                    {cat.category_name}
                                </span>
                                
                                <button 
                                    onClick={() => openEditGoal(cat)}
                                    className={`transition-colors text-xs ${
                                        cat.goal.type !== 'NONE' 
                                        ? 'text-blue-400 hover:text-blue-600 opacity-100' 
                                        : 'text-gray-300 hover:text-gray-500 opacity-0 group-hover/row:opacity-100'
                                    }`}
                                    title="Editar Meta"
                                >
                                    🎯
                                </button>
                            </div>
                            
                            <GoalIndicator goal={cat.goal} available={cat.available} />
                        </div>
                    </td>
                    
                    <td className="px-6 py-3 text-right">
                        <input 
                            type="number"
                            defaultValue={cat.assigned}
                            className={`w-28 text-right p-1 border rounded focus:outline-none text-sm transition-colors
                                ${!cat.goal.is_met && cat.goal.type !== 'NONE' 
                                    ? 'border-yellow-400 bg-yellow-50 focus:ring-yellow-500 text-yellow-900' 
                                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500'}
                            `}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== parseFloat(cat.assigned)) {
                                    handleAssignmentChange(cat.category_id, val);
                                }
                            }}
                        />
                    </td>

                    <td className="px-6 py-3 text-sm text-right text-gray-500 font-mono">
                        {formatCurrency(cat.activity)}
                    </td>
                    
                    <td className="px-6 py-3 text-right">
                        <Badge color={
                            cat.available < 0 ? 'red' : 
                            cat.available > 0 ? 'green' : 'gray'
                        }>
                            {formatCurrency(cat.available)}
                        </Badge>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {/* MODAL DE GESTIÓN */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title={
            modalMode === 'edit_goal' ? `Meta: ${selectedItem?.name}` :
            modalMode === 'create_group' ? 'Crear Nuevo Grupo' :
            modalMode === 'edit_group' ? 'Editar Grupo' :
            modalMode === 'create_cat' ? 'Crear Categoría' : 'Editar Categoría'
        }
        footer={modalMode !== 'edit_goal' && (
            <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button type="submit" form="modal-form">Guardar</Button>
            </>
        )}
      >
        {modalMode === 'edit_goal' ? (
            <GoalForm 
                category={selectedItem} 
                onSave={handleGoalSave} 
                onCancel={() => setModalOpen(false)} 
            />
        ) : (
            <form 
                id="modal-form" 
                onSubmit={(e) => {
                    e.preventDefault();
                    handleModalSave();
                }} 
                className="space-y-4"
            >
                <Input 
                    label="Nombre"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                />
                
                {(modalMode === 'edit_group' || modalMode === 'edit_cat') && (
                    <div className="flex items-center gap-2 pt-2 p-3 bg-gray-50 rounded border border-gray-100">
                        <input 
                            type="checkbox" 
                            id="is_active"
                            checked={!formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: !e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Ocultar (Archivar)
                        </label>
                    </div>
                )}
            </form>
        )}
      </Modal>
    </div>
  );
};

export default BudgetView;