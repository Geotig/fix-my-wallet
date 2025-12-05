import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';

const AccountsView = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  // Estado para formulario de nueva cuenta
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/accounts/');
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
    try {
      // 1. Crear la cuenta
      const res = await apiFetch('/api/accounts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName, account_type: newAccountType })
      });
      
      if (!res.ok) throw new Error('Error creando cuenta');
      const account = await res.json();

      // 2. Si pusieron saldo inicial, hacer reconciliación inmediata
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
      fetchAccounts(); // Recargar lista
    } catch (error) {
        console.error(error);
        alert("Error al crear cuenta");
    }
  };

    const handleReconcile = async (accountId) => {
        // 1. Pedir el dato
        const targetStr = prompt("Ingresa el SALDO REAL actual (sin puntos):");
        if (targetStr === null) return;

        // 2. Limpiar el dato (por si el usuario puso "1.000.000")
        const targetClean = targetStr.replace(/\./g, '').replace(/,/g, '.');

        try {
            // 3. Enviar al Backend y ESPERAR (await) a que termine
            const res = await apiFetch(`/api/accounts/${accountId}/reconcile/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_balance: targetClean })
            });
            
            if (!res.ok) throw new Error('Error en API');
            
            // 4. ¡EL TRUCO! Recargar la lista inmediatamente después
            await fetchAccounts(); 
            
        } catch (error) {
            console.error(error);
            alert("Error al actualizar saldo");
        }
    };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-800">Mis Cuentas</h2>
        <button 
            onClick={() => setShowCreate(!showCreate)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
            {showCreate ? 'Cancelar' : '+ Nueva Cuenta'}
        </button>
      </div>

      {/* Formulario de Creación */}
      {showCreate && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <form onSubmit={handleCreateAccount} className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Nombre</label>
                    <input 
                        type="text" required 
                        className="p-2 border rounded w-48"
                        placeholder="Ej: Banco Estado"
                        value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Tipo</label>
                    <select 
                        className="p-2 border rounded w-40"
                        value={newAccountType} onChange={e => setNewAccountType(e.target.value)}
                    >
                        <option value="CHECKING">Cuenta Corriente</option>
                        <option value="CREDIT">Tarjeta Crédito</option>
                        <option value="SAVINGS">Ahorro</option>
                        <option value="CASH">Efectivo</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Saldo Inicial</label>
                    <input 
                        type="number" 
                        className="p-2 border rounded w-32"
                        placeholder="0"
                        value={initialBalance} onChange={e => setInitialBalance(e.target.value)}
                    />
                </div>
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    Guardar
                </button>
            </form>
        </div>
      )}

      {/* Lista de Cuentas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p>Cargando...</p> : accounts.map(acc => (
            <div key={acc.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg">{acc.name}</h3>
                    <p className="text-gray-500 text-sm">{acc.account_type}</p>
                </div>
                <div className="text-right">
                    <div className={`text-xl font-bold ${acc.current_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(acc.current_balance)}
                    </div>
                    <button 
                        onClick={() => handleReconcile(acc.id)}
                        className="text-xs text-blue-600 hover:underline mt-1"
                    >
                        Ajustar Saldo
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default AccountsView;