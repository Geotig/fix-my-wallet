import React from 'react';

const Layout = ({ children, currentView, setView }) => {
  
  // Estilos base para los items de navegación
  const navItemClass = (viewName, isMobile = false) => {
    const isActive = currentView === viewName;
    const base = "cursor-pointer transition-colors duration-200";
    
    if (isMobile) {
      // Estilo Móvil (Icono + Texto pequeño, centrado)
      return `${base} flex flex-col items-center justify-center w-full py-2 ${
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
      }`;
    } else {
      // Estilo Desktop (Lista lateral)
      return `${base} block py-2.5 px-4 rounded ${
        isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
      }`;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
      
      {/* --- SIDEBAR (Solo Desktop) --- */}
      <aside className="w-64 bg-white shadow-md hidden md:block flex-shrink-0 z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">FixMyWallet</h1>
        </div>
        <nav className="mt-6 px-4 space-y-1">
          <div onClick={() => setView('budget')} className={navItemClass('budget')}>
            Presupuesto
          </div>
          <div onClick={() => setView('transactions')} className={navItemClass('transactions')}>
            Transacciones
          </div>
          <div onClick={() => setView('accounts')} className={navItemClass('accounts')}>
            Cuentas
          </div>
          <div className="block py-2.5 px-4 rounded text-gray-400 cursor-not-allowed">
            Reportes
          </div>
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      {/* pb-20 en móvil para que el contenido no quede tapado por la barra de abajo */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* --- BOTTOM NAVIGATION (Solo Móvil) --- */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center z-50 pb-safe">
        <div onClick={() => setView('budget')} className={navItemClass('budget', true)}>
          <span className="text-xl">💰</span>
          <span className="text-xs font-medium">Presupuesto</span>
        </div>
        <div onClick={() => setView('transactions')} className={navItemClass('transactions', true)}>
          <span className="text-xl">📄</span>
          <span className="text-xs font-medium">Transacciones</span>
        </div>
        <div onClick={() => setView('accounts')} className={navItemClass('accounts', true)}>
          <span className="text-xl">💳</span>
          <span className="text-xs font-medium">Cuentas</span>
        </div>
      </nav>

    </div>
  );
};

export default Layout;