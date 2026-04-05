import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import '@xyflow/react/dist/style.css';
import './DependencyMap.css';

// Centralized Node Configuration
const initialNodes: Node[] = [
  { id: '1', position: { x: 50, y: 150 }, data: { label: 'dashboard-ui' }, className: 'service-node-dashboard' },
  { id: '2', position: { x: 250, y: 150 }, data: { label: 'metrics-service' }, className: 'service-node-gateway' },
  { id: '3', position: { x: 450, y: 100 }, data: { label: 'data-service' }, className: 'service-node-worker' },
  { id: '4', position: { x: 450, y: 200 }, data: { label: 'alert-service' }, className: 'service-node-internal' },
  { id: '5', position: { x: 250, y: 300 }, data: { label: 'deployment-service' }, className: 'service-node-internal' },
];

export function DependencyMap() {
  const { currentEnv } = useEnvironment();

  // Cluster Theme Configuration
  const envTheme = useMemo(() => {
    switch (currentEnv) {
      case 'dev': return { color: '#22d3ee', label: 'Development Cluster', animated: true };
      case 'staging': return { color: '#facc15', label: 'Staging Cluster', animated: true };
      case 'prod': return { color: '#10b981', label: 'Production Cluster', animated: false };
      default: return { color: '#6366f1', label: 'Local Cluster', animated: false };
    }
  }, [currentEnv]);

  // Conditional Node Generation: Only Dev has nodes in our mock setup
  const nodes: Node[] = useMemo(() => {
    if (currentEnv !== 'dev') return [];
    return initialNodes;
  }, [currentEnv]);

  // Dynamic Edge Configuration based on environment
  const edges: Edge[] = useMemo(() => {
    if (nodes.length === 0) return [];
    return [
      { 
        id: 'e1-2', 
        source: '1', 
        target: '2', 
        label: 'metrics-api',
        type: 'smoothstep',
        animated: envTheme.animated,
        style: { stroke: envTheme.color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: envTheme.color }
      },
      { 
        id: 'e2-3', 
        source: '2', 
        target: '3', 
        label: 'grpc',
        type: 'smoothstep',
        animated: envTheme.animated,
        style: { stroke: envTheme.color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: envTheme.color }
      },
      { 
        id: 'e3-4', 
        source: '3', 
        target: '4', 
        label: 'events',
        type: 'smoothstep',
        animated: envTheme.animated,
        style: { stroke: envTheme.color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: envTheme.color }
      },
      { 
        id: 'e2-5', 
        source: '2', 
        target: '5', 
        label: 'k8s-api',
        type: 'smoothstep',
        animated: envTheme.animated,
        style: { stroke: envTheme.color, strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: envTheme.color }
      },
    ];
  }, [envTheme, nodes]);

  return (
    <div className="dependency-map-container" style={{ borderColor: `${envTheme.color}66` }}>
      {/* Visual Environment Overlay Badge */}
      <div className="map-overlay-badge" style={{ 
        backgroundColor: `${envTheme.color}22`, 
        color: envTheme.color, 
        border: `1px solid ${envTheme.color}44` 
      }}>
        {envTheme.label}
      </div>

      {nodes.length === 0 && (
        <div className="map-empty-state">
          <p>No Active Services Detected</p>
          <span>Scanning cluster in {envTheme.label}...</span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
