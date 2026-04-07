import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------
const GITHUB_OWNER = process.env['GITHUB_OWNER'];
const GITHUB_REPO = process.env['GITHUB_REPO'];
const GITHUB_PAT = process.env['GITHUB_PAT'];

if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_PAT) {
  console.warn(
    '[rollback] WARNING: GITHUB_OWNER, GITHUB_REPO, and GITHUB_PAT ' +
    'must be set in the environment for the rollback endpoint to work.',
  );
}

const DISPATCH_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`;

// ---------------------------------------------------------------------------
// Rollback Controller
// ---------------------------------------------------------------------------

interface RollbackBody {
  target_commit_hash: string;
  service_name: string;
}

export async function handleRollback(req: Request, res: Response): Promise<void> {
  const { target_commit_hash, service_name } = req.body as Partial<RollbackBody>;

  if (!target_commit_hash || !service_name) {
    res.status(400).json({ error: 'Both target_commit_hash and service_name are required' });
    return;
  }

  const payload = {
    event_type: 'trigger-rollback',
    client_payload: {
      target_commit_hash,
      service_name,
    },
  };

  try {
    const response = await fetch(DISPATCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // GitHub returns 204 No Content on successful dispatch.
    // Anything outside 2xx indicates a failure.
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        '[rollback] GitHub API returned %s: %s',
        response.status,
        errorBody,
      );
      res.status(response.status).json({
        error: `GitHub API error (${response.status})`,
        detail: errorBody,
      });
      return;
    }

    console.log(
      '[rollback] Dispatch accepted — service=%s commit=%s',
      service_name,
      target_commit_hash,
    );

    res.status(200).json({
      status: 'accepted',
      service_name,
      target_commit_hash,
      message: 'Rollback triggered successfully',
    });
  } catch (err) {
    console.error('[rollback] Exception while triggering dispatch:', err);
    res.status(500).json({ error: 'Internal server error while contacting GitHub' });
  }
}
