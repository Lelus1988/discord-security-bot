import { Request, Response, NextFunction } from 'express';

/** Redirect to login if the user is not authenticated. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user || !req.session.accessToken) {
    res.redirect('/auth/login');
    return;
  }
  next();
}

/** Return 401 JSON for unauthenticated API requests. */
export function requireAuthApi(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user || !req.session.accessToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
