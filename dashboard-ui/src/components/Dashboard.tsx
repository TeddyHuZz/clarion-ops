import {
  Shield,
  Activity,
  Zap,
  Lock,
  LayoutDashboard,
  ShieldAlert,
  GitBranch,
  Settings,
  LogOut,
  Search,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from "lucide-react";
import "./Dashboard.css";
import { SignOutButton, UserButton } from "@clerk/react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <div className="dashboard-card__icon">{icon}</div>
        {trend && (
          <span
            className={`dashboard-card__trend ${trend.positive ? "dashboard-card__trend--up" : "dashboard-card__trend--down"}`}
          >
            {trend.positive ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <div className="dashboard-card__value">{value}</div>
        <div className="dashboard-card__label">{label}</div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const alerts = [
    {
      id: 1,
      title: "SQL Injection attempt detected",
      severity: "high",
      service: "auth-service",
      time: "2m ago",
    },
    {
      id: 2,
      title: "Dependency vulnerability found",
      severity: "medium",
      service: "api-gateway",
      time: "15m ago",
    },
    {
      id: 3,
      title: "Unauthorized access blocked",
      severity: "high",
      service: "db-proxy",
      time: "1h ago",
    },
    {
      id: 4,
      title: "Pipeline linting failed",
      severity: "low",
      service: "web-ui",
      time: "3h ago",
    },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__logo">
          <Shield size={24} color="#8de3ff" />
          <span>Clarion Ops</span>
        </div>

        <nav className="dashboard-nav">
          <a
            href="#"
            className="dashboard-nav__item dashboard-nav__item--active"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <a href="#" className="dashboard-nav__item">
            <ShieldAlert size={20} />
            Security
          </a>
          <a href="#" className="dashboard-nav__item">
            <GitBranch size={20} />
            Pipelines
          </a>
          <a href="#" className="dashboard-nav__item">
            <Lock size={20} />
            Secrets
          </a>
          <a href="#" className="dashboard-nav__item">
            <Settings size={20} />
            Settings
          </a>
        </nav>

        <div style={{ marginTop: "auto" }}>
          <SignOutButton>
            <button
              className="dashboard-nav__item"
              style={{
                width: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-header__title">
            <h1>Intelligence Overview</h1>
            <p>Welcome back. Here's your current security posture.</p>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search resources..."
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "12px",
                  padding: "10px 16px 10px 40px",
                  color: "white",
                  fontSize: "0.9rem",
                }}
              />
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.4,
                }}
              />
            </div>
            <button
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--surface-border)",
                borderRadius: "12px",
                padding: "10px",
                color: "white",
                cursor: "pointer",
              }}
            >
              <Bell size={20} />
            </button>
            <UserButton />
          </div>
        </header>

        {/* Stats Grid */}
        <div className="dashboard-grid">
          <StatCard
            label="Security Score"
            value="94%"
            icon={<CheckCircle2 />}
            trend={{ value: "2.4%", positive: true }}
          />
          <StatCard
            label="Vulnerabilities"
            value="12"
            icon={<ShieldAlert />}
            trend={{ value: "4", positive: false }}
          />
          <StatCard
            label="Avg. CPU Load"
            value="42%"
            icon={<Activity />}
            trend={{ value: "1.2%", positive: true }}
          />
          <StatCard
            label="Pipeline Success"
            value="99.8%"
            icon={<Zap />}
            trend={{ value: "0.1%", positive: true }}
          />
        </div>

        {/* Recent Alerts Section */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Recent Security Alerts</h2>
            <button
              style={{
                color: "var(--accent)",
                background: "none",
                border: "none",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              View All Alerts
            </button>
          </div>

          <div className="dashboard-table-card">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Severity</th>
                  <th>Service</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td style={{ fontWeight: 500 }}>{alert.title}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--${alert.severity}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                      {alert.service}
                    </td>
                    <td style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                      {alert.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
