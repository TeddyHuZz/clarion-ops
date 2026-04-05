import type { Request, Response, NextFunction } from 'express';

/**
 * Placeholder for Clerk JWT verification middleware.
 * This will be expanded in the next phase to include clerk-sdk-node integration.
 */
export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  // TODO: Implement actual Clerk JWT verification
  // const token = req.headers.authorization?.split(' ')[1];
  
  // For now, keep it as a pass-through placeholder for scaffolding
  console.log('[auth]: Placeholder check for request to', req.path);
  
  // Simulated success
  next();
};

/**
 * Error Handler for Auth Failures
 */
export const handleAuthError = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }
  res.status(500).json({ error: 'Internal Server Error during authentication' });
};
