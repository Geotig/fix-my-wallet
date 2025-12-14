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
    destination_account: '',
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

  const isDestinationOffBudget = () => {
    if (formData.type !== 'transfer' || !formData.destination_account) return false;
    const destAcc = accounts.find(a => a.id == formData.destination_account);
    return destAcc ? destAcc.off_budget : false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // --- LÓGICA TRANSFERENCIA ---
      if (formData.type === 'transfer') {
        const payload = {
            source_account: formData.account,
            destination_account: formData.destination_account,
            amount: formData.amount,
            date: formData.date,
            memo: formData.memo,
            category: formData.category
        };

        const res = await apiFetch('/api/transactions/create_transfer/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Error creando transferencia");
        }

      } else {
        // --- LÓGICA GASTO/INGRESO (Existente) ---
        const existingPayee = payees.find(p => p.name.toLowerCase() === formData.payee_text.toLowerCase());
        const absAmount = Math.abs(parseFloat(formData.amount));
        const finalAmount = formData.type === 'expense' ? -absAmount : absAmount;

        const payload = {
            date: formData.date,
            amount: finalAmount,
            account: formData.account,
            category: formData.category || null,
            memo: formData.memo,
            payee: existingPayee ? existingPayee.id : null,
            payee_name: existingPayee ? null : formData.payee_text
        };

        const res = await apiFetch('/api/transactions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar");
      }
      
      onSuccess(); 

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
      
      {/* TABS DE TIPO */}
      <div className="flex bg-gray-100 p-1 rounded-lg">
        {['expense', 'income', 'transfer'].map(type => (
            <button
                key={type}
                type="button"
                onClick={() => handleChange('type', type)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    formData.type === type 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Transferencia'}
            </button>
        ))}
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

      {/* CAMPOS DINÁMICOS SEGÚN TIPO */}
      
      {formData.type === 'transfer' ? (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="grid grid-cols-2 gap-4">
                <Select 
                    label="Desde (Origen)"
                    required
                    value={formData.account}
                    onChange={e => handleChange('account', e.target.value)}
                >
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </Select>

                <Select 
                    label="Hacia (Destino)"
                    required
                    value={formData.destination_account}
                    onChange={e => handleChange('destination_account', e.target.value)}
                >
                    <option value="">Seleccionar...</option>
                    {accounts
                        .filter(a => a.id !== parseInt(formData.account))
                        .map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)
                    }
                </Select>
            </div>

            {/* MOSTRAR SOLO SI EL DESTINO ES OFF-BUDGET */}
            {isDestinationOffBudget() && (
                <div className="animate-fade-in">
                    <Select 
                        label="Categoría (Requerido para Tracking)"
                        value={formData.category}
                        onChange={e => handleChange('category', e.target.value)}
                        className="bg-white border-blue-300"
                    >
                        <option value="">Seleccionar Categoría...</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </Select>
                    <p className="text-xs text-blue-600 mt-1">
                        Al transferir a una cuenta de seguimiento, el dinero sale de tu presupuesto, por lo que requiere categoría.
                    </p>
                </div>
            )}
        </div>
      ) : (
        // --- CAMPOS NORMALES ---
        <>
            <Combobox 
                id="payee"
                label="Payee (Comercio)"
                placeholder="Ej: Lider..."
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
        </>
      )}

      <Input 
        label="Memo (Opcional)" 
        placeholder="Notas..."
        value={formData.memo}
        onChange={e => handleChange('memo', e.target.value)}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear'}
        </Button>
      </div>
    </form>
  );
};

export default TransactionForm;