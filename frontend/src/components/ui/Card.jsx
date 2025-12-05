// frontend/src/components/ui/Card.jsx
import React from 'react';

const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow border border-gray-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

export default Card;