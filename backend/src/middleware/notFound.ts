import { Request, Response, NextFunction } from 'express';

/**
 * 404 handler middleware
 * Handles requests to unknown routes
 */
export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

