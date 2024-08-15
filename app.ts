import "reflect-metadata";
import express from 'express';
import { Application } from 'express-serve-static-core';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient, RedisClientType } from 'redis';
import { routeApp } from './src/routers';
import { loggerMiddleware } from './src/middleware/logHandler';
import { errorHandlerMiddleware } from "./src/middleware/errorHandler";
import { initializeDataSource, closeDataSource, AppDataSource } from './src/database';
import { setupCronJobs } from './src/cronjobs/cronJobs';
import { REDIS_URL, PORT } from './src/utils/enviroments';
import logger, { generateTransactionId } from './src/utils/logger';
import cors from 'cors';

const app: Application = express();

// Redis client setup
const redisClient: RedisClientType = createClient({
    url: REDIS_URL,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return new Error('Max retries reached');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});


redisClient.on('error', (err) => logger.error('Redis Client Error', generateTransactionId(), { error: err }));
redisClient.on('connect', () => logger.info('Redis Client Connected', generateTransactionId()));
redisClient.on('reconnecting', () => logger.info('Redis Client Reconnecting', generateTransactionId()));

async function startServer() {
    try {
        await redisClient.connect();
        logger.info('Redis client connected', generateTransactionId());
        // Logger middleware - add this as the first middleware
        app.use(cors())
        logger.info('CORS middleware set up', generateTransactionId());
        app.use(loggerMiddleware);
        logger.info('Logger middleware set up', generateTransactionId());
        // Other middleware
        app.use(helmet());
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        logger.info('Basic middleware set up', generateTransactionId());
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        app.use(limiter);

        // Health check route
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                redis: redisClient.isOpen ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        // Database setup
        await initializeDataSource();
        logger.info('Database connected successfully', generateTransactionId());

        // Routes
        routeApp(app, redisClient, AppDataSource);
        logger.info('Routes have been set up', generateTransactionId());

        // Error handling middleware - keep this as the last middleware
        app.use(errorHandlerMiddleware);
        logger.info('Error handling middleware set up', generateTransactionId());

        const server = app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`, generateTransactionId());

            // Setup and start cron jobs
            setupCronJobs(redisClient, AppDataSource);
            logger.info('Cron jobs have been set up', generateTransactionId());
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...', generateTransactionId());
            await redisClient.quit();
            await closeDataSource();
            server.close(() => {
                logger.info('Server closed', generateTransactionId());
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start server:', generateTransactionId(), { error });
        process.exit(1);
    }
}

logger.info(`Server starting in ${process.env.NODE_ENV || 'development'} mode`, generateTransactionId());
startServer().catch(error => {
    logger.error('Unhandled error during server startup:', generateTransactionId(), { error });
    process.exit(1);
});

export default app;