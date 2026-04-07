import { useCallback } from 'react';
import { useAuth } from '@clerk/react';
import type { Incident } from './useIncidents';

const API_BASE_URL = import.meta.env.VITE_DATA_API_URL || 'http://localhost:8002/api/v1';

type StatusUpdater = (
  incidentId: number,
  newStatus: string,
  incidents: Incident[],
  setIncidents: (prev: Incident[] | ((prev: Incident[]) => Incident[])) => void,
) => Promise<void>;

export function useUpdateIncidentStatus(
  showToast: (type: 'success' | 'error', message: string) => void,
): StatusUpdater {
  const { getToken } = useAuth();

  return useCallback(async (
    incidentId: number,
    newStatus: string,
    incidents: Incident[],
    setIncidents,
  ) => {
    // 1. Capture previous state for rollback
    const previousIncidents = [...incidents];

    // 2. Optimistic UI update — move the card immediately
    setIncidents(prev =>
      prev.map(incident =>
        incident.id === incidentId
          ? { ...incident, status: newStatus }
          : incident,
      ),
    );

    // 3. Fire the API request in the background
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No active authentication session');
      }

      const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }

      showToast('success', `Incident marked as ${newStatus}`);
    } catch (err) {
      // 4. Rollback on failure
      setIncidents(previousIncidents);
      showToast('error', err instanceof Error ? err.message : 'Failed to update incident');
    }
  }, [getToken, showToast]);
}
