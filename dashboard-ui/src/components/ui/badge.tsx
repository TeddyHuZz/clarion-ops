import React from 'react';
import './ui.css';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error';
  isTrend?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'success', 
  isTrend = false,
  className = ''
}) => {
  const baseClass = isTrend ? 'ui-badge ui-badge--trend' : 'ui-badge';
  return (
    <span className={`${baseClass} ui-badge--${variant} ${className}`}>
      {children}
    </span>
  );
};
