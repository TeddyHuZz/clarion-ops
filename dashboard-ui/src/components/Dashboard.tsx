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
  Database,
  Globe,
  RefreshCcw,
} from "lucide-react";
import { SignOutButton, UserButton } from "@clerk/react";
import "./Dashboard.css";
import { 
  StatCard, 
  Card, 
  Button, 
  Badge, 
  Modal 
} from "./ui";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { useState } from "react";
import { useMetrics } from "../hooks/useMetrics";

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { 
    cpuLoad, 
    memoryUsage, 
    diskIO, 
    networkIO, 
    health, 
    loading, 
    error, 
    refetch 
  } = useMetrics("test-ns", "test-pod");

  // Helper to format bytes (e.g. for network/disk)
  const formatBytes = (bytes: number | undefined) => {
    if (bytes === undefined || bytes === null) return "0 B/s";
    if (bytes < 1024) return `${bytes.toFixed(1)} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  };

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
            <Button
              variant="ghost"
              style={{ width: "100%", justifyContent: "flex-start", padding: '12px 16px' }}
            >
              <LogOut size={20} />
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-header__left">
            <EnvironmentSwitcher />
            <div className="dashboard-header__title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1>Intelligence Overview</h1>
                {health ? (
                  <Badge variant={health.state.toLowerCase() === 'running' ? 'success' : 'warning'}>
                    {health.state} • {health.restarts} restarts
                  </Badge>
                ) : (
                  !loading && (
                    <Badge variant="error">
                      Disconnected
                    </Badge>
                  )
                )}
              </div>
              <p>Real-time telemetry and resource performance analysis.</p>
            </div>
          </div>

          <div className="dashboard-header__actions">
            <div className="dashboard-header__search-wrapper">
              <input
                type="text"
                placeholder="Search resources..."
                className="dashboard-header__search"
              />
              <Search
                size={18}
                className="dashboard-header__search-icon"
              />
            </div>
            <Button variant="secondary" isIconOnly>
              <Bell size={20} />
            </Button>
            <Button 
                variant="ghost" 
                isIconOnly 
                onClick={() => refetch()}
                style={{ opacity: loading ? 0.5 : 1 }}
            >
              <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
            </Button>
            <UserButton />
          </div>
        </header>

        {/* Stats Grid - Now all using real data */}
        <div className="dashboard-grid">
          <StatCard
            label="CPU Load"
            value={loading ? "..." : cpuLoad !== null ? `${cpuLoad.toFixed(1)}%` : "N/A"}
            icon={<Activity />}
            trend={error ? { value: "Error", positive: false } : { value: "Live", positive: true }}
          />
          <StatCard
            label="Memory Usage"
            value={loading ? "..." : memoryUsage !== null ? `${memoryUsage.toFixed(0)} MB` : "N/A"}
            icon={<Database />}
            trend={{ value: "Stable", positive: true }}
          />
          <StatCard
            label="Network Inbound"
            value={loading ? "..." : formatBytes(networkIO?.receive_bytes_sec)}
            icon={<Globe />}
            trend={{ value: "Active", positive: true }}
          />
          <StatCard
            label="Disk Throughput"
            value={loading ? "..." : formatBytes((diskIO?.read_bytes_sec || 0) + (diskIO?.write_bytes_sec || 0))}
            icon={<Zap />}
            trend={{ value: "I/O", positive: true }}
          />
        </div>

        {/* Alerts Section - Cleaned up to show empty state */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Recent Security Alerts</h2>
            <Button 
              variant="ghost" 
              onClick={() => setIsModalOpen(true)}
              style={{ color: "var(--accent)", fontWeight: 600 }}
            >
              View History
            </Button>
          </div>

          <Card padding="0">
            <div className="dashboard-table-container">
              <div style={{ 
                padding: '48px', 
                textAlign: 'center', 
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Shield size={48} style={{ opacity: 0.1, marginBottom: '8px' }} />
                <h3 style={{ color: 'var(--text-primary)' }}>No active alerts detected</h3>
                <p style={{ fontSize: '0.9rem', maxWidth: '300px' }}>
                  The <code>alert-service</code> is currently idle or disconnected. Monitor resource metrics above for anomalies.
                </p>
                <div style={{ marginTop: '16px' }}>
                  <Badge variant="warning">Connection Pending</Badge>
                </div>
              </div>
          </div>
        </Card>
      </section>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Security Audit Log"
        footer={
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            Close Audit Log
          </Button>
        }
      >
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          This log will populate once the <code>alert-service</code> and <code>data-service</code> are fully integrated into the control plane.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            System ready. Waiting for initial vulnerability scan data...
          </p>
        </div>
      </Modal>
    </main>
  </div>
);
}
