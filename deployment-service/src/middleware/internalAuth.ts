import type { Request, Response, NextFunction } from 'express';

/**
 * Internal Service Authentication Middleware
 *
 * Protects endpoints that should only be callable by trusted internal
 * services. Validates the `x-internal-token` header against the
 * `INTERNAL_SERVICE_TOKEN` environment variable.
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const providedToken = req.headers['x-internal-token'];

  if (typeof providedToken !== 'string' || providedToken !== process.env['INTERNAL_SERVICE_TOKEN']) {
    res.status(403).json({ error: 'Forbidden: invalid or missing internal token' });
    return;
  }

  next();
}
