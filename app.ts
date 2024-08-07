import express, { Application } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient, RedisClientType } from 'redis';
import { routeApp } from './src/routers';
import { errorHandlerMiddleware, loggerMiddleware } from './src/middleware/logHandler';
import { setupDatabase } from './src/database';
import { setupCronJobs } from './src/cronjobs/cronJobs';

const app: Application = express();

// Redis client setup
const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true,
        rejectUnauthorized: false, // Only if using self-signed certificates
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return new Error('Max retries reached');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

async function startServer() {
    try {
        await redisClient.connect();

        // Logger middleware - add this as the first middleware
        app.use(loggerMiddleware);

        // Other middleware
        app.use(helmet());
        app.use(compression());
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        app.use(limiter);

        // Database setup
        await setupDatabase();

        // Routes
        routeApp(app, redisClient);

        // Error handling middleware - keep this as the last middleware
        app.use(errorHandlerMiddleware);

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            
            // Setup and start cron jobs
            setupCronJobs(redisClient);
            console.log('Cron jobs have been set up');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer().catch(console.error);

export default app;