import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import TransactionList from './components/TransactionList'
import BudgetView from './components/BudgetView'
import AccountsView from './components/AccountsView'
import { apiFetch } from './api';

function App() {
  const [view, setView] = useState('budget');
  
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // <--- Nuevo estado para errores

  const fetchAllData = async () => {
      setError(null);
      let txData = [];
      let catData = [];

      // 1. Cargar Transacciones
      try {
        console.log("Cargando Transacciones...");
        const txRes = await apiFetch('/api/transactions/', { headers: { 'Cache-Control': 'no-cache' } });
        if (!txRes.ok) throw new Error(`Error HTTP Transacciones: ${txRes.status}`);
        const data = await txRes.json();
        txData = data.results || data;
        setTransactions(txData);
      } catch (err) {
        console.error("Fallo Transacciones:", err);
        // No seteamos error aquí para intentar cargar categorías de todas formas
      }

      // 2. Cargar Categorías
      try {
        console.log("Cargando Categorías...");
        const catRes = await apiFetch('/api/categories/', { headers: { 'Cache-Control': 'no-cache' } });
        if (!catRes.ok) throw new Error(`Error HTTP Categorías: ${catRes.status}`);
        const data = await catRes.json();
        catData = data.results || data;
        setCategories(catData);
      } catch (err) {
        console.error("Fallo Categorías:", err);
      }

      setLoading(false);
      
      // Si ambas están vacías, asumimos que hubo un error de red general
      if (txData.length === 0 && catData.length === 0) {
          setError("No se pudo conectar con el servidor. Revisa si el backend está corriendo.");
      }
  };

  // Cargar al inicio y al cambiar vista
  useEffect(() => {
    if (view === 'transactions') {
        fetchAllData();
    }
  }, [view]);

  // Auto-refresco
  useEffect(() => {
    const interval = setInterval(() => {
        if (view === 'transactions') {
            // Nota: Aquí podrías hacer fetch silencioso sin cambiar loading
            fetchAllData();
        }
    }, 30000);
    return () => clearInterval(interval);
  }, [view]);

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

        // Recargar datos para ver los cambios (iconos, etc)
        await fetchAllData();
        alert("¡Transferencia vinculada!");

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
  };

  const renderContent = () => {
    if (view === 'budget') return <BudgetView />;
    if (view === 'accounts') return <AccountsView />; 

    return (
        <>
            <div className="mb-6 flex justify-between items-center">
                <div>
                <h2 className="text-3xl font-bold text-gray-800">Transacciones</h2>
                <p className="text-gray-600">Clasifica tus gastos importados.</p>
                </div>
                {/* Botón manual para probar refresco */}
                <button 
                    onClick={fetchAllData}
                    className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-700"
                >
                    Refrescar Ahora
                </button>
            </div>

            {/* Muestra el error si existe */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-bold">Ocurrió un error:</p>
                    <p>{error}</p>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10 text-gray-500">Cargando datos...</div>
            ) : (
                <TransactionList 
                    transactions={transactions} 
                    categories={categories} 
                    onTransactionUpdate={handleTransactionUpdate} 
                    onLinkTransfer={handleLinkTransfer}
                />
            )}
        </>
    );
  };

  return (
    <Layout currentView={view} setView={setView}>
      {renderContent()}
    </Layout>
  )
}

export default App