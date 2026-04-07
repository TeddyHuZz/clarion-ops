import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';

const API_BASE_URL = import.meta.env.VITE_DATA_API_URL || 'http://localhost:8002/api/v1';

export interface Incident {
  id: number;
  time: string;
  service_name: string;
  severity: string;
  status: string;
  raw_payload?: Record<string, unknown>;
}

export function useIncidents(refreshInterval: number = 10000) {
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        setError('No active authentication session');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/incidents/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch incidents: ${response.status}`);
      }

      const data = await response.json();
      setIncidents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchIncidents, refreshInterval]);

  return { incidents, setIncidents, loading, error, refetch: fetchIncidents };
}
