/**
 * Global Error Handler Middleware
 * Logs errors and returns safe error responses
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export default function errorHandler(
  err: Error | unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log full error details
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
    },
    'Unhandled error'
  );

  // Never expose stack trace in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      ...(isProduction ? {} : { message: err instanceof Error ? err.message : 'Unknown error' }),
    });
  }

  next();
}
