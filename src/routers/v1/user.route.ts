import express from 'express';
import { Router } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import auth, { authRateLimiter } from "../../middleware/auth";
import { userController } from "../../controllers/user.controller";

const createUserRoute = (redisClient: RedisClientType, dataSource: DataSource): Router => {
    const router = express.Router() as Router;
    
    const {
        getChildren,
        getUser,
        getUserByCode,
        getYTD,
        register,
        setUserNeedUpdate,
        updateUser
    } = userController(redisClient, dataSource);

    // Public routes
    router.get("/code/:code", getUserByCode);
    router.get("/children/:address", getChildren);
    router.get("/ytd/:address", getYTD);
    router.get("/:address", getUser);

    // Protected routes with rate limiting
    router.post("/:address", authRateLimiter, auth, register);
    router.put("/set_need_update/:address", authRateLimiter, auth, setUserNeedUpdate);
    router.put("/:address", authRateLimiter, auth, updateUser);

    return router;
};

export { createUserRoute };