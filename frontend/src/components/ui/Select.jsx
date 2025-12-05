import React from 'react';

const Select = ({ label, children, containerClassName = '', className = '', ...props }) => {
  // Si no se pasa un color de fondo en className, usamos blanco por defecto
  const bgClass = className.includes('bg-') ? '' : 'bg-white';

  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`appearance-none w-full p-2 border border-gray-300 rounded ${bgClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow pr-8 ${className}`}
          {...props}
        >
          {children}
        </select>
        {/* Flechita SVG */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;