import React from 'react';
import { X } from 'lucide-react';
import './ui.css';
import { Button } from './button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  className = ''
}) => {
  if (!isOpen) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className={`ui-modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <header className="ui-modal__header">
          {title && <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{title}</h2>}
          <Button variant="ghost" isIconOnly onClick={onClose} style={{ marginLeft: 'auto' }}>
            <X size={20} />
          </Button>
        </header>

        <div className="ui-modal__content">
          {children}
        </div>

        {footer && (
          <footer className="ui-modal__footer">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
