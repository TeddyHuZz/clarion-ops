import { useState, useEffect, useCallback } from 'react';

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

export function useMetrics(namespace: string, podName: string, pollInterval: number = 5000) {
  const [cpuLoad, setCpuLoad] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [diskIO, setDiskIO] = useState<DiskMetrics | null>(null);
  const [networkIO, setNetworkIO] = useState<NetworkMetrics | null>(null);
  const [health, setHealth] = useState<PodHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      // Parallel fetch for efficiency
      const [cpuResp, memResp, diskResp, netResp, healthResp] = await Promise.all([
        fetch(`${API_BASE_URL}/cpu?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/memory?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/disk?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/network?namespace=${namespace}&pod_name=${podName}`),
        fetch(`${API_BASE_URL}/pod-health?namespace=${namespace}`)
      ]);

      if (!cpuResp.ok || !memResp.ok || !diskResp.ok || !netResp.ok || !healthResp.ok) {
        throw new Error('One or more metrics fetches failed');
      }

      const [cpuData, memData, diskData, netData, healthData] = await Promise.all([
        cpuResp.json(), memResp.json(), diskResp.json(), netResp.json(), healthResp.json()
      ]);

      // CPU
      if (cpuData.length > 0) setCpuLoad(cpuData[0].value * 100);
      else setCpuLoad(null);

      // Memory (bytes to MB)
      if (memData.length > 0) setMemoryUsage(memData[0].value / (1024 * 1024));
      else setMemoryUsage(null);

      // Disk
      if (diskData.length > 0) setDiskIO(diskData[0]);
      else setDiskIO(null);

      // Network
      if (netData.length > 0) setNetworkIO(netData[0]);
      else setNetworkIO(null);

      // Health
      const podInfo = healthData.find((h: PodHealth) => h.pod === podName);
      if (podInfo) {
        setHealth(podInfo);
        setError(null);
      } else {
        setHealth(null);
        setError(`Pod ${podName} not found`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch error');
      setCpuLoad(null);
      setMemoryUsage(null);
      setDiskIO(null);
      setNetworkIO(null);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [namespace, podName]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, pollInterval]);

  return { cpuLoad, memoryUsage, diskIO, networkIO, health, loading, error, refetch: fetchMetrics };
}
