/**
 * Internal Query Client for fetching audit records from the Data Service.
 */

const DATA_SERVICE_URL = process.env['DATA_SERVICE_URL'] || 'http://localhost:8002/api/v1/deployments/';

export interface DeploymentRecord {
  time: string;
  service_name: string;
  commit_hash: string;
  author: string;
  branch: string;
  status: string;
}

/**
 * Fetches recent deployment history from TimescaleDB (via data-service).
 */
export const getRecentDeployments = async (limit: number = 20): Promise<DeploymentRecord[]> => {
  try {
    console.log(`[data-query]: Fetching last ${limit} deployments from data-service...`);
    
    // Note: We'll eventually add pagination/limit to the data-service API
    const response = await fetch(`${DATA_SERVICE_URL}?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deployments: ${response.statusText}`);
    }

    const data = await response.json();
    
    // In our current data-service, results might be a list or wrapped object
    return Array.isArray(data) ? data : (data.records || []);
    
  } catch (error) {
    console.error('[data-query]: Error fetching deployment history:', error);
    return [];
  }
};
