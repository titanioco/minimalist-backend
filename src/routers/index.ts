import { Application, Router } from "express-serve-static-core";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { createUserRoute } from "./v1/user.route";
import { createMainRoute } from "./v1/main.route";
import { createTransactionsRoute } from "./v1/transactions.route";
import { createStatisticRouter } from "./v1/statistic.route";
import logger from '../utils/logger';
import logRoutes from "../utils/logRoutes";

export const routeApp = (app: Application, redisClient: RedisClientType, dataSource: DataSource) => {
    // V1 routes
    const mainRouter: Router = createMainRoute(redisClient, dataSource);
    const userRouter: Router = createUserRoute(redisClient, dataSource);
    const transactionsRouter: Router = createTransactionsRoute(redisClient, dataSource);
    const statisticRouter: Router = createStatisticRouter(redisClient, dataSource);

    app.use("/api/v1", mainRouter);
    app.use("/api/v1/user", userRouter);
    app.use("/api/v1/transactions", transactionsRouter);
    app.use("/api/v1/statistic", statisticRouter);

    logger.info('Routes have been set up');
    logRoutes(app);
};