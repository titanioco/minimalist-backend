import express from "express";
import { RedisClientType } from 'redis';
import auth, { authRateLimiter } from "../../middleware/auth";
import { userController } from "../../controllers/user.controller";

const createUserRouteV1 = (redisClient: RedisClientType) => {
	const router = express.Router();
	const {
		getChildren,
		getUser,
		getUserByCode,
		getYTD,
		register,
		setUserNeedUpdate,
		updateUser
	} = userController(redisClient);

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

export { createUserRouteV1 };