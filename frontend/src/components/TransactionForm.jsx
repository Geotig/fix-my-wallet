import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Combobox from './ui/Combobox';

const TransactionForm = ({ onSuccess, onCancel }) => {
  // Datos maestros
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payees, setPayees] = useState([]);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Fecha de hoy YYYY-MM-DD
    payee_text: '',
    account: '',
    category: '',
    amount: '',
    memo: '',
    type: 'expense' // 'expense' | 'income'
  });

  const [loading, setLoading] = useState(false);

  // Cargar listas al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        const [accRes, catRes, payRes] = await Promise.all([
          apiFetch('/api/accounts/'),
          apiFetch('/api/categories/'),
          apiFetch('/api/payees/')
        ]);
        
        const accData = await accRes.json();
        const catData = await catRes.json();
        const payData = await payRes.json();

        setAccounts(accData.results || accData);
        setCategories(catData.results || catData);
        setPayees(payData.results || payData);

        // Pre-seleccionar la primera cuenta si existe
        if (accData.results?.length > 0) {
            setFormData(prev => ({ ...prev, account: accData.results[0].id }));
        }
      } catch (error) {
        console.error("Error cargando listas:", error);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Lógica del Payee: ¿Existe o es nuevo?
      const existingPayee = payees.find(p => p.name.toLowerCase() === formData.payee_text.toLowerCase());
      
      // 2. Lógica del Monto: Gasto (-) vs Ingreso (+)
      const absAmount = Math.abs(parseFloat(formData.amount));
      const finalAmount = formData.type === 'expense' ? -absAmount : absAmount;

      // 3. Construir Payload
      const payload = {
        date: formData.date,
        amount: finalAmount,
        account: formData.account,
        category: formData.category || null,
        memo: formData.memo,
        // Si existe el payee, mandamos su ID. Si no, mandamos el texto como payee_name
        payee: existingPayee ? existingPayee.id : null,
        payee_name: existingPayee ? null : formData.payee_text
      };

      // 4. Enviar
      const res = await apiFetch('/api/transactions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error al guardar");
      
      onSuccess(); // Cerrar modal y refrescar

    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      {/* Botones de Tipo (Gasto / Ingreso) */}
      <div className="flex gap-2 justify-center mb-4">
        <button
            type="button"
            onClick={() => handleChange('type', 'expense')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                formData.type === 'expense' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-gray-100 text-gray-500'
            }`}
        >
            Gasto
        </button>
        <button
            type="button"
            onClick={() => handleChange('type', 'income')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                formData.type === 'income' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500'
            }`}
        >
            Ingreso
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input 
            label="Fecha" 
            type="date" 
            required
            value={formData.date}
            onChange={e => handleChange('date', e.target.value)}
        />
        <Input 
            label="Monto" 
            type="number" 
            step="1"
            required
            placeholder="0"
            value={formData.amount}
            onChange={e => handleChange('amount', e.target.value)}
        />
      </div>

      <Combobox 
        id="payee"
        label="Payee (Comercio)"
        placeholder="Ej: Lider, Uber, Kiosco..."
        options={payees}
        value={formData.payee_text}
        onChange={e => handleChange('payee_text', e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Select 
            label="Cuenta"
            required
            value={formData.account}
            onChange={e => handleChange('account', e.target.value)}
        >
            <option value="">Seleccionar...</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
        </Select>

        <Select 
            label="Categoría"
            value={formData.category}
            onChange={e => handleChange('category', e.target.value)}
        >
            <option value="">-- Sin Asignar --</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </Select>
      </div>

      <Input 
        label="Memo (Opcional)" 
        placeholder="Notas..."
        value={formData.memo}
        onChange={e => handleChange('memo', e.target.value)}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear Transacción'}
        </Button>
      </div>
    </form>
  );
};

export default TransactionForm;