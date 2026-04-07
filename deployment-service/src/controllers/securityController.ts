import type { Request, Response } from 'express';
import { bulkReportCVEs } from '../services/dataClient.js';
import type { CVEScanPayload } from '../services/dataClient.js';

/**
 * Controller for Trivy Security Scan Webhooks.
 * Receives the JSON report from a CI/CD pipeline, parses vulnerabilities, 
 * and relays them to the centralized data-service.
 */

export const handleTrivyWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const commit_hash = req.headers['x-commit-hash'] as string || req.query['commit_hash'] as string;

    if (!commit_hash) {
      console.warn('[security-webhook]: Missing commit_hash in headers or query params.');
      res.status(400).json({ error: 'commit_hash is required for correlation' });
      return;
    }

    // 1. Respond 202 Accepted to the CI/CD pipeline immediately
    res.status(202).json({ 
      status: 'Accepted', 
      message: 'Processing security scan asynchronously' 
    });

    // 2. Parse and filter vulnerabilities
    const results = payload.Results || [];
    const vulnerabilities: CVEScanPayload[] = [];
    const timestamp = new Date().toISOString();

    const SEVERITY_THRESHOLD = ['MEDIUM', 'HIGH', 'CRITICAL'];

    results.forEach((result: { Vulnerabilities?: Array<{
      VulnerabilityID: string;
      Severity: string;
      PkgName: string;
      FixedVersion?: string;
    }> }) => {
      if (result.Vulnerabilities) {
        result.Vulnerabilities.forEach((vuln) => {
          const severity = (vuln.Severity || '').toUpperCase();

          // Apply filtering logic (severity >= MEDIUM)
          if (SEVERITY_THRESHOLD.includes(severity)) {
            vulnerabilities.push({
              time: timestamp,
              commit_hash,
              cve_id: vuln.VulnerabilityID,
              severity,
              package_name: vuln.PkgName,
              fixed_version: vuln.FixedVersion || 'none',
            });
          }
        });
      }
    });

    console.log(`[security-webhook]: Detected ${vulnerabilities.length} vulnerabilities >= MEDIUM for commit ${commit_hash}.`);

    // 3. Asynchronously relay to the Data Service in bulk
    if (vulnerabilities.length > 0) {
      bulkReportCVEs(vulnerabilities).catch(err => {
        console.error('[security-webhook]: Bulk relay failed:', err);
      });
    }

  } catch (error) {
    console.error('[security-webhook]: Critical failure in Trivy handler:', error);
  }
};
