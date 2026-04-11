import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Incident } from "../hooks/useIncidents";
import { Card } from "./ui/card";
import { AIAnalysisPanel } from "./AIAnalysisPanel";
import "./IncidentDetailView.css";

interface IncidentDetailViewProps {
  incidentId: number;
  onBack: () => void;
}

export function IncidentDetailView({ incidentId, onBack }: IncidentDetailViewProps) {
  const { getToken } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncident = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const baseUrl =
        import.meta.env.VITE_DATA_API_URL || "http://localhost:8002";

      const resp = await fetch(`${baseUrl}/api/v1/incidents/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Failed to fetch incidents");

      const incidents: Incident[] = await resp.json();
      const found = incidents.find((i: Incident) => i.id === incidentId) || null;
      setIncident(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [getToken, incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleString();
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "var(--text-muted)";
    }
  };

  if (loading) {
    return (
      <div className="incident-detail">
        <button className="incident-detail__back incident-detail__back--skeleton">
          <ArrowLeft size={18} />
          Back to Incidents
        </button>
        <Card padding="24px" className="incident-detail__header-card">
          <div className="incident-detail__header">
            <div className="incident-detail__title-group">
              <div className="incident-detail__title incident-detail__title--skeleton" />
              <div className="incident-detail__severity incident-detail__severity--skeleton" />
            </div>
            <div className="incident-detail__meta">
              <div className="incident-detail__meta-item incident-detail__meta-item--skeleton" />
              <div className="incident-detail__meta-item incident-detail__meta-item--skeleton" />
              <div className="incident-detail__meta-item incident-detail__meta-item--skeleton" />
            </div>
          </div>
        </Card>
        <div className="incident-detail__section">
          <h3 className="incident-detail__section-title incident-detail__section-title--skeleton" />
          <Card padding="32px">
            <div className="ai-analysis__panel-skeleton" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="incident-detail__error">
        <p>{error || "Incident not found"}</p>
        <button onClick={onBack} className="incident-detail__back-btn">
          <ArrowLeft size={16} />
          Back to Incidents
        </button>
      </div>
    );
  }

  return (
    <div className="incident-detail">
      {/* Back Navigation */}
      <button onClick={onBack} className="incident-detail__back">
        <ArrowLeft size={18} />
        Back to Incidents
      </button>

      {/* Incident Header */}
      <Card padding="24px" className="incident-detail__header-card">
        <div className="incident-detail__header">
          <div className="incident-detail__title-group">
            <h2 className="incident-detail__title">
              Incident #{incident.id}
            </h2>
            <span
              className="incident-detail__severity"
              style={{ color: getSeverityColor(incident.severity) }}
            >
              {incident.severity.toUpperCase()}
            </span>
          </div>
          <div className="incident-detail__meta">
            <span className="incident-detail__meta-item">
              <strong>Service:</strong> {incident.service_name}
            </span>
            <span className="incident-detail__meta-item">
              <strong>Status:</strong> {incident.status}
            </span>
            <span className="incident-detail__meta-item">
              <strong>Time:</strong> {formatTime(incident.time)}
            </span>
          </div>
        </div>
      </Card>

      {/* AI Analysis Panel */}
      <div className="incident-detail__section">
        <h3 className="incident-detail__section-title">
          AI Analysis
        </h3>
        <AIAnalysisPanel incidentId={incidentId} />
      </div>
    </div>
  );
}
