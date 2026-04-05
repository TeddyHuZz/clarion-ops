import React from 'react';
import './ui.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: string;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  interactive = false,
  padding = '24px'
}) => {
  const baseClass = `ui-card ${interactive ? 'ui-card--interactive' : ''}`;
  return (
    <div className={`${baseClass} ${className}`} style={{ padding }}>
      {children}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from './badge';

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, className = '' }) => {
  return (
    <Card className={className} interactive>
      <div className="dashboard-card__header">
        <div className="dashboard-card__icon">{icon}</div>
        {trend && (
          <Badge 
            variant={trend.positive ? 'success' : 'error'} 
            isTrend 
          >
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </Badge>
        )}
      </div>
      <div>
        <div className="dashboard-card__value">{value}</div>
        <div className="dashboard-card__label">{label}</div>
      </div>
    </Card>
  );
};
