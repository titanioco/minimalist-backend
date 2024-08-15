import express from 'express';
import { Router } from "express-serve-static-core";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { userController } from "../../controllers/user.controller";
import { asyncErrorHandler } from '../../middleware/errorHandler';

export const createUserRoute = (redisClient: RedisClientType, dataSource: DataSource): Router => {
    const router: Router = express.Router();
    const { getUser, getUserByCode, getChildren, getYTD, register, setUserNeedUpdate, updateUser } = userController(redisClient, dataSource);

    router.get("/code/:code", asyncErrorHandler(getUserByCode));
    router.get("/children/:address", asyncErrorHandler(getChildren));
    router.get("/ytd/:address", asyncErrorHandler(getYTD));
    router.get("/:address", asyncErrorHandler(getUser));
    router.post("/:address", asyncErrorHandler(register));
    router.put("/set_need_update/:address", asyncErrorHandler(setUserNeedUpdate));
    router.put("/:address", asyncErrorHandler(updateUser));

    return router;
};