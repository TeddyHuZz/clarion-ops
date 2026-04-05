/**
 * Native Internal Client for communicating with the Data Service.
 * Relays deployment events for persistent audit logging in TimescaleDB.
 */

const DATA_SERVICE_URL = process.env['DATA_SERVICE_URL'] || 'http://data-service:8002/api/v1/deployments/';

export interface DeploymentPayload {
  service_name: string;
  commit_hash: string;
  author: string;
  branch: string;
  status: string;
  time?: string;
}

/**
 * Sends a deployment event to the centralized data-service.
 * This is an internal fire-and-forget call from the webhook controller.
 */
export const reportDeployment = async (payload: DeploymentPayload): Promise<void> => {
  try {
    console.log(`[data-client]: Relaying deployment for ${payload.service_name} to data-service...`);
    
    const response = await fetch(DATA_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[data-client]: Failed to relay deployment. Status: ${response.status}. Error: ${errorText}`);
      return;
    }

    console.log(`[data-client]: Successfully recorded deployment for ${payload.service_name}.`);
  } catch (error) {
    console.error('[data-client]: Connectivity error when reaching data-service:', error);
  }
};
