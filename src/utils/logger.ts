import winston from 'winston';
import { Request } from 'express-serve-static-core';
import { v4 as uuidv4 } from 'uuid';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston that you want to link the colors 
winston.addColors(colors);

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.requestId ? `[RequestID: ${info.requestId}]` : ''}`,
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

// Create a stream object with a 'write' function that will be used by `morgan`
export const stream = {
    write: (message: string) => {
        logger.http(message);
    },
};

// Function to generate a unique ID
export const generateId = () => uuidv4();

// Function to log requests (with optional ID)
export const logRequest = (req: Request, message?: string) => {
    const logMessage = message || `${req.method} ${req.url}`;
    const requestId = (req as any).id;
    logger.http(logMessage, { requestId });
};

// Function to log errors (with optional ID)
export const logError = (err: Error, req?: Request) => {
    const requestId = req ? (req as any).id : undefined;
    logger.error(`${err.name}: ${err.message}`, { 
        requestId, 
        stack: err.stack 
    });
};

// Extend the logger with custom methods
const extendedLogger = {
    ...logger,
    logRequest,
    logError,
};

export default extendedLogger;