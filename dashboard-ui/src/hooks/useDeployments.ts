import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';

export interface Deployment {
  time: string;
  service_name: string;
  commit_hash: string;
  author: string;
  branch: string;
  status: string;
  risk_score?: number;
}

export const useDeployments = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const fetchDeployments = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const response = await fetch('http://localhost:8003/deployments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deployments: ${response.statusText}`);
      }

      const data = await response.json();
      setDeployments(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  return { deployments, loading, error, refetch: fetchDeployments };
};
