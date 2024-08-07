import "reflect-metadata";
import express from 'express';
import { Request, Response, Application } from 'express-serve-static-core';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient, RedisClientType } from 'redis';
import { routeApp } from './src/routers';
import { errorHandlerMiddleware, loggerMiddleware } from './src/middleware/logHandler';
import { setupDatabase } from './src/database';
import { setupCronJobs } from './src/cronjobs/cronJobs';
import { REDIS_URL, PORT } from './src/utils/enviroments';
import logger from './src/utils/logger';

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

redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err }));
redisClient.on('connect', () => logger.info('Redis Client Connected'));
redisClient.on('reconnecting', () => logger.info('Redis Client Reconnecting'));

async function startServer() {
    try {
        await redisClient.connect();

        // Logger middleware - add this as the first middleware
        app.use(loggerMiddleware);

        // Other middleware
        app.use(helmet());
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        app.use(limiter);

        // Health check route
        app.get('/health', (req: Request, res: Response) => {
            res.status(200).json({
                status: 'OK',
                redis: redisClient.isOpen ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        // Database setup
        await setupDatabase();

        // Routes
        routeApp(app, redisClient);

        // Error handling middleware - keep this as the last middleware
        app.use(errorHandlerMiddleware);

        const server = app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
            
            // Setup and start cron jobs
            setupCronJobs(redisClient);
            logger.info('Cron jobs have been set up');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...');
            await redisClient.quit();
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start server:', { error });
        process.exit(1);
    }
}

logger.info(`Server starting in ${process.env.NODE_ENV || 'development'} mode`);
startServer().catch(error => {
    logger.error('Unhandled error during server startup:', { error });
    process.exit(1);
});

export default app;