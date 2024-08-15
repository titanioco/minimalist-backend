// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express-serve-static-core';
import logger from '../utils/logger';

export const errorHandlerMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log the error
  logger.error(`Error occurred: ${err.message}`, (req as any).transactionId, {
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: JSON.stringify(req.body),
    params: JSON.stringify(req.params),
    query: JSON.stringify(req.query)
  });

  // Check for specific error types
  if (err instanceof TypeError) {
    logger.error(`TypeError caught: ${err.message}`, (req as any).transactionId, {
      stack: err.stack,
    });
  }

  // Send error response
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message,
    transactionId: (req as any).transactionId 
  });
};

// Async error wrapper
export const asyncErrorHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};