import { Application } from "express-serve-static-core";
import { RedisClientType } from 'redis';
import { createUserRouteV1 } from "./v1/user.route";
import { createMainRouteV1 } from "./v1/main.route";
import { createTransactionsRouteV1 } from "./v1/transactions.route";
import { createStatisticRouteV1 } from "./v1/statistic.route";

export const routeApp = (app: Application, redisClient: RedisClientType) => {
    // V1 routes
    app.use("/api/v1", createMainRouteV1(redisClient));
    app.use("/api/v1/user", createUserRouteV1(redisClient));
    app.use("/api/v1/transactions", createTransactionsRouteV1(redisClient));
    app.use("/api/v1/statistic", createStatisticRouteV1(redisClient));
};