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
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
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
import { ActiveIncidentsBoard } from "./ActiveIncidentsBoard";
import { useState } from "react";
import { useMetrics } from "../hooks/useMetrics";
import { MetricChart } from "./ui/MetricChart";
import { PodHealthTable } from "./ui/PodHealthTable";
import { SlaCard } from "./ui/SlaCard";
import { DependencyMap } from "./ui/DependencyMap";
import { DeploymentHistoryTable } from "./ui/DeploymentHistoryTable";

type DashboardView = 'overview' | 'incidents' | 'pipelines' | 'security' | 'secrets' | 'settings';

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { 
    cpuLoad, cpuHistory,
    memoryUsage, memoryHistory,
    diskIO, 
    networkIO, 
    health, sla, loading, error, 
    refetch 
  } = useMetrics("test-pod");

  // Helper to format bytes
  const formatBytes = (bytes: number | undefined) => {
    if (bytes === undefined || bytes === null) return "0 B/s";
    if (bytes < 1024) return `${bytes.toFixed(1)} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const renderView = () => {
    switch (activeView) {
      case 'pipelines':
        return (
          <section className="dashboard-section" style={{ marginTop: '2rem' }}>
            <div className="dashboard-section__header">
              <h2>Infrastructure Pipeline History</h2>
              <Badge variant="success">Synchronized with Node Hub</Badge>
            </div>
            <DeploymentHistoryTable />
          </section>
        );

      case 'incidents':
        return (
          <section className="dashboard-section" style={{ marginTop: '2rem' }}>
            <div className="dashboard-section__header">
              <h2>Active Incidents</h2>
              <Badge variant="error">Live Feed</Badge>
            </div>
            <ActiveIncidentsBoard />
          </section>
        );
      
      case 'overview':
      default:
        return (
          <>
            {/* Stats Grid */}
            <div className="dashboard-grid">
              <SlaCard sla={sla} loading={loading} />
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

            {/* Service Topology Map */}
            <section className="dashboard-section" style={{ marginBottom: '40px' }}>
              <div className="dashboard-section__header">
                <h2>Service Topology</h2>
                <Badge>Dynamic Overlay</Badge>
              </div>
              <DependencyMap />
            </section>
          </>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'dashboard-sidebar--collapsed' : ''}`}>
        <div className="dashboard-sidebar__logo">
          <Shield size={24} color="#8de3ff" />
          {!sidebarCollapsed && <span>Clarion Ops</span>}
        </div>

        <nav className="dashboard-nav">
          <button
            onClick={() => setActiveView('overview')}
            className={`dashboard-nav__item ${activeView === 'overview' ? 'dashboard-nav__item--active' : ''}`}
            title="Dashboard"
          >
            <LayoutDashboard size={20} />
            {!sidebarCollapsed && 'Dashboard'}
          </button>
          <button onClick={() => setActiveView('incidents')} className={`dashboard-nav__item ${activeView === 'incidents' ? 'dashboard-nav__item--active' : ''}`} title="Incidents">
            <AlertTriangle size={20} />
            {!sidebarCollapsed && 'Incidents'}
          </button>
          <button onClick={() => setActiveView('security')} className={`dashboard-nav__item ${activeView === 'security' ? 'dashboard-nav__item--active' : ''}`} title="Security">
            <ShieldAlert size={20} />
            {!sidebarCollapsed && 'Security'}
          </button>
          <button onClick={() => setActiveView('pipelines')} className={`dashboard-nav__item ${activeView === 'pipelines' ? 'dashboard-nav__item--active' : ''}`} title="Pipelines">
            <GitBranch size={20} />
            {!sidebarCollapsed && 'Pipelines'}
          </button>
          <button onClick={() => setActiveView('secrets')} className={`dashboard-nav__item ${activeView === 'secrets' ? 'dashboard-nav__item--active' : ''}`} title="Secrets">
            <Lock size={20} />
            {!sidebarCollapsed && 'Secrets'}
          </button>
          <button onClick={() => setActiveView('settings')} className={`dashboard-nav__item ${activeView === 'settings' ? 'dashboard-nav__item--active' : ''}`} title="Settings">
            <Settings size={20} />
            {!sidebarCollapsed && 'Settings'}
          </button>
        </nav>

        <div style={{ marginTop: "auto" }}>
          <SignOutButton>
            <Button
              variant="ghost"
              style={{ width: "100%", justifyContent: "flex-start", padding: '12px 16px' }}
            >
              <LogOut size={20} />
              {!sidebarCollapsed && 'Sign Out'}
            </Button>
          </SignOutButton>
        </div>

        {/* Collapse toggle button */}
        <button
          className="dashboard-sidebar__collapse-btn"
          onClick={() => setSidebarCollapsed(prev => !prev)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </aside>

      {/* Collapse indicator bar (visible when collapsed) */}
      {sidebarCollapsed && (
        <div className="dashboard-sidebar__indicator" onClick={() => setSidebarCollapsed(false)} />
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="dashboard-header__left">
            <EnvironmentSwitcher />
            <div className="dashboard-header__title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1>
                  {activeView === 'pipelines' ? 'Pipeline Audit Log' :
                   activeView === 'incidents' ? 'Incident Response' :
                   'Intelligence Overview'}
                </h1>
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
              <p>
                {activeView === 'pipelines'
                  ? 'Historical audit of service deployments and pipeline events.'
                  : activeView === 'incidents'
                  ? 'Real-time incident tracking with escalation routing.'
                  : 'Real-time telemetry and resource performance analysis.'}
              </p>
            </div>
          </div>

          <div className="dashboard-header__actions">
            <div className="dashboard-header__search-wrapper">
              <input
                type="text"
                placeholder="Search logs..."
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

        {renderView()}

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
