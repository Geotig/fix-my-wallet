import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import Select from './ui/Select'; // <--- Usamos el componente del UI Kit
import Badge from './ui/Badge';

// Recibimos la función del padre para actualizar el Sidebar
const AccountsView = ({ onAccountsChange }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');

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
        body: JSON.stringify({ name: newAccountName, account_type: newAccountType })
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
      
      // Actualizamos la lista local
      await fetchAccounts(); 
      // Actualizamos la barra lateral (App.jsx)
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
        
        // Actualizamos local y global
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
            <form onSubmit={handleCreateAccount} className="flex flex-wrap gap-4 items-end">
                <Input 
                    label="Nombre"
                    placeholder="Ej: Banco Estado"
                    required
                    containerClassName="flex-1 min-w-[200px]" // Ajuste de ancho
                    value={newAccountName} 
                    onChange={e => setNewAccountName(e.target.value)}
                />
                
                <Select 
                    label="Tipo"
                    containerClassName="w-48"
                    value={newAccountType} 
                    onChange={e => setNewAccountType(e.target.value)}
                >
                    <option value="CHECKING">Cuenta Corriente</option>
                    <option value="CREDIT">Tarjeta Crédito</option>
                    <option value="SAVINGS">Ahorro</option>
                    <option value="CASH">Efectivo</option>
                </Select>

                <Input 
                    label="Saldo Inicial"
                    type="number"
                    placeholder="0"
                    containerClassName="w-32"
                    value={initialBalance} 
                    onChange={e => setInitialBalance(e.target.value)}
                />

                <Button type="submit" variant="primary" className="bg-green-600 hover:bg-green-700">
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
            <Card key={acc.id} className="p-6 border-l-4 border-l-blue-500 flex justify-between items-center hover:shadow-md transition-shadow">
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{acc.name}</h3>
                    <Badge color="gray" className="uppercase tracking-wider text-[10px]">
                        {acc.account_type}
                    </Badge>
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