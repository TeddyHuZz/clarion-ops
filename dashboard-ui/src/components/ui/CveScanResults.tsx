import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/react';
import './CveScanResults.css';
import { ShieldAlert, Package, RefreshCw, Layers, Filter } from 'lucide-react';

interface CVEScanResult {
  id: number;
  time: string;
  commit_hash: string;
  cve_id: string;
  severity: string;
  package_name: string;
  fixed_version?: string;
}

interface Props {
  commitHash: string;
}

type SeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM';

export function CveScanResults({ commitHash }: Props) {
  const [vulnerabilities, setVulnerabilities] = useState<CVEScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>('ALL');
  const { getToken } = useAuth();

  const fetchVulnerabilities = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const response = await fetch(`http://localhost:8002/api/v1/security/scans/${commitHash}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Audit Retrieve Failure: ${response.statusText}`);
      }

      const data = await response.json();
      setVulnerabilities(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [commitHash, getToken]);

  useEffect(() => {
    fetchVulnerabilities();
  }, [fetchVulnerabilities]);

  const filteredVulnerabilities = useMemo(() => {
    if (activeFilter === 'ALL') return vulnerabilities;
    return vulnerabilities.filter(v => v.severity.toUpperCase() === activeFilter);
  }, [vulnerabilities, activeFilter]);

  if (loading) {
    return <div className="cve-loading"><RefreshCw size={14} className="animate-spin" /> Synchronizing vulnerability audit log...</div>;
  }

  if (error) {
    return <div className="cve-empty" style={{ color: '#f87171' }}>Failed to retrieve CVE data: {error}</div>;
  }

  return (
    <div className="cve-results">
      <div className="cve-header">
        <div className="cve-header__left">
          <h3><ShieldAlert size={14} style={{ marginRight: '8px' }} /> Security Audit</h3>
          <div className="cve-filters">
            <Filter size={12} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as SeverityFilter[]).map((f) => (
              <button
                key={f}
                className={`filter-btn filter-btn--${f.toLowerCase()} ${activeFilter === f ? 'filter-btn--active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <span className="cve-count">{filteredVulnerabilities.length} findings</span>
      </div>
      
      {filteredVulnerabilities.length === 0 ? (
        <div className="cve-empty">
          {activeFilter === 'ALL' 
            ? 'No high-priority vulnerabilities discovered for this build.' 
            : `No ${activeFilter.toLowerCase()} vulnerabilities found in current build.`}
        </div>
      ) : (
        <ul className="cve-list">
          {filteredVulnerabilities.map((v) => (
            <li key={v.id} className="cve-item">
              <span className="cve-id">{v.cve_id}</span>
              <span className="cve-package">
                <Package size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                {v.package_name}
              </span>
              <span className="cve-version">
                <Layers size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                {v.fixed_version || 'N/A'}
              </span>
              <span className={`severity-pill severity-${v.severity.toLowerCase()}`}>
                {v.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
