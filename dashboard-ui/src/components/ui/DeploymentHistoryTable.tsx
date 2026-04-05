import { useMemo, useState } from 'react';
import { useDeployments } from '../../hooks/useDeployments';
import './DeploymentHistoryTable.css';
import { GitBranch, Clock, User, Hash, Terminal, ChevronRight, ChevronDown } from 'lucide-react';
import { CveScanResults } from './CveScanResults';
import React from 'react';

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
      <div className="deployment-history error">
        <p>Telemetry Sync Failure: {error}</p>
      </div>
    );
  }

  return (
    <div className="deployment-history">
      <table className="deployment-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th><Clock size={14} style={{ marginRight: '8px' }} /> Time</th>
            <th><Terminal size={14} style={{ marginRight: '8px' }} /> Service</th>
            <th><GitBranch size={14} style={{ marginRight: '8px' }} /> Branch</th>
            <th><Hash size={14} style={{ marginRight: '8px' }} /> Commit</th>
            <th><User size={14} style={{ marginRight: '8px' }} /> Author</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            skeletonRows.map((_, i) => (
              <tr key={`skeleton-${i}`} className="skeleton-row">
                <td />
                {Array(6).fill(0).map((_, j) => (
                  <td key={`cell-${j}`}><div className="skeleton-box" style={{ width: `${40 + Math.random() * 50}%` }} /></td>
                ))}
              </tr>
            ))
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
                  <td>{timeAgo(deployment.time)}</td>
                  <td>{deployment.service_name}</td>
                  <td>{deployment.branch}</td>
                  <td><span className="commit-hash">{deployment.commit_hash.substring(0, 7)}</span></td>
                  <td>{deployment.author}</td>
                  <td>
                    <span className={`deployment-status status-${deployment.status.toLowerCase() === 'success' ? 'success' : 'failure'}`}>
                      {deployment.status}
                    </span>
                  </td>
                </tr>
                {expandedCommit === deployment.commit_hash && (
                  <tr className="expansion-row">
                    <td colSpan={7} style={{ padding: 0 }}>
                      <CveScanResults commitHash={deployment.commit_hash} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
          {!loading && deployments.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No deployment events detected in audit log.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
