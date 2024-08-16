import express from "express";
import { Router } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { transactionController } from "../../controllers/transaction.controller";
import { asyncErrorHandler } from '../../middleware/errorHandler';

const createTransactionsRoute = (dataSource: DataSource): Router => {
    const router = express.Router() as Router;

    const {
        getTransactions,
        getTransaction,
        getRefTransactions
    } = transactionController(dataSource);

    router.get("/:address", asyncErrorHandler(getTransactions));
    router.get("/txn/:hash", asyncErrorHandler(getTransaction));
    router.get("/ref/:address", asyncErrorHandler(getRefTransactions));

    return router;
};

export { createTransactionsRoute };