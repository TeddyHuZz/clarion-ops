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

/**
 * Sends a bulk list of CVE scan results to the data-service.
 * Optimized for container security scanners (Trivy).
 */
export const bulkReportCVEs = async (payloads: DeploymentPayload[]): Promise<void> => {
  if (payloads.length === 0) return;

  const SECURITY_INGEST_URL = (process.env['DATA_SERVICE_URL'] || 'http://localhost:8002/api/v1/') + 'security/scans';

  try {
    console.log(`[data-client]: Relaying bulk CVE report (${payloads.length} entries) to data-service...`);
    
    const response = await fetch(SECURITY_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[data-client]: Bulk CVE relay failed. Status: ${response.status}. Error: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`[data-client]: Bulk ingestion successful. Records stored: ${result.records_ingested}`);
  } catch (error) {
    console.error('[data-client]: Connectivity error during bulk CVE relay:', error);
  }
};
