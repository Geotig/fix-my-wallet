import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import TransactionList from './components/TransactionList'
import BudgetView from './components/BudgetView'
import AccountsView from './components/AccountsView'
import Modal from './components/ui/Modal'
import TransactionForm from './components/TransactionForm'
import SettingsView from './components/SettingsView'
import { apiFetch } from './api';

function App() {
  const [view, setView] = useState('budget');
  
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null)

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)

  const fetchAllData = async () => {
    // Nota: Quitamos setError(null) al inicio para no borrar errores previos si es un refresco silencioso
    // o lo manejamos con cuidado.
    const timestamp = new Date().getTime(); 

    try {
      const [txRes, catRes, accRes] = await Promise.all([
        apiFetch(`/api/transactions/?t=${timestamp}`),
        apiFetch(`/api/categories/?t=${timestamp}`),
        apiFetch(`/api/accounts/?t=${timestamp}`)
      ]);

      if (!txRes.ok) throw new Error("Error cargando transacciones");
      
      const txData = await txRes.json();
      const catData = await catRes.json();
      const accData = await accRes.json();
      
      setTransactions(txData.results || txData);
      setCategories(catData.results || catData);
      setAccounts(accData.results || accData);

    } catch (err) {
      console.error("Error cargando datos:", err);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // --- CORRECCIÓN 1: Cargar SIEMPRE al inicio ---
  useEffect(() => {
    fetchAllData();
  }, []); // Array vacío = Ejecutar solo una vez al montar el componente

  // Auto-refresco (Polling)
  useEffect(() => {
    const interval = setInterval(() => {
        // Opcional: Podrías querer refrescar siempre, no solo en transacciones
        fetchAllData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTransactionUpdate = (updatedTx) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
  };

  const handleLinkTransfer = async (id1, id2) => {
    try {
        const res = await apiFetch('/api/transactions/link_transfer/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_1: id1, id_2: id2 })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al vincular');
        }

        await fetchAllData();
        alert("¡Transferencia vinculada!");

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true); 
    
    try {
        const res = await apiFetch('/api/trigger_sync/', {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Error en sincronización');
        await fetchAllData(); 
        
        console.log("Sincronización finalizada");

    } catch (error) {
        console.error(error);
        alert("Hubo un problema al sincronizar correos.");
    } finally {
        setIsSyncing(false); // Desactivamos spinner
    }
  };

  const renderContent = () => {
    if (view === 'budget') return <BudgetView />;
    if (view === 'settings') return <SettingsView />;
    // Pasamos fetchAllData a AccountsView para que actualice la barra lateral al editar saldos
    if (view === 'accounts') return <AccountsView onAccountsChange={fetchAllData} />; 

    return (
        <>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Transacciones</h2>
                    <p className="text-gray-600">Clasifica tus gastos importados.</p>
                </div>
                <div className="flex gap-2">
                    {/* Botón Sincronizar */}
                    <button 
                        onClick={handleManualSync}
                        disabled={isSyncing} // Deshabilitar mientras carga
                        className={`
                            text-sm px-3 py-2 rounded font-medium transition flex items-center gap-2
                            ${isSyncing 
                                ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed' 
                                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800'}
                        `}
                        title="Buscar nuevos correos ahora"
                    >
                        {isSyncing ? (
                            <>
                                {/* Icono Spinner SVG */}
                                <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Buscando...</span>
                            </>
                        ) : (
                            <>
                                <span>☁️</span>
                                <span>Sincronizar</span>
                            </>
                        )}
                    </button>

                    {/* Botón Refrescar (Local) */}
                    <button 
                        onClick={() => { setLoading(true); fetchAllData(); }}
                        className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-gray-700 font-medium transition"
                    >
                        🔄 Refrescar
                    </button>
                    
                    {/* Botón Nueva */}
                    <button 
                        onClick={() => setIsTransactionModalOpen(true)}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow transition"
                    >
                        + Nueva
                    </button>
                </div>
            </div>

            {!loading && (
                <TransactionList 
                    transactions={transactions} 
                    categories={categories} 
                    onTransactionUpdate={handleTransactionUpdate}
                    onLinkTransfer={handleLinkTransfer}
                />
            )}

            <Modal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                title="Nueva Transacción"
            >
                <TransactionForm 
                    onSuccess={() => {
                        setIsTransactionModalOpen(false);
                        fetchAllData();
                    }}
                    onCancel={() => setIsTransactionModalOpen(false)}
                />
            </Modal>
        </>
    );
  };

  return (
    // --- CORRECCIÓN 2: accounts escrito correctamente ---
    <Layout currentView={view} setView={setView} accounts={accounts}>
      {renderContent()}
    </Layout>
  )
}

export default App