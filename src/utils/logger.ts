import winston from 'winston';
import { Request } from 'express-serve-static-core';
import { v4 as uuidv4 } from 'uuid';

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

const winstonLogger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.transactionId ? `[TransactionID: ${info.transactionId}]` : ''} ${info.metadata ? JSON.stringify(info.metadata) : ''}`,
        ),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/all.log' }),
    ],
});

export const generateTransactionId = () => uuidv4();

export const logWithTransaction = (level: string, message: string, transactionId?: string, metadata?: any) => {
    winstonLogger.log(level, message, { transactionId, metadata });
};

export const logRequest = (req: Request, message?: string) => {
    const logMessage = message || `${req.method} ${req.url}`;
    const transactionId = (req as any).transactionId;
    logWithTransaction('http', logMessage, transactionId);
};

export const logError = (err: Error, req?: Request) => {
    const transactionId = req ? (req as any).transactionId : undefined;
    logWithTransaction('error', `${err.name}: ${err.message}`, transactionId, { stack: err.stack });
};

export const info = (message: string, transactionId?: string, metadata?: any) => logWithTransaction('info', message, transactionId, metadata);
export const warn = (message: string, transactionId?: string, metadata?: any) => logWithTransaction('warn', message, transactionId, metadata);
export const error = (message: string, transactionId?: string, metadata?: any) => logWithTransaction('error', message, transactionId, metadata);
export const http = (message: string, transactionId?: string, metadata?: any) => logWithTransaction('http', message, transactionId, metadata);
export const debug = (message: string, transactionId?: string, metadata?: any) => logWithTransaction('debug', message, transactionId, metadata);

export default {
    info,
    warn,
    error,
    http,
    debug,
    logRequest,
    logError,
    generateTransactionId,
};