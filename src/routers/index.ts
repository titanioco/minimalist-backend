import { Application } from "express-serve-static-core";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { createUserRoute } from "./v1/user.route";
import { createMainRoute } from "./v1/main.route";
import { createTransactionsRoute } from "./v1/transactions.route";
import { createStatisticRouter } from "./v1/statistic.route";

export const routeApp = (app: Application, redisClient: RedisClientType, dataSource: DataSource) => {
    // V1 routes
    app.use("/api/v1", createMainRoute(redisClient, dataSource));
    app.use("/api/v1/user", createUserRoute(redisClient, dataSource));
    app.use("/api/v1/transactions", createTransactionsRoute(redisClient, dataSource));
    app.use("/api/v1/statistic", createStatisticRouter(redisClient, dataSource));
};