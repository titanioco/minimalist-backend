import express, { Application } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient, RedisClientType } from 'redis';
import { routeApp } from './src/routers';
import { errorHandler } from './src/middleware/errorHandler';
import { setupDatabase } from './src/database';

const app: Application = express();

// Redis client setup
const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

async function startServer() {
    await redisClient.connect();

    // Middleware
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

    // Error handling middleware
    app.use(errorHandler);

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer().catch(console.error);

export default app;