import React from 'react';

const Combobox = ({ label, options, id, value, onChange, placeholder, className = '', ...props }) => {
  const listId = `list-${id}`;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-gray-700 uppercase mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        list={listId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
        autoComplete="off" // Importante para que no se mezcle con el historial del navegador
        {...props}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt.id} value={opt.name} />
        ))}
      </datalist>
    </div>
  );
};

export default Combobox;