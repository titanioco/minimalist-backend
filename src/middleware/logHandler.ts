import { Request, Response, NextFunction } from 'express-serve-static-core';
import { v4 as uuidv4 } from 'uuid';
import logger, { logRequest, logError } from '../utils/logger';

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Assign a unique ID to the request
    (req as any).id = uuidv4();

    // Log the incoming request
    logRequest(req);

    // Log the response
    res.on('finish', () => {
        const statusCode = res.statusCode;
        const logMessage = `${req.method} ${req.url} ${statusCode}`;
        if (statusCode >= 400) {
            logger.warn(logMessage, { requestId: (req as any).id });
        } else {
            logger.info(logMessage, { requestId: (req as any).id });
        }
    });

    next();
};

export const errorHandlerMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logError(err, req);
    res.status(500).json({ error: 'Internal Server Error', requestId: (req as any).id });
};