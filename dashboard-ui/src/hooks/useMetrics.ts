import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEnvironment } from '../contexts/EnvironmentContext';

const API_BASE_URL = import.meta.env.VITE_METRICS_API_URL || 'http://localhost:8001/api/v1/metrics';

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface DiskMetrics {
  timestamp: string;
  read_bytes_sec: number;
  write_bytes_sec: number;
}

export interface NetworkMetrics {
  timestamp: string;
  receive_bytes_sec: number;
  transmit_bytes_sec: number;
}

export interface PodHealth {
  namespace: string;
  pod: string;
  container: string;
  state: string;
  restarts: number;
}

const MAX_HISTORY = 30; // Number of points to keep for charts

export function useMetrics(podName: string, pollInterval: number = 5000) {
  const { currentEnv } = useEnvironment();
  
  // Map 'dev' to 'test-ns' for mock-exporter compatibility
  const namespace = useMemo(() => {
    return currentEnv === 'dev' ? 'test-ns' : currentEnv;
  }, [currentEnv]);

  const [cpuLoad, setCpuLoad] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [diskIO, setDiskIO] = useState<DiskMetrics | null>(null);
  const [networkIO, setNetworkIO] = useState<NetworkMetrics | null>(null);
  const [health, setHealth] = useState<PodHealth | null>(null);
  const [sla, setSla] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History buffers for charts
  const [cpuHistory, setCpuHistory] = useState<MetricDataPoint[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<MetricDataPoint[]>([]);

  const fetchMetrics = useCallback(async () => {
    try {
      // Don't set loading=true on every poll to avoid UI flickers, 
      // but clear errors at start of new attempt
      setError(null);
      const [cpuResp, memResp, diskResp, netResp, healthResp, slaResp] = await Promise.all([
        fetch(`${API_BASE_URL}/cpu?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/memory?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/disk?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/network?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/pod-health?namespace=${namespace}`),
        fetch(`${API_BASE_URL}/sla?namespace=${namespace}&window=5m`)
      ]);

      if (!cpuResp.ok || !memResp.ok || !diskResp.ok || !netResp.ok || !healthResp.ok || !slaResp.ok) {
        throw new Error('One or more metrics fetches failed');
      }

      const [cpuData, memData, diskData, netData, healthData, slaData] = await Promise.all([
        cpuResp.json(), memResp.json(), diskResp.json(), netResp.json(), healthResp.json(), slaResp.json()
      ]);

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Process CPU
      if (cpuData.length > 0) {
        const value = cpuData[0].value * 100;
        setCpuLoad(value);
        setCpuHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), { timestamp: now, value }]);
      } else {
        setCpuLoad(null);
      }

      // Process Memory
      if (memData.length > 0) {
        const value = memData[0].value / (1024 * 1024);
        setMemoryUsage(value);
        setMemoryHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), { timestamp: now, value }]);
      } else {
        setMemoryUsage(null);
      }

      // Disk & Network (Single points for now)
      setDiskIO(diskData.length > 0 ? diskData[0] : null);
      setNetworkIO(netData.length > 0 ? netData[0] : null);

      // Health
      const podInfo = healthData.find((h: PodHealth) => h.pod === podName);
      setHealth(podInfo || null);
      if (!podInfo) setError(`Pod ${podName} not found`);
      else setError(null);

      // SLA
      setSla(slaData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch error');
      // On error, clear current status to trigger "Disconnected" UI
      setHealth(null);
      setCpuLoad(null);
      setMemoryUsage(null);
      setSla(null);
    } finally {
      setLoading(false);
    }
  }, [namespace, podName]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, pollInterval, currentEnv]);

  return { 
    cpuLoad, cpuHistory,
    memoryUsage, memoryHistory,
    diskIO, networkIO, 
    health, sla, loading, error, 
    refetch: fetchMetrics 
  };
}
