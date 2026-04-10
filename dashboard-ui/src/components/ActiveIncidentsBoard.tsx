import { useState, useCallback } from 'react';
import { Kanban, Siren, Eye, CheckCircle2, Clock, AlertTriangle, User, Wrench } from 'lucide-react';
import { useUser } from '@clerk/react';
import { Card, Modal, Button } from './ui';
import { useIncidents, type Incident } from '../hooks/useIncidents';
import { useEscalationPolicies } from '../hooks/useEscalationPolicies';
import { useUpdateIncidentStatus } from '../hooks/useUpdateIncidentStatus';
import { useToast } from '../hooks/useToast';
import { formatTime } from '../lib/time';
import '../hooks/useToast.css';
import './ActiveIncidentsBoard.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS = [
  { key: 'Open', label: 'Open', icon: <Siren size={16} />, color: '#fb7185' },
  { key: 'AI Investigating', label: 'AI Investigating', icon: <Kanban size={16} />, color: '#fbbf24' },
  { key: 'Manual Intervention', label: 'Manual Intervention', icon: <Wrench size={16} />, color: '#f97316' },
  { key: 'Acknowledged', label: 'Acknowledged', icon: <Eye size={16} />, color: '#8de3ff' },
  { key: 'Resolved', label: 'Resolved', icon: <CheckCircle2 size={16} />, color: '#4ade80' },
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#fb7185',
  high: '#f97316',
  medium: '#fbbf24',
  low: '#4ade80',
  info: '#8de3ff',
};

// Map incident status → escalation level (1-indexed)
const STATUS_TO_ESCALATION_LEVEL: Record<string, number> = {
  'Open': 1,
  'AI Investigating': 1,
  'Manual Intervention': 1,
  'Acknowledged': 2,
  'Resolved': 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOnCallUser(serviceName: string, status: string, policies: ReturnType<typeof useEscalationPolicies>['policies']): string | null {
  const policy = policies.find(p => p.service_name === serviceName);
  if (!policy) return null;

  const level = STATUS_TO_ESCALATION_LEVEL[status] ?? 1;
  const userField = `level_${level}_user` as keyof typeof policy;
  return (policy[userField] as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Incident Detail Modal
// ---------------------------------------------------------------------------

interface IncidentDetailModalProps {
  incident: Incident | null;
  onCallUser: string | null;
  onClose: () => void;
  onViewAnalysis: (incident: Incident) => void;
}

function IncidentDetailModal({ incident, onCallUser, onClose, onViewAnalysis }: IncidentDetailModalProps) {
  if (!incident) return null;

  return (
    <Modal
      isOpen={!!incident}
      onClose={onClose}
      title="Incident Details"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onViewAnalysis(incident)}>
            View AI Analysis
          </Button>
        </div>
      }
    >
      <div className="incident-detail">
        <div className="incident-detail__service-name">
          <AlertTriangle size={20} style={{ color: SEVERITY_COLORS[incident.severity.toLowerCase()] ?? '#6b7280' }} />
          <span>{incident.service_name}</span>
        </div>

        <div className="incident-detail__row">
          <Clock size={16} />
          <span className="incident-detail__label">Time</span>
          <span className="incident-detail__value">{formatTime(incident.time)}</span>
        </div>

        <div className="incident-detail__row">
          <AlertTriangle size={16} />
          <span className="incident-detail__label">Severity</span>
          <span
            className="incident-detail__value incident-detail__severity"
            style={{ backgroundColor: SEVERITY_COLORS[incident.severity.toLowerCase()] ?? '#6b7280' }}
          >
            {incident.severity}
          </span>
        </div>

        <div className="incident-detail__row">
          <Eye size={16} />
          <span className="incident-detail__label">Status</span>
          <span className="incident-detail__value">{incident.status}</span>
        </div>

        {onCallUser && (
          <div className="incident-detail__row">
            <User size={16} />
            <span className="incident-detail__label">On-Call</span>
            <span className="incident-detail__value">@{onCallUser}</span>
          </div>
        )}

        {incident.raw_payload && Object.keys(incident.raw_payload).length > 0 && (
          <div className="incident-detail__payload">
            <span className="incident-detail__label">Raw Payload</span>
            <pre className="incident-detail__pre">{JSON.stringify(incident.raw_payload, null, 2)}</pre>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Incident Card
// ---------------------------------------------------------------------------

interface IncidentCardProps {
  incident: Incident;
  onCallUser: string | null;
  isAdmin: boolean;
  onViewDetail: (incident: Incident) => void;
  onStatusChange: (incidentId: number, newStatus: string) => void;
}

function IncidentCard({ incident, onCallUser, isAdmin, onViewDetail, onStatusChange }: IncidentCardProps) {
  const canAcknowledge = incident.status === 'Open' || incident.status === 'AI Investigating' || incident.status === 'Manual Intervention';
  const canResolve = incident.status !== 'Resolved';

  return (
    <>
      <div className="incident-card-wrapper" onClick={() => onViewDetail(incident)}>
        <Card className="incident-card" interactive>
          <div className="incident-card__header">
            <span className="incident-card__service">{incident.service_name}</span>
            <span
              className="incident-card__severity"
              style={{ backgroundColor: SEVERITY_COLORS[incident.severity.toLowerCase()] ?? '#6b7280' }}
            >
              {incident.severity}
            </span>
          </div>

          <div className="incident-card__meta">
            <span className="incident-card__time">{formatTime(incident.time)}</span>
            {onCallUser && (
              <span className="incident-card__oncall">@{onCallUser}</span>
            )}
          </div>

          {isAdmin && incident.status !== 'Resolved' && (
            <div className="incident-card__actions" onClick={e => e.stopPropagation()}>
              {canAcknowledge && (
                <button
                  className="incident-card__action-btn"
                  onClick={() => onStatusChange(incident.id, 'Acknowledged')}
                >
                  Acknowledge
                </button>
              )}
              {canResolve && (
                <button
                  className="incident-card__action-btn"
                  onClick={() => onStatusChange(incident.id, 'Resolved')}
                >
                  Resolve
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  incidents: Incident[];
  onCallMap: Map<string, string | null>;
  isAdmin: boolean;
  onViewDetail: (incident: Incident) => void;
  onStatusChange: (incidentId: number, newStatus: string) => void;
}

function Column({ label, icon, color, incidents, onCallMap, isAdmin, onViewDetail, onStatusChange }: ColumnProps) {
  return (
    <div className="kanban-column">
      <div className="kanban-column__header">
        <div className="kanban-column__title" style={{ color }}>
          {icon}
          <span>{label}</span>
        </div>
        <span className="kanban-column__count" style={{ backgroundColor: color + '22', color }}>
          {incidents.length}
        </span>
      </div>

      <div className="kanban-column__body">
        {incidents.length === 0 ? (
          <div className="kanban-column__empty">No incidents</div>
        ) : (
          incidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onCallUser={onCallMap.get(String(incident.id)) ?? null}
              isAdmin={isAdmin}
              onViewDetail={onViewDetail}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

interface ActiveIncidentsBoardProps {
  onViewDetail?: (incident: Incident) => void;
}

export function ActiveIncidentsBoard({ onViewDetail }: ActiveIncidentsBoardProps) {
  const { user } = useUser();
  const { incidents, setIncidents, loading, error } = useIncidents();
  const { policies } = useEscalationPolicies();
  const { showToast, ToastContainer } = useToast();
  const updateStatus = useUpdateIncidentStatus(showToast);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const handleViewDetail = (incident: Incident) => {
    setSelectedIncident(incident);
  };

  const handleViewAnalysis = (incident: Incident) => {
    setSelectedIncident(null);
    if (onViewDetail) {
      onViewDetail(incident);
    }
  };

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const handleStatusChange = useCallback((incidentId: number, newStatus: string) => {
    updateStatus(incidentId, newStatus, incidents, setIncidents);
  }, [updateStatus, incidents, setIncidents]);

  // Build on-call lookup: incidentId → username
  const onCallMap = new Map<string, string | null>();
  incidents.forEach(incident => {
    onCallMap.set(
      String(incident.id),
      getOnCallUser(incident.service_name, incident.status, policies)
    );
  });

  if (loading) {
    return (
      <div className="kanban-loading">
        <p>Loading incidents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kanban-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="kanban-board">
        {COLUMNS.map(col => (
          <Column
            key={col.key}
            label={col.label}
            icon={col.icon}
            color={col.color}
            incidents={incidents.filter(i => i.status === col.key)}
            onCallMap={onCallMap}
            isAdmin={isAdmin}
            onViewDetail={handleViewDetail}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <IncidentDetailModal
        incident={selectedIncident}
        onCallUser={selectedIncident ? (onCallMap.get(String(selectedIncident.id)) ?? null) : null}
        onClose={() => setSelectedIncident(null)}
        onViewAnalysis={handleViewAnalysis}
      />

      <ToastContainer />
    </>
  );
}
