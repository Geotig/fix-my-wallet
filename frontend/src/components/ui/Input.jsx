// frontend/src/components/ui/Input.jsx
import React from 'react';

const Input = ({ label, className = '', ...props }) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
          {label}
        </label>
      )}
      <input
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
        {...props}
      />
    </div>
  );
};

export default Input;