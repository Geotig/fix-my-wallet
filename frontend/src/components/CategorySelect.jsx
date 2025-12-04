import { useState } from 'react';
import { apiFetch } from '../api';

const CategorySelect = ({ transaction, categories, onCategoryChange }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e) => {
    const newCategoryId = e.target.value;
    setLoading(true);

    try {
      // 1. Llamada a la API (PATCH para actualizar solo un campo)
      const response = await apiFetch(`/api/transactions/${transaction.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            category: newCategoryId === "" ? null : newCategoryId 
        }),
      });

      if (!response.ok) throw new Error('Error actualizando');

      const updatedTransaction = await response.json();
      
      // 2. Avisar al padre que actualice el estado local
      onCategoryChange(updatedTransaction);
      
    } catch (error) {
      console.error("Error al categorizar:", error);
      alert("No se pudo guardar la categoría");
    } finally {
      setLoading(false);
    }
  };

  // Estilo dinámico: Si no tiene categoría, resáltalo en amarillo suave
  const bgColor = !transaction.category ? "bg-yellow-50 border-yellow-300" : "bg-white border-gray-300";

  return (
    <div className="relative">
      <select
        value={transaction.category || ""}
        onChange={handleChange}
        disabled={loading}
        className={`
          appearance-none w-full py-1 pl-2 pr-8 text-sm border rounded 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${bgColor} ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        `}
      >
        <option value="">-- Sin Asignar --</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
      
      {/* Flechita personalizada para el select */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );
};

export default CategorySelect;