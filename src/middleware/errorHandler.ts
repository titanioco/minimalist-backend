import { Request, Response, NextFunction } from 'express-serve-static-core';
import { logger } from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
};