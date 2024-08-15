import { Request, Response, NextFunction } from 'express-serve-static-core';
import logger, { generateTransactionId, logRequest, logError } from '../utils/logger';

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Assign a unique transaction ID to the request
    (req as any).transactionId = generateTransactionId();
    
    // Log the incoming request
    logRequest(req);
    
    // Log the response
    res.on('finish', () => {
        const statusCode = res.statusCode;
        const logMessage = `${req.method} ${req.url} ${statusCode}`;
        if (statusCode >= 400) {
            logger.warn(logMessage, (req as any).transactionId);
        } else {
            logger.info(logMessage, (req as any).transactionId);
        }
    });
    
    next();
};