import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card from './Card';
import Button from './Button';

const Modal = ({ isOpen, onClose, title, children, footer }) => {
  // Cerrar al presionar ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      {/* Click fuera para cerrar */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <Card className="relative w-full max-w-md bg-white shadow-2xl transform transition-all scale-100 p-0 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </Card>
    </div>,
    document.body
  );
};

export default Modal;