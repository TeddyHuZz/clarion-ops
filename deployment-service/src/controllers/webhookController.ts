import type { Request, Response } from 'express';
import { reportDeployment } from '../services/dataClient.js';
import { RiskScoringEngine } from '../services/RiskScoringEngine.js';

/**
 * Controller for GitHub Webhooks.
 * Architected to respond instantly to GitHub (200 OK) while processing internal logic asynchronously.
 */

export const handleGithubWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const eventType = req.headers['x-github-event'];

    console.log(`[webhook]: Received ${eventType} event from GitHub.`);

    // 1. Respond 200 OK immediately to satisfy GitHub's delivery requirements
    res.status(200).json({ status: 'Accepted' });
    
    // 1. Extract GitHub Actions Webhook Metadata
    const data = {
      time: new Date().toISOString(),
      service_name: payload.repository?.name || 'unknown',
      commit_hash: payload.workflow_run?.head_sha || 'unknown',
      author: payload.workflow_run?.actor?.login || 'unknown',
      branch: payload.workflow_run?.head_branch || 'unknown',
      status: payload.workflow_run?.conclusion?.toUpperCase() || 'UNKNOWN'
    };

    // 2. Respond to GitHub Immediately (GitHub Expects < 10s)
    res.status(200).send('Webhook Received');

    // 3. Process Asynchronously: Persistent Audit & Risk Calculation
    (async () => {
      try {
        await reportDeployment(data);
        console.log(`[Webhook]: Deployment reported: ${data.commit_hash}`);
        
        // Trigger Risk Assessment
        await RiskScoringEngine.calculateRiskScore(data.commit_hash);
      } catch (err) {
        console.error('[Webhook]: Asynchronous Relay Failure:', err);
      }
    })();

  } catch (error) {
    console.error('[GitHub Webhook]: Parsing Error:', error);
    res.status(400).send('Invalid Webhook Payload');
  }
};
