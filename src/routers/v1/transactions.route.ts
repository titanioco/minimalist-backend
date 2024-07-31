import express from "express";
import { RedisClientType } from 'redis';
import {
	getRefTransactions,
	getTransaction,
	getTransactions,
} from "controllers/transaction.controllers";

const createTransactionsRouteV1 = (redisClient: RedisClientType) => {
	const router = express.Router();

	router.get("/:address", getTransactions);
	router.get("/txn/:hash", getTransaction);
	router.get("/ref/:address", getRefTransactions);

	return router;
};

export { createTransactionsRouteV1 };