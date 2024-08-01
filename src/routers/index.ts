import { Application } from "express-serve-static-core";
import { RedisClientType } from 'redis';
import { createUserRoute } from "./v1/user.route";
import { createMainRoute } from "./v1/main.route";
import { createTransactionsRoute } from "./v1/transactions.route";
import { createStatisticRouter } from "./v1/statistic.route";

export const routeApp = (app: Application, redisClient: RedisClientType) => {
    // V1 routes
    app.use("/api/v1", createMainRoute(redisClient));
    app.use("/api/v1/user", createUserRoute(redisClient));
    app.use("/api/v1/transactions", createTransactionsRoute(redisClient));
    app.use("/api/v1/statistic", createStatisticRouter(redisClient));
};