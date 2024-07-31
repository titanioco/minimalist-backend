import express from "express";
import auth from "middlewares/auth";
import {
	getChildren,
	getUser,
	getUserByCode,
	getYTD,
	register,
	setUserNeedUpdate,
	updateUser,
} from "controllers/user.controllers";

const userRouteV1 = express.Router();

userRouteV1.get("/code/:code", getUserByCode);
userRouteV1.get("/children/:address", getChildren);
userRouteV1.get("/ytd/:address", getYTD);
userRouteV1.get("/:address", getUser);
userRouteV1.post("/:address", auth, register);
userRouteV1.put("/set_need_update/:address", setUserNeedUpdate);
userRouteV1.put("/:address", auth, updateUser);

export { userRouteV1 };
