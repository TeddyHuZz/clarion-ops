import React from 'react';
import './ui.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  isIconOnly?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '',
  isIconOnly = false,
  ...props 
}) => {
  const baseClass = `ui-button ui-button--${variant} ${isIconOnly ? 'ui-button--icon' : ''}`;
  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
};
