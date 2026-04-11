import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Clock, AlertTriangle, Brain, History, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import "./IncidentReplayView.css";

interface TimelineEvent {
  timestamp: string;
  event_type: "ALERT_STATE_CHANGE" | "AI_RCA_LOG" | "DEPLOYMENT";
  payload: Record<string, unknown>;
}

interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
}

export function IncidentReplayView() {
  const { getToken } = useAuth();
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scrub timestamp (default to current time / end of metrics)
  const [scrubTimestamp, setScrubTimestamp] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Build URL with properly encoded query parameters
      const baseUrl = import.meta.env.VITE_DATA_API_URL || "http://localhost:8002";
      const params = new URLSearchParams({
        service_name: "api-gateway",
        start_time: "2026-04-01T00:00:00Z",
        end_time: "2026-04-30T23:59:59Z",
      });

      // 1. Fetch Unified Timeline
      const timelineResp = await fetch(
        `${baseUrl}/api/v1/analytics/timeline?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!timelineResp.ok) throw new Error("Failed to fetch timeline");
      const timelineData: TimelineEvent[] = await timelineResp.json();
      setTimeline(timelineData);

      // 2. Fetch Historical Metrics (Mocking for demo, replace with actual metrics endpoint)
      // Generates 120 data points at 1-minute intervals, spanning the last 2 hours
      const mockMetrics: MetricPoint[] = Array.from({ length: 120 }, (_, i) => ({
        timestamp: new Date(Date.now() - (120 - i) * 60000).toISOString(),
        cpu: 30 + Math.random() * 60,
        memory: 250 + Math.random() * 100,
      }));
      setMetrics(mockMetrics);

      // Set scrubber to the last metric timestamp initially
      if (mockMetrics.length > 0) {
        setScrubTimestamp(mockMetrics[mockMetrics.length - 1].timestamp);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();

    // Poll for fresh data every 30 seconds
    const intervalId = setInterval(fetchData, 30_000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Format time for display
  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Filter events that happened at or before the scrub time
  const pastEvents = timeline.filter(
    (e) => new Date(e.timestamp) <= new Date(scrubTimestamp)
  );

  // Timeline range calculations
  const allTimestamps = [
    ...metrics.map((m) => new Date(m.timestamp).getTime()),
    ...timeline.map((e) => new Date(e.timestamp).getTime()),
  ];
  const timelineStart = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now();
  const timelineEnd = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();
  const scrubMs = scrubTimestamp ? new Date(scrubTimestamp).getTime() : timelineEnd;

  // Event marker configuration
  const getMarkerConfig = (event: TimelineEvent) => {
    const eventTime = new Date(event.timestamp).getTime();
    const percent =
      timelineEnd > timelineStart
        ? Math.min(98, Math.max(2, ((eventTime - timelineStart) / (timelineEnd - timelineStart)) * 100))
        : 50;

    switch (event.event_type) {
      case "ALERT_STATE_CHANGE":
        return {
          emoji: "🚨",
          className: "timeline-event-marker--alert",
          typeLabel: "Alert",
          tooltipClass: "timeline-marker-tooltip__type--alert",
          percent,
        };
      case "AI_RCA_LOG":
        return {
          emoji: "🤖",
          className: "timeline-event-marker--ai",
          typeLabel: "AI RCA",
          tooltipClass: "timeline-marker-tooltip__type--ai",
          percent,
        };
      case "DEPLOYMENT": {
        const payloadStr = JSON.stringify(event.payload).toLowerCase();
        if (payloadStr.includes("rollback") || payloadStr.includes("revert")) {
          return {
            emoji: "⏪",
            className: "timeline-event-marker--deploy",
            typeLabel: "Rollback",
            tooltipClass: "timeline-marker-tooltip__type--deploy",
            percent,
          };
        }
        if (payloadStr.includes("restored") || payloadStr.includes("fixed") || payloadStr.includes("resolved")) {
          return {
            emoji: "✅",
            className: "timeline-event-marker--restored",
            typeLabel: "Restored",
            tooltipClass: "timeline-marker-tooltip__type--restored",
            percent,
          };
        }
        return {
          emoji: "🚀",
          className: "timeline-event-marker--deploy",
          typeLabel: "Deploy",
          tooltipClass: "timeline-marker-tooltip__type--deploy",
          percent,
        };
      }
      default:
        return {
          emoji: "📌",
          className: "timeline-event-marker--deploy",
          typeLabel: String(event.event_type).replace(/_/g, " "),
          tooltipClass: "timeline-marker-tooltip__type--deploy",
          percent,
        };
    }
  };

  if (loading) {
    return (
      <div className="replay-loading">
        <Loader2 className="replay-loading__spinner" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="replay-error">
        <div className="replay-error__content">
          <p className="replay-error__message">Error: {error}</p>
          <button
            onClick={fetchData}
            className="replay-error__retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-container">
      {/* Charts Section */}
      <div className="replay-section">
        <h2 className="replay-section__title">
          System Metrics
        </h2>
        <div className="replay-charts__grid">
        {/* CPU Chart */}
        <Card padding="24px" className="replay-card">
          <div className="replay-chart__header">
            <div className="replay-chart__title-group">
              <h4 className="replay-chart__title">CPU Usage</h4>
              <p className="replay-chart__subtitle">
                Average: {metrics.length > 0 ? (metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length).toFixed(1) : 0}%
              </p>
            </div>
            <div className="replay-chart__badge replay-chart__badge--cpu">
              <div className="replay-chart__badge-dot replay-chart__badge-dot--cpu"></div>
              <span className="replay-chart__badge-text replay-chart__badge-text--cpu">CPU</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => formatTime(val)}
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={{ stroke: "#4b5563" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                }}
                labelFormatter={(val) => formatTime(val)}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "CPU Usage"]}
              />
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#22d3ee", strokeWidth: 0 }}
                fill="url(#cpuGradient)"
              />
              <ReferenceLine
                x={scrubTimestamp}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Memory Chart */}
        <Card padding="24px" className="replay-card">
          <div className="replay-chart__header">
            <div className="replay-chart__title-group">
              <h4 className="replay-chart__title">Memory Usage</h4>
              <p className="replay-chart__subtitle">
                Average: {metrics.length > 0 ? (metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length).toFixed(0) : 0} MB
              </p>
            </div>
            <div className="replay-chart__badge replay-chart__badge--memory">
              <div className="replay-chart__badge-dot replay-chart__badge-dot--memory"></div>
              <span className="replay-chart__badge-text replay-chart__badge-text--memory">Memory</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => formatTime(val)}
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={{ stroke: "#4b5563" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                }}
                labelFormatter={(val) => formatTime(val)}
                formatter={(value) => [`${Number(value).toFixed(1)} MB`, "Memory Usage"]}
              />
              <defs>
                <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#fb7185"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#fb7185", strokeWidth: 0 }}
                fill="url(#memoryGradient)"
              />
              <ReferenceLine
                x={scrubTimestamp}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        </div>
      </div>

      {/* Interactive Timeline Scrubber */}
      <div className="replay-section">
        <h2 className="replay-section__title">
          Time Control
        </h2>
        <Card padding="32px" className="replay-card replay-card--scrubber">
          <h3 className="replay-scrubber__title">
            Replay Timeline
          </h3>
          <p className="replay-scrubber__description">
            Click anywhere on the track or drag the scrubber to navigate through events.
          </p>

          {/* Current Time Display */}
          <div className="timeline-track__current-time">
            <div className="timeline-track__current-time--icon">
              <Clock size={16} />
            </div>
            <div>
              <div className="timeline-track__current-time--label">Current Time</div>
              <div className="timeline-track__current-time--value">
                {formatTime(scrubTimestamp)}
              </div>
            </div>
          </div>

          {/* Scrubber Input + Event Markers */}
          <div className="replay-scrubber__track">
            {/* The Scrubber — native HTML range input per spec */}
            <input
              type="range"
              className="accent-accent"
              min={timelineStart}
              max={timelineEnd}
              value={scrubMs}
              onChange={(e) => {
                const ms = Number(e.target.value);
                // Snap to closest metric point
                const closest = metrics.reduce((prev, curr) =>
                  Math.abs(new Date(curr.timestamp).getTime() - ms) <
                  Math.abs(new Date(prev.timestamp).getTime() - ms)
                    ? curr
                    : prev
                );
                setScrubTimestamp(closest.timestamp);
              }}
              role="slider"
              aria-label="Timeline scrubber"
              aria-valuemin={timelineStart}
              aria-valuemax={timelineEnd}
              aria-valuenow={scrubMs}
            />

            {/* Event Markers — absolutely positioned over the track */}
            {timeline.length > 0 && (
              <div className="timeline-track__markers">
                {timeline.map((event, idx) => {
                  const config = getMarkerConfig(event);
                  return (
                    <div
                      key={idx}
                      className={`timeline-event-marker ${config.className}`}
                      style={{ left: `${config.percent}%` }}
                      title={config.typeLabel}
                    >
                      {config.emoji}
                      <div className="timeline-marker-tooltip">
                        <div className="timeline-marker-tooltip__header">
                          <span className="timeline-marker-tooltip__time">
                            {formatTime(event.timestamp)}
                          </span>
                          <span className={`timeline-marker-tooltip__type ${config.tooltipClass}`}>
                            {config.typeLabel}
                          </span>
                        </div>
                        <div className="timeline-marker-tooltip__body">
                          {JSON.stringify(event.payload, null, 2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Range Labels */}
          <div className="timeline-track__labels">
            <span className="timeline-track__label">
              {metrics.length > 0 ? formatTime(metrics[0].timestamp) : "—"}
            </span>
            <span className="timeline-track__label">
              {metrics.length > 0 ? formatTime(metrics[metrics.length - 1].timestamp) : "—"}
            </span>
          </div>
        </Card>
      </div>

      {/* Event Log Section */}
      <div className="replay-section">
        <h2 className="replay-section__title">
          Event Log
        </h2>
        <Card padding="32px" className="replay-card replay-card--scrubber">
          <div className="replay-scrubber__title-group">
            <h3 className="replay-scrubber__title">Incident Events</h3>
            <p className="replay-scrubber__description">
              {pastEvents.length} event{pastEvents.length !== 1 ? "s" : ""} prior to scrub position
            </p>
          </div>

          <div className="replay-events__list custom-scrollbar">
            {pastEvents.length === 0 ? (
              <div className="replay-events__empty">
                <Clock size={48} className="replay-events__empty-icon" />
                <p className="replay-events__empty-text">
                  No events prior to this timestamp
                </p>
              </div>
            ) : (
              pastEvents
                .slice()
                .reverse()
                .map((event, idx) => {
                  const config = getMarkerConfig(event);
                  const style = (
                    {
                      "timeline-event-marker--alert": {
                        icon: <AlertTriangle size={16} />,
                        iconColor: "replay-event__icon--alert",
                        bg: "replay-event--alert",
                        border: "replay-event--alert",
                        badgeBg: "replay-event__badge--alert",
                        badgeText: "replay-event__badge-text--alert",
                      },
                      "timeline-event-marker--ai": {
                        icon: <Brain size={16} />,
                        iconColor: "replay-event__icon--ai",
                        bg: "replay-event--ai",
                        border: "replay-event--ai",
                        badgeBg: "replay-event__badge--ai",
                        badgeText: "replay-event__badge-text--ai",
                      },
                      "timeline-event-marker--deploy": {
                        icon: <History size={16} />,
                        iconColor: "replay-event__icon--deploy",
                        bg: "replay-event--deploy",
                        border: "replay-event--deploy",
                        badgeBg: "replay-event__badge--deploy",
                        badgeText: "replay-event__badge-text--deploy",
                      },
                      "timeline-event-marker--restored": {
                        icon: <History size={16} />,
                        iconColor: "replay-event__icon--restored",
                        bg: "replay-event--restored",
                        border: "replay-event--restored",
                        badgeBg: "replay-event__badge--restored",
                        badgeText: "replay-event__badge-text--restored",
                      },
                    } as Record<string, {
                      icon: ReactNode;
                      iconColor: string;
                      bg: string;
                      border: string;
                      badgeBg: string;
                      badgeText: string;
                    }>
                  )[config.className] || {
                    icon: <AlertTriangle size={16} />,
                    iconColor: "replay-event__icon--alert",
                    bg: "replay-event--alert",
                    border: "replay-event--alert",
                    badgeBg: "replay-event__badge--alert",
                    badgeText: "replay-event__badge-text--alert",
                  };

                  return (
                    <div
                      key={idx}
                      className={`replay-event ${style.bg}`}
                    >
                      <div className={`replay-event__icon-container ${style.badgeBg}`}>
                        <div className={style.iconColor}>
                          {style.icon}
                        </div>
                      </div>
                      <div className="replay-event__content">
                        <div className="replay-event__header">
                          <span className={`replay-event__badge ${style.badgeBg} ${style.badgeText}`}>
                            {config.typeLabel}
                          </span>
                          <span className="replay-event__time">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                        <div className="replay-event__payload">
                          <pre className="replay-event__payload-text">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
