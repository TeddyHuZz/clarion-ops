import type { Request, Response } from 'express';
import { reportDeployment } from '../services/dataClient.js';

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

    // 2. Filter for 'workflow_run' events specifically
    if (eventType !== 'workflow_run') {
      return;
    }

    const { workflow_run, repository } = payload;
    if (!workflow_run || !repository) {
      console.warn('[webhook]: Malformed payload received (missing workflow_run or repository).');
      return;
    }

    // 3. Extract metadata per requirement
    const deploymentData = {
      service_name: repository.name,
      commit_hash: workflow_run.head_sha,
      author: workflow_run.actor?.login || 'unknown',
      branch: workflow_run.head_branch,
      status: workflow_run.conclusion || 'pending',
      time: new Date().toISOString()
    };

    console.log(`[webhook]: Processing deployment event for ${deploymentData.service_name} (${deploymentData.status}).`);

    // 4. Asynchronously relay to the Data Service (non-blocking)
    reportDeployment(deploymentData).catch(err => {
      console.error('[webhook]: Background relay failed:', err);
    });

  } catch (error) {
    console.error('[webhook]: Critical failure in webhook handler:', error);
    // Note: We've likely already responded 200 to GitHub by this point
  }
};
