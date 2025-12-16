import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import TransactionList from './components/TransactionList'
import BudgetView from './components/BudgetView'
import AccountsView from './components/AccountsView'
import Modal from './components/ui/Modal'
import TransactionForm from './components/TransactionForm'
import FileImportModal from './components/FileImportModal'
import SettingsView from './components/SettingsView';
import ReportsView from './components/ReportsView'
import { apiFetch, API_URL } from './api'; // Importamos API_URL para limpiar links

function App() {
  const [view, setView] = useState('budget');
  
  const [transactions, setTransactions] = useState([])
  // Estado de Paginación
  const [pagination, setPagination] = useState({ next: null, previous: null, count: 0 });
  
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [isFileImportOpen, setIsFileImportOpen] = useState(false);

  // Función maestra de carga
  const fetchAllData = async (urlOverride = null) => {
    const timestamp = new Date().getTime(); 
    
    // Si viene urlOverride, es solo para paginar transacciones.
    // Si es null, cargamos TODO (inicio o refresco completo).
    const isFullRefresh = urlOverride === null;

    try {
      const promises = [];
      
      // 1. URL de Transacciones
      let txUrl = '/api/transactions/';
      if (urlOverride) {
        // La API devuelve http://localhost:8000/api/..., necesitamos limpiarla si usamos apiFetch
        // O simplemente usamos fetch directo si es absoluta.
        // Estrategia segura: Si es absoluta, usamos esa. Si no, la default.
        txUrl = urlOverride;
      }
      
      // Truco para query params existentes
      const separator = txUrl.includes('?') ? '&' : '?';
      const finalTxUrl = `${txUrl}${separator}t=${timestamp}`;

      // Si es full refresh, cargamos todo. Si no, solo transacciones.
      if (isFullRefresh) {
          promises.push(apiFetch(finalTxUrl)); // 0: Transacciones
          promises.push(apiFetch(`/api/categories/?t=${timestamp}`)); // 1: Categorías
          promises.push(apiFetch(`/api/accounts/?t=${timestamp}`)); // 2: Cuentas
      } else {
          // Solo paginación: Usamos fetch directo si la URL es absoluta para evitar doble base url
          if (txUrl.startsWith('http')) {
             promises.push(fetch(finalTxUrl));
          } else {
             promises.push(apiFetch(finalTxUrl));
          }
      }

      const responses = await Promise.all(promises);
      
      // Verificamos errores
      for (const res of responses) {
          if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      }

      // Procesar Transacciones
      const txData = await responses[0].json();
      setTransactions(txData.results || txData);
      setPagination({
          next: txData.next,
          previous: txData.previous,
          count: txData.count
      });

      // Procesar el resto SOLO si fue Full Refresh
      if (isFullRefresh) {
          const catData = await responses[1].json();
          const accData = await responses[2].json();
          setCategories(catData.results || catData);
          setAccounts(accData.results || accData);
      }

    } catch (err) {
      console.error("Error cargando datos:", err);
      // Solo mostramos error visual si es la carga inicial
      if (loading) setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Carga Inicial
  useEffect(() => {
    fetchAllData();
  }, []);

  // Polling (Auto-refresco)
  useEffect(() => {
    const interval = setInterval(() => {
        // Solo refrescar automáticamente si estamos en la primera página
        // para no saltarle la página al usuario mientras lee el historial
        if (!pagination.previous) {
            fetchAllData();
        }
    }, 30000);
    return () => clearInterval(interval);
  }, [pagination.previous]); // Dependencia para saber si estamos en pág 1

  const handlePageChange = (url) => {
      if (url) fetchAllData(url);
  };

  // ... (handleTransactionUpdate, handleLinkTransfer, handleManualSync IGUALES) ...
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
        await fetchAllData(); // Full refresh para actualizar saldos también
        alert("¡Transferencia vinculada!");
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
        const res = await apiFetch('/api/trigger_sync/', { method: 'POST' });
        if (!res.ok) throw new Error('Error en sincronización');
        await fetchAllData(); 
    } catch (error) {
        alert("Hubo un problema al sincronizar correos.");
    } finally {
        setIsSyncing(false);
    }
  };

  const renderContent = () => {
    if (view === 'budget') return <BudgetView />;
    if (view === 'accounts') return <AccountsView onAccountsChange={() => fetchAllData()} />; 
    if (view === 'settings') return <SettingsView />;
    if (view === 'reports') return <ReportsView />;

    return (
        <>
            <div className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Transacciones</h2>
                    <p className="text-sm text-gray-600">Clasifica tus gastos importados.</p>
                </div>
                
                {/* BARRA DE HERRAMIENTAS RESPONSIVA */}
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    
                    {/* Botón Sincronizar (Icono en móvil, Texto en PC) */}
                    <button 
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className={`flex-1 md:flex-none justify-center text-sm px-3 py-2 rounded font-medium transition flex items-center gap-2 whitespace-nowrap
                            ${isSyncing ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800'}
                        `}
                        title="Sincronizar correos"
                    >
                        {isSyncing ? (
                            /* SVG del Spinner explícito */
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <span>☁️</span>
                        )}
                        <span className="hidden md:inline">{isSyncing ? 'Buscando...' : 'Sincronizar'}</span>
                    </button>

                    {/* Botón Refrescar */}
                    <button 
                        onClick={() => { setLoading(true); fetchAllData(); }}
                        className="flex-1 md:flex-none justify-center text-sm bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-gray-700 font-medium transition flex items-center gap-2"
                        title="Refrescar datos"
                    >
                        <span>🔄</span>
                        <span className="hidden md:inline">Refrescar</span>
                    </button>
                    
                    {/* Botón Importar */}
                    <button 
                        onClick={() => setIsFileImportOpen(true)}
                        className="flex-1 md:flex-none justify-center text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded font-medium transition flex items-center gap-2"
                        title="Importar Excel/CSV"
                    >
                        <span>📂</span>
                        <span className="hidden md:inline">Importar</span>
                    </button>

                    {/* Botón Nueva (Texto visible siempre porque es la acción principal) */}
                    <button 
                        onClick={() => setIsTransactionModalOpen(true)}
                        className="flex-1 md:flex-none justify-center text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold shadow transition flex items-center gap-2 whitespace-nowrap"
                    >
                        <span>+</span>
                        <span>Nueva</span>
                    </button>
                </div>
            </div>

            {!loading && (
                <>
                    <TransactionList 
                        transactions={transactions} 
                        categories={categories} 
                        onTransactionUpdate={handleTransactionUpdate}
                        onLinkTransfer={handleLinkTransfer}
                    />
                    
                    {/* PAGINACIÓN */}
                    <div className="flex justify-between items-center mt-4 bg-white p-3 rounded shadow-sm">
                        <span className="text-sm text-gray-500">
                            Total: {pagination.count} transacciones
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.previous)}
                                disabled={!pagination.previous}
                                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                            >
                                &lt; Anterior
                            </button>
                            <button
                                onClick={() => handlePageChange(pagination.next)}
                                disabled={!pagination.next}
                                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                            >
                                Siguiente &gt;
                            </button>
                        </div>
                    </div>
                </>
            )}

            <Modal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                title="Nueva Transacción"
            >
                <TransactionForm 
                    onSuccess={() => { setIsTransactionModalOpen(false); fetchAllData(); }}
                    onCancel={() => setIsTransactionModalOpen(false)}
                />
            </Modal>

            <FileImportModal 
                isOpen={isFileImportOpen}
                onClose={() => setIsFileImportOpen(false)}
                accounts={accounts}
                onSuccess={() => fetchAllData()}
            />
        </>
    );
  };

  return (
    <Layout currentView={view} setView={setView} accounts={accounts}>
      {renderContent()}
    </Layout>
  )
}

export default App