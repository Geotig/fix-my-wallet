import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import Select from './ui/Select';
import Badge from './ui/Badge';

const AccountsView = ({ onAccountsChange }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('CHECKING');
  const [newAccountOffBudget, setNewAccountOffBudget] = useState(false); // <--- NUEVO ESTADO
  const [initialBalance, setInitialBalance] = useState('');

  // Efecto para "sugerir" el estado de off-budget según el tipo
  useEffect(() => {
    if (['ASSET', 'LOAN'].includes(newAccountType)) {
        setNewAccountOffBudget(true);
    } else {
        setNewAccountOffBudget(false);
    }
  }, [newAccountType]);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch('/api/accounts/', { headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      setAccounts(data.results || data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/accounts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: newAccountName, 
            account_type: newAccountType,
            identifier: '', // Opcional, lo dejamos vacío por ahora o agregas el input
            off_budget: newAccountOffBudget // <--- ENVIAMOS EL VALOR DEL CHECKBOX
        })
      });
      
      if (!res.ok) throw new Error('Error creando cuenta');
      const account = await res.json();

      if (initialBalance && initialBalance !== '0') {
        await apiFetch(`/api/accounts/${account.id}/reconcile/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_balance: initialBalance })
        });
      }

      setShowCreate(false);
      setNewAccountName('');
      setInitialBalance('');
      // Resetear defaults
      setNewAccountType('CHECKING'); 
      
      await fetchAccounts(); 
      if (onAccountsChange) onAccountsChange();

    } catch (error) {
      console.error(error);
      alert("Error al crear cuenta");
    } finally {
        setLoading(false);
    }
  };

  const handleReconcile = async (accountId) => {
    const targetStr = prompt("Ingresa el SALDO REAL actual (sin puntos):");
    if (targetStr === null) return;
    const targetClean = targetStr.replace(/\./g, '').replace(/,/g, '.');

    try {
        const res = await apiFetch(`/api/accounts/${accountId}/reconcile/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_balance: targetClean })
        });
        if (!res.ok) throw new Error('Error en API');
        
        await fetchAccounts();
        if (onAccountsChange) onAccountsChange();
    } catch (error) {
        alert("Error al actualizar saldo");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Mis Cuentas</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancelar' : '+ Nueva Cuenta'}
        </Button>
      </Card>

      {showCreate && (
        <Card className="p-4 bg-blue-50 border-blue-100 animate-fade-in">
            <form onSubmit={handleCreateAccount} className="flex flex-wrap gap-6 items-end">
                <Input 
                    label="Nombre"
                    placeholder="Ej: Inversiones Fintual"
                    required
                    containerClassName="flex-1 min-w-[200px]"
                    value={newAccountName} 
                    onChange={e => setNewAccountName(e.target.value)}
                />
                
                <div className="flex flex-col gap-2">
                    <Select 
                        label="Tipo"
                        containerClassName="w-48"
                        value={newAccountType} 
                        onChange={e => setNewAccountType(e.target.value)}
                    >
                        <optgroup label="Presupuesto (On-Budget)">
                            <option value="CHECKING">Cuenta Corriente</option>
                            <option value="CREDIT">Tarjeta Crédito</option>
                            <option value="SAVINGS">Ahorro</option>
                            <option value="CASH">Efectivo</option>
                        </optgroup>
                        <optgroup label="Seguimiento (Off-Budget)">
                            <option value="ASSET">Activo / Inversión</option>
                            <option value="LOAN">Préstamo / Deuda</option>
                        </optgroup>
                    </Select>

                    {/* CHECKBOX MANUAL */}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={newAccountOffBudget}
                            onChange={(e) => setNewAccountOffBudget(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Off-Budget (Seguimiento)</span>
                    </label>
                </div>

                <Input 
                    label="Saldo Inicial"
                    type="number"
                    placeholder="0"
                    containerClassName="w-32"
                    value={initialBalance} 
                    onChange={e => setInitialBalance(e.target.value)}
                />

                <Button type="submit" variant="primary" className="bg-green-600 hover:bg-green-700 h-10 mb-0.5">
                    Guardar
                </Button>
            </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {!loading && accounts.length === 0 && (
            <div className="col-span-full text-center py-10">
                <p className="text-gray-500">No tienes cuentas registradas.</p>
            </div>
        )}

        {accounts.map(acc => (
            <Card key={acc.id} className={`p-6 border-l-4 flex justify-between items-center hover:shadow-md transition-shadow ${
                acc.off_budget ? 'border-gray-400 bg-gray-50' : 'border-blue-500'
            }`}>
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{acc.name}</h3>
                    <div className="flex gap-2 mt-1">
                        <Badge color="gray" className="uppercase tracking-wider text-[10px]">
                            {acc.account_type}
                        </Badge>
                        {acc.off_budget && (
                            <Badge color="yellow" className="text-[10px]">
                                TRACKING
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-xl font-bold ${acc.current_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(acc.current_balance)}
                    </div>
                    <Button variant="link" size="sm" onClick={() => handleReconcile(acc.id)}>
                        Ajustar Saldo
                    </Button>
                </div>
            </Card>
        ))}
      </div>
    </div>
  );
};

export default AccountsView;