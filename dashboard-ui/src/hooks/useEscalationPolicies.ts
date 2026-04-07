import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';

const API_BASE_URL = import.meta.env.VITE_DATA_API_URL || 'http://localhost:8002/api/v1';

export interface EscalationPolicy {
  id: number;
  service_name: string;
  level_1_user: string | null;
  level_2_user: string | null;
  level_3_user: string | null;
}

export function useEscalationPolicies() {
  const { getToken } = useAuth();
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        setError('No active authentication session');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/escalations/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch escalation policies: ${response.status}`);
      }

      const data = await response.json();
      setPolicies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, error, refetch: fetchPolicies };
}
