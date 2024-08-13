import { userController } from "../../controllers/user.controller";
import express from "express";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';

export const createMainRoute = (redisClient: RedisClientType, dataSource: DataSource) => {
    const router = express.Router();
    const { getNonce, getUsers } = userController(redisClient, dataSource);

    router.get("/nonce/:address", getNonce);
    router.get("/users", getUsers);

    // router.get("/handle_transactions", handleTransactions);
    // router.get("/handle_deposit", handleDeposit);
    // router.get("/handle_swap", handleSwap);
    // router.get("/handle_hf", handleHF);

    return router;
};