import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';

const Layout = ({ children, currentView, setView, accounts = [] }) => {
  
  const { formatCurrency } = useLocalization();

  console.log("Cuentas recibidas en Layout:", accounts);

  const navItemClass = (viewName, isMobile = false) => {
    const isActive = currentView === viewName;
    const base = "cursor-pointer transition-colors duration-200";
    
    if (isMobile) {
      return `${base} flex flex-col items-center justify-center w-full py-2 ${
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
      }`;
    } else {
      return `${base} block py-2 px-4 rounded text-sm font-medium ${
        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`;
    }
  };

  // Filtrar cuentas por grupo
  // 1. Presupuesto: On-Budget y que NO sean Crédito (Checking, Cash, Savings)
  const budgetAccounts = accounts.filter(a => !a.off_budget && ['CHECKING', 'SAVINGS', 'CASH'].includes(a.account_type));
  
  // 2. Deuda Presupuestada: Tarjetas de Crédito On-Budget
  const creditAccounts = accounts.filter(a => !a.off_budget && a.account_type === 'CREDIT');
  
  // 3. Seguimiento (Tracking): Cualquier cuenta Off-Budget (Activos o Pasivos)
  const trackingAccounts = accounts.filter(a => a.off_budget);

  // Calcular totales (El Net Worth sería la suma de todo)
  const totalBudget = budgetAccounts.reduce((acc, curr) => acc + parseFloat(curr.current_balance), 0);
  const totalTracking = trackingAccounts.reduce((acc, curr) => acc + parseFloat(curr.current_balance), 0);
  
  // Renderizador de lista de cuentas pequeña
  const AccountListItem = ({ account }) => (
    <div className="flex justify-between items-center py-1.5 px-4 text-sm text-gray-600 hover:bg-gray-50 cursor-default transition-colors">
      <span className="truncate pr-2">{account.name}</span>
      <span className={`font-mono text-xs ${account.current_balance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
        {formatCurrency(account.current_balance)}
      </span>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 flex-col md:flex-row font-sans">
      
      {/* --- SIDEBAR DESKTOP --- */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col flex-shrink-0 z-10">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-xl font-extrabold text-blue-600 tracking-tight">FixMyWallet</h1>
        </div>
        
        {/* Agregamos 'flex flex-col' al nav para poder empujar items al fondo */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col">
          
          {/* Menú Principal */}
          <div className="px-3 space-y-1 mb-8">
            <div onClick={() => setView('budget')} className={navItemClass('budget')}>
              Presupuesto
            </div>
            <div onClick={() => setView('transactions')} className={navItemClass('transactions')}>
              Transacciones
            </div>
            <div onClick={() => setView('accounts')} className={navItemClass('accounts')}>
              Gestión de Cuentas
            </div>
            <div onClick={() => setView('reports')} className={navItemClass('reports')}>
              Reportes
            </div>
          </div>

          {/* Sección: Cuentas Presupuestables */}
          {budgetAccounts.length > 0 && (
            <div className="mb-6">
              <div className="px-4 mb-2 flex justify-between items-end">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cuentas</h3>
                <span className="text-xs font-bold text-gray-800">{formatCurrency(totalBudget)}</span>
              </div>
              {budgetAccounts.map(acc => <AccountListItem key={acc.id} account={acc} />)}
            </div>
          )}

          {/* Sección: Tarjetas / Deudas */}
          {creditAccounts.length > 0 && (
            <div className="mb-6">
              <div className="px-4 mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tarjetas y Deuda</h3>
              </div>
              {creditAccounts.map(acc => <AccountListItem key={acc.id} account={acc} />)}
            </div>
          )}

          {/* Sección: Tracking / Inversiones / Préstamos */}
          {trackingAccounts.length > 0 && (
            <div className="mb-6">
              <div className="px-4 mb-2 flex justify-between items-end">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Seguimiento</h3>
                <span className="text-xs font-bold text-gray-500">{formatCurrency(totalTracking)}</span>
              </div>
              {trackingAccounts.map(acc => <AccountListItem key={acc.id} account={acc} />)}
            </div>
          )}

          {/* --- ZONA INFERIOR --- */}
          {/* mt-auto empuja esto al fondo del espacio disponible */}
          <div className="mt-auto px-3 pt-6 border-t border-gray-50 pb-4">
            <div onClick={() => setView('settings') } className={navItemClass('settings')} >
              ⚙️ Configuración
            </div>
          </div>

        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 text-xs text-gray-400 text-center bg-gray-50">
            v0.7.1-alpha
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
            {children}
        </div>
      </main>

      {/* --- BOTTOM NAVIGATION (Móvil) --- */}
      {/* (Se mantiene igual que antes) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center z-50 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <div onClick={() => setView('budget')} className={navItemClass('budget', true)}>
          <span className="text-xl mb-0.5">💰</span>
          <span className="text-[10px] font-bold">Presupuesto</span>
        </div>
        <div onClick={() => setView('transactions')} className={navItemClass('transactions', true)}>
          <span className="text-xl mb-0.5">📄</span>
          <span className="text-[10px] font-bold">Transacciones</span>
        </div>
        <div onClick={() => setView('accounts')} className={navItemClass('accounts', true)}>
          <span className="text-xl mb-0.5">💳</span>
          <span className="text-[10px] font-bold">Cuentas</span>
        </div>
      </nav>

    </div>
  );
};

export default Layout;