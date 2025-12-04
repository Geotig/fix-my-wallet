import React from 'react';

// Aceptamos 'currentView' y 'setView' como props
const Layout = ({ children, currentView, setView }) => {
  
  const navClass = (viewName) => `
    block py-2.5 px-4 rounded transition duration-200 cursor-pointer
    ${currentView === viewName 
      ? 'bg-blue-50 text-blue-600 font-semibold' 
      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'}
  `;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md hidden md:block flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">FixMyWallet</h1>
        </div>
        <nav className="mt-6 px-4">
          <div 
            onClick={() => setView('transactions')} 
            className={navClass('transactions')}
          >
            Transacciones
          </div>
          <div 
            onClick={() => setView('budget')} 
            className={navClass('budget')}
          >
            Presupuesto
          </div>
          <div
            onClick={() => setView('accounts')}
            className={navClass('accounts')}
          >
            Cuentas
          </div>
          <div className="block py-2.5 px-4 rounded text-gray-400 cursor-not-allowed">
            Reportes (Pronto)
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;