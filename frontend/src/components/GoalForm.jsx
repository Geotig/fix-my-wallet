import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';

const GoalForm = ({ category, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    goal_type: 'NONE',
    goal_amount: '',
    goal_target_date: ''
  });

  useEffect(() => {
    if (category) {
      setFormData({
        goal_type: category.goal_type || 'NONE',
        goal_amount: category.goal_amount || '',
        goal_target_date: category.goal_target_date || ''
      });
    }
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
        ...formData,
        // Limpieza de datos si el tipo cambia
        goal_amount: formData.goal_type === 'NONE' ? 0 : formData.goal_amount,
        goal_target_date: formData.goal_type === 'TARGET_DATE' ? formData.goal_target_date : null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select 
        label="Tipo de Meta" 
        value={formData.goal_type} 
        onChange={e => setFormData({...formData, goal_type: e.target.value})}
      >
        <option value="NONE">Sin Meta</option>
        <option value="MONTHLY">Ahorro Mensual Fijo</option>
        <option value="TARGET_BALANCE">Mantener Saldo Mínimo</option>
        <option value="TARGET_DATE">Alcanzar Saldo para Fecha</option>
      </Select>

      {formData.goal_type !== 'NONE' && (
        <div className="space-y-4 animate-fade-in">
            <Input 
                label="Monto Objetivo" 
                type="number"
                placeholder="Ej: 50000"
                required
                value={formData.goal_amount}
                onChange={e => setFormData({...formData, goal_amount: e.target.value})}
            />

            {formData.goal_type === 'TARGET_DATE' && (
                <Input 
                    label="Fecha Límite" 
                    type="date"
                    required
                    value={formData.goal_target_date}
                    onChange={e => setFormData({...formData, goal_target_date: e.target.value})}
                />
            )}
            
            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                {formData.goal_type === 'MONTHLY' && "Debes asignar este monto cada mes."}
                {formData.goal_type === 'TARGET_BALANCE' && "El 'Disponible' debe ser siempre igual o mayor a este monto."}
                {formData.goal_type === 'TARGET_DATE' && "Calcularemos cuánto ahorrar mensualmente para llegar a la meta en esta fecha."}
            </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar Meta</Button>
      </div>
    </form>
  );
};

export default GoalForm;