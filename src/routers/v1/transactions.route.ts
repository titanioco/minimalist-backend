import express from "express";
import { Router } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { transactionController } from "../../controllers/transaction.controller";

const createTransactionsRoute = (redisClient: RedisClientType): Router => {
	const router = express.Router() as Router;

	const {
		getTransactions,
		getTransaction,
		getRefTransactions
	} = transactionController(redisClient);

	router.get("/:address", getTransactions);
	router.get("/txn/:hash", getTransaction);
	router.get("/ref/:address", getRefTransactions);

	return router;
};

export { createTransactionsRoute };