import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Brain, ChevronDown, Loader2, Terminal } from "lucide-react";
import { Card } from "./ui/card";
import "./AIAnalysisPanel.css";

export interface AIAnalysisData {
  id: number;
  incident_id: number;
  root_cause_summary: string;
  confidence_score: number;
  recommended_action: string;
  pod_logs: string | null;
  analyzed_at: string;
}

interface AIAnalysisPanelProps {
  incidentId: number;
}

export function AIAnalysisPanel({ incidentId }: AIAnalysisPanelProps) {
  const { getToken } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const baseUrl =
        import.meta.env.VITE_DATA_API_URL || "http://localhost:8002";

      const resp = await fetch(
        `${baseUrl}/api/v1/incidents/${incidentId}/ai-analysis`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!resp.ok) throw new Error("Failed to fetch AI analysis");

      const data: AIAnalysisData | null = await resp.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [getToken, incidentId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const getConfidenceLevel = (score: number): "high" | "medium" | "low" => {
    if (score > 85) return "high";
    if (score >= 50) return "medium";
    return "low";
  };

  const getConfidenceLabel = (level: string): string => {
    switch (level) {
      case "high":
        return "High Confidence";
      case "medium":
        return "Moderate Confidence";
      case "low":
        return "Low Confidence";
      default:
        return "Unknown";
    }
  };

  // Truncate logs to last 100 lines
  const getTruncatedLogs = (logs: string | null): string => {
    if (!logs) return "No pod logs available.";
    const lines = logs.split("\n");
    return lines.slice(-100).join("\n");
  };

  if (loading) {
    return (
      <Card padding="32px">
        <div className="ai-analysis-panel">
          {/* Skeleton Header */}
          <div className="ai-analysis__header">
            <div className="ai-analysis__title-group">
              <div className="ai-analysis__icon ai-analysis__icon--skeleton" />
              <div className="ai-analysis__title ai-analysis__title--skeleton" />
            </div>
            <div className="ai-analysis__confidence-badge ai-analysis__confidence-badge--skeleton" />
          </div>
          {/* Skeleton Summary */}
          <div className="ai-analysis__summary ai-analysis__summary--skeleton" />
          {/* Skeleton Evidence */}
          <div className="ai-analysis__evidence">
            <div className="ai-analysis__evidence-trigger ai-analysis__evidence-trigger--skeleton">
              <div className="ai-analysis__evidence-trigger__left">
                <div className="ai-analysis__evidence-trigger__left--skeleton" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="32px">
        <div className="ai-analysis__empty">
          <Brain size={40} className="ai-analysis__empty-icon" />
          <p className="ai-analysis__empty-text">
            Error loading analysis: {error}
          </p>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card padding="32px">
        <div className="ai-analysis__empty">
          <Brain size={48} className="ai-analysis__empty-icon" />
          <p className="ai-analysis__empty-text">
            AI analysis has not been performed for this incident yet.
          </p>
        </div>
      </Card>
    );
  }

  const confidenceLevel = getConfidenceLevel(analysis.confidence_score);

  return (
    <Card padding="32px">
      <div className="ai-analysis-panel">
        {/* Header */}
        <div className="ai-analysis__header">
          <div className="ai-analysis__title-group">
            <div className="ai-analysis__icon">
              <Brain size={20} />
            </div>
            <h3 className="ai-analysis__title">AI Root Cause Analysis</h3>
          </div>
          <div
            className={`ai-analysis__confidence-badge ai-analysis__confidence-badge--${confidenceLevel}`}
          >
            <div
              className={`ai-analysis__confidence-dot ai-analysis__confidence-dot--${confidenceLevel}`}
            />
            {analysis.confidence_score}% — {getConfidenceLabel(confidenceLevel)}
          </div>
        </div>

        {/* Summary */}
        <div className="ai-analysis__summary">
          {analysis.root_cause_summary}
        </div>

        {/* Evidence Accordion */}
        <div className="ai-analysis__evidence">
          <button
            className="ai-analysis__evidence-trigger"
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            aria-expanded={evidenceOpen}
            aria-controls="ai-evidence-content"
          >
            <span className="ai-analysis__evidence-trigger__left">
              <Terminal size={16} />
              View Raw AI Context Logs
            </span>
            <ChevronDown
              size={16}
              className="ai-analysis__evidence-trigger__chevron"
            />
          </button>
          <div
            id="ai-evidence-content"
            className={`ai-analysis__evidence-content ${
              evidenceOpen ? "ai-analysis__evidence-content--open" : ""
            }`}
          >
            <div className="ai-analysis__evidence-body">
              <pre className="ai-analysis__evidence-logs">
                {getTruncatedLogs(analysis.pod_logs)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
