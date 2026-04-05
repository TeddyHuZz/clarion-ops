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
  Button, 
  Badge, 
  Modal 
} from "./ui";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { useState } from "react";
import { useMetrics } from "../hooks/useMetrics";
import { MetricChart } from "./ui/MetricChart";
import { PodHealthTable } from "./ui/PodHealthTable";

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { 
    cpuLoad, cpuHistory,
    memoryUsage, memoryHistory,
    diskIO, 
    networkIO, 
    health, 
    loading, 
    error, 
    refetch 
  } = useMetrics("test-ns", "test-pod");

  // Helper to format bytes
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

        {/* Stats Grid */}
        <div className="dashboard-grid">
          <StatCard
            label="CPU Load"
            value={loading && cpuHistory.length === 0 ? "..." : cpuLoad !== null ? `${cpuLoad.toFixed(1)}%` : "N/A"}
            icon={<Activity />}
            trend={error ? { value: "Error", positive: false } : { value: "Live", positive: true }}
          />
          <StatCard
            label="Memory Usage"
            value={loading && memoryHistory.length === 0 ? "..." : memoryUsage !== null ? `${memoryUsage.toFixed(0)} MB` : "N/A"}
            icon={<Database />}
            trend={{ value: "Stable", positive: true }}
          />
          <StatCard
            label="Network Inbound"
            value={loading && !networkIO ? "..." : formatBytes(networkIO?.receive_bytes_sec)}
            icon={<Globe />}
            trend={{ value: "Active", positive: true }}
          />
          <StatCard
            label="Disk Throughput"
            value={loading && !diskIO ? "..." : formatBytes((diskIO?.read_bytes_sec || 0) + (diskIO?.write_bytes_sec || 0))}
            icon={<Zap />}
            trend={{ value: "I/O", positive: true }}
          />
        </div>

        {/* Resource Intelligence Grid - Graphs */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))' }}>
          <MetricChart 
            title="CPU Load History" 
            data={cpuHistory} 
            dataKey="value" 
            color="#8de3ff" 
            unit="%"
          />
          <MetricChart 
            title="Memory Usage Trends" 
            data={memoryHistory} 
            dataKey="value" 
            color="#c9ada7" 
            unit="MB"
          />
        </div>

        {/* Pod Inventory Table */}
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Active Pod Inventory</h2>
            <Badge variant="success">Synchronized</Badge>
          </div>
          <PodHealthTable pods={health ? [{
            name: health.pod,
            status: health.state,
            restartCount: health.restarts
          }] : []} />
        </section>

        {/* Simple Modal remains for demonstration */}
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
            System ready. Dashboard fully synchronized with metrics gateway.
          </p>
        </Modal>
      </main>
    </div>
  );
}
