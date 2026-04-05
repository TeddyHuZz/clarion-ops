import { GitBranch, Clock, User, Hash, Terminal, ChevronRight, ChevronDown, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CveScanResults } from './CveScanResults';
import { useDeployments } from '../../hooks/useDeployments';
import { Card } from './card';
import React, { useMemo, useState } from 'react';
import './DeploymentHistoryTable.css';

/**
 * High-fidelity Risk Badge with automated severity assessment.
 */
function RiskBadge({ score }: { score?: number }) {
  const s = score ?? 0;
  let variant = 'low';
  let Icon = ShieldCheck;

  if (s > 70) {
    variant = 'high';
    Icon = AlertTriangle;
  } else if (s > 30) {
    variant = 'medium';
    Icon = Activity;
  }

  return (
    <div className={`risk-badge risk-badge--${variant}`}>
      <Icon size={12} style={{ marginRight: '6px' }} />
      {s > 0 ? `${s}% Risk` : 'Low Risk'}
    </div>
  );
}

/**
 * Utility to format timestamp into friendly "time ago" string
 */
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export function DeploymentHistoryTable() {
  const { deployments, loading, error } = useDeployments();
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const toggleExpand = (commitHash: string) => {
    setExpandedCommit(expandedCommit === commitHash ? null : commitHash);
  };

  const skeletonRows = useMemo(() => Array(5).fill(0), []);

  if (error) {
    return (
      <div className="ui-empty-state">
        <AlertTriangle size={48} style={{ opacity: 0.1, marginBottom: '8px' }} />
        <h3>Telemetry Sync Failure</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <Card padding="0">
      <div className="ui-table-container">
        <table className="ui-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}></th>
              <th className="col-time"><div className="th-content"><Clock size={14} /> Time</div></th>
              <th className="col-risk text-center"><div className="th-content justify-center"><Activity size={14} /> Risk</div></th>
              <th className="col-service"><div className="th-content"><Terminal size={14} /> Service</div></th>
              <th className="col-branch"><div className="th-content"><GitBranch size={14} /> Branch</div></th>
              <th className="col-commit"><div className="th-content"><Hash size={14} /> Commit</div></th>
              <th className="col-author"><div className="th-content"><User size={14} /> Author</div></th>
              <th className="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((_, i) => (
                <tr key={`skeleton-${i}`} className="skeleton-row">
                  <td />
                  <td colSpan={7}><div className="skeleton-box" style={{ width: '100%', height: '1.25rem' }} /></td>
                </tr>
              ))
            ) : deployments.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="ui-empty-state" style={{ padding: '4rem 0' }}>
                    <Activity size={48} style={{ opacity: 0.1, marginBottom: '12px' }} />
                    <p>No deployment events detected in audit log.</p>
                  </div>
                </td>
              </tr>
            ) : (
              deployments.map((deployment, index) => (
                <React.Fragment key={`${deployment.commit_hash}-${index}`}>
                  <tr 
                    onClick={() => toggleExpand(deployment.commit_hash)} 
                    style={{ cursor: 'pointer' }}
                    className={expandedCommit === deployment.commit_hash ? 'row-expanded' : ''}
                  >
                    <td>
                      {expandedCommit === deployment.commit_hash ? <ChevronDown size={14} opacity={0.5} /> : <ChevronRight size={14} opacity={0.3} />}
                    </td>
                    <td className="col-time">{timeAgo(deployment.time)}</td>
                    <td className="col-risk text-center"><RiskBadge score={deployment.risk_score} /></td>
                    <td className="col-service" style={{ fontWeight: 500 }}>{deployment.service_name}</td>
                    <td className="col-branch">{deployment.branch}</td>
                    <td className="col-commit"><span className="commit-hash">{deployment.commit_hash.substring(0, 7)}</span></td>
                    <td className="col-author">{deployment.author}</td>
                    <td className="col-status">
                      <span className={`deployment-status status-${deployment.status.toLowerCase() === 'success' ? 'success' : 'failure'}`}>
                        {deployment.status}
                      </span>
                    </td>
                  </tr>
                  {expandedCommit === deployment.commit_hash && (
                    <tr className="expansion-row">
                      <td colSpan={8} style={{ padding: 0 }}>
                        <CveScanResults commitHash={deployment.commit_hash} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
