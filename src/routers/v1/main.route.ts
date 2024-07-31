import { userController } from "../../controllers/user.controller";
import express from "express";
import { RedisClientType } from 'redis';

export const createMainRouteV1 = (redisClient: RedisClientType) => {
    const router = express.Router();
    const { getNonce, getUsers } = userController(redisClient);

    router.get("/nonce/:address", getNonce);
    router.get("/users", getUsers);

    // router.get("/handle_transactions", handleTransactions);
    // router.get("/handle_deposit", handleDeposit);
    // router.get("/handle_swap", handleSwap);
    // router.get("/handle_hf", handleHF);

    return router;
};