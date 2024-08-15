import { userController } from "../../controllers/user.controller";
import express from "express";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { asyncErrorHandler } from '../../middleware/errorHandler';

export const createMainRoute = (redisClient: RedisClientType, dataSource: DataSource) => {
    const router = express.Router();
    const { getNonce, getUsers } = userController(redisClient, dataSource);

    router.get("/nonce/:address", asyncErrorHandler(getNonce));
    router.get("/users", asyncErrorHandler(getUsers));

    return router;
};