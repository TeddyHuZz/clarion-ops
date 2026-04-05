import React from 'react';
import { Badge } from './badge';
import { Card } from './card';
import { Shield } from 'lucide-react';

export interface PodStatus {
  name: string;
  status: 'Running' | 'Pending' | 'CrashLoopBackOff' | string;
  restartCount: number;
}

interface PodHealthTableProps {
  pods: PodStatus[];
}

export const PodHealthTable: React.FC<PodHealthTableProps> = ({ pods }) => {
  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'Running':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'CrashLoopBackOff':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (pods.length === 0) {
    return (
      <Card padding="0">
        <div className="ui-empty-state">
          <Shield size={48} style={{ opacity: 0.1, marginBottom: '8px' }} />
          <h3>No pod health data found</h3>
          <p>Connect to a cluster to monitor live pod status and stability.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="0">
      <div className="ui-table-container">
        <table className="ui-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Pod Name</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Restarts</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => (
              <tr key={pod.name}>
                <td style={{ fontWeight: 500, textAlign: 'center' }}>{pod.name}</td>
                <td style={{ textAlign: 'center' }}>
                  <Badge variant={getStatusVariant(pod.status)}>
                    {pod.status}
                  </Badge>
                </td>
                <td 
                  className={pod.restartCount > 5 ? 'ui-text-critical' : ''} 
                  style={{ textAlign: 'center' }}
                >
                  {pod.restartCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
