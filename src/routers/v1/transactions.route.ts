import express from "express";
import {
	getRefTransactions,
	getTransaction,
	getTransactions,
} from "controllers/transaction.controllers";

const transactionsRouteV1 = express.Router();

transactionsRouteV1.get("/:address", getTransactions);
transactionsRouteV1.get("/txn/:hash", getTransaction);
transactionsRouteV1.get("/ref/:address", getRefTransactions);

export { transactionsRouteV1 };
