import { useState } from 'react';
import { apiFetch } from '../api';
import Select from './ui/Select'; 

const CategorySelect = ({ transaction, categories, onCategoryChange }) => {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e) => {
    const newCategoryId = e.target.value;
    setLoading(true);

    try {
      const response = await apiFetch(`/api/transactions/${transaction.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategoryId === "" ? null : newCategoryId }),
      });

      if (!response.ok) throw new Error('Error actualizando');
      const updatedTransaction = await response.json();
      onCategoryChange(updatedTransaction);
      
    } catch (error) {
      console.error("Error al categorizar:", error);
      alert("No se pudo guardar la categoría");
    } finally {
      setLoading(false);
    }
  };

  // Clases condicionales
  const statusClass = !transaction.category ? "border-yellow-400 bg-yellow-50" : "";
  const loadingClass = loading ? "opacity-50 cursor-wait" : "cursor-pointer";

  return (
    <Select
      value={transaction.category || ""}
      onChange={handleChange}
      disabled={loading}
      // Usamos containerClassName para el ancho del wrapper
      containerClassName="min-w-[150px]" 
      // Y className fusionado para el estilo del select interno
      className={`text-sm py-1 ${statusClass} ${loadingClass}`}
    >
      <option value="">-- Sin Asignar --</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </Select>
  );
};

export default CategorySelect;