import React from 'react';
import './SlaCard.css';

interface SlaCardProps {
  sla: number | null;
  loading: boolean;
}

export const SlaCard: React.FC<SlaCardProps> = ({ sla, loading }) => {
  const getStatusClass = (val: number) => {
    if (val >= 99.9) return 'excellent';
    if (val >= 99.0) return 'warning';
    return 'critical';
  };

  if (loading) {
    return (
      <div className="sla-card">
        <div className="sla-header">
          <div className="sla-skeleton sla-skeleton-title" />
        </div>
        <div className="sla-skeleton sla-skeleton-value" style={{ marginTop: '0.5rem' }} />
        <div className="sla-footer">Calculating 30d uptime...</div>
      </div>
    );
  }

  const slaValue = sla ?? 0;
  const status = getStatusClass(slaValue);

  return (
    <div className="sla-card">
      <div className="sla-header">
        <span className="sla-title">Namespace SLA</span>
        <span className={`sla-indicator sla-status-${status}`}>●</span>
      </div>
      <div className={`sla-value sla-status-${status}`}>
        {slaValue.toFixed(2)}%
      </div>
      <div className="sla-footer">
        Rolling 30-day availability
      </div>
    </div>
  );
};
