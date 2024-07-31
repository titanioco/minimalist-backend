import { Application } from "express";
import { userRouteV1 } from "./v1/user.route";
import { mainRouteV1 } from "./v1/main.route";
import { transactionsRouteV1 } from "./v1/transactions.route";
import { statisticRouteV1 } from "./v1/statistic.route";

export const routeApp = (app: Application) => {
    // V1 routes
    app.use("/api/v1", mainRouteV1);
    app.use("/api/v1/user", userRouteV1);
    app.use("/api/v1/transactions", transactionsRouteV1);
    app.use("/api/v1/statistic", statisticRouteV1);

    // For future versions
    // app.use("/api/v2", mainRouteV2);
    // app.use("/api/v2/user", userRouteV2);
    // ...
};