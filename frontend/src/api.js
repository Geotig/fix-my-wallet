
// frontend/src/api.js

// Lee la variable de entorno. Si no existe, usa localhost como fallback.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Wrapper para fetch que agrega la URL base automáticamente
 * y maneja headers comunes si fuera necesario en el futuro.
 */
export const apiFetch = (endpoint, options = {}) => {
    // Aseguramos que el endpoint empiece con /
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Eliminamos la barra final de la BASE_URL si existe para evitar dobles //
    const cleanBase = BASE_URL.replace(/\/$/, '');

    return fetch(`${cleanBase}${path}`, options);
};

export const API_URL = BASE_URL; // Por si necesitamos la URL cruda