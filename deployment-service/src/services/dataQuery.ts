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

    const response = await fetch(`${DATA_SERVICE_URL}?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      redirect: 'follow',
    });

    console.log(`[data-query]: Response status: ${response.status} ${response.statusText}`);
    console.log(`[data-query]: Response URL: ${response.url}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[data-query]: Error response: ${errorBody}`);
      throw new Error(`Failed to fetch deployments: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // data-service returns a list directly (response_model=list)
    return Array.isArray(data) ? data : [];
    
  } catch (error) {
    console.error('[data-query]: Error fetching deployment history:', error);
    return [];
  }
};
