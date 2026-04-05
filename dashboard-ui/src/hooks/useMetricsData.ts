import { useState, useCallback, useEffect } from 'react';
import { useAuth } from "@clerk/react";

const API_BASE_URL = import.meta.env.VITE_METRICS_API_URL || 'http://localhost:8000/metrics';

export interface MetricPoint {
  timestamp: string;
  value: number;
}

/**
 * useMetricsData
 * 
 * A specialized hook for fetching authorized metrics from the Clarion Ops gateway.
 * Automatically injects the Clerk JWT into the Authorization header and polls for updates.
 */
export function useMetricsData(
  metricType: string, 
  namespace: string, 
  podName: string,
  pollingIntervalMs: number = 10000
) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricPoint[]>([]);

  const fetchMetric = useCallback(async () => {
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error("No active authentication session found.");
      }

      const url = new URL(`${API_BASE_URL}/${metricType}`);
      url.searchParams.append('namespace', namespace);
      url.searchParams.append('pod_name', podName);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        throw new Error(errorDetail.detail || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getToken, metricType, namespace, podName]);

  // Handle Initial Fetch & Polling
  useEffect(() => {
    fetchMetric();
    
    const intervalId = setInterval(() => {
      fetchMetric();
    }, pollingIntervalMs);

    return () => clearInterval(intervalId);
  }, [fetchMetric, pollingIntervalMs]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchMetric 
  };
}
