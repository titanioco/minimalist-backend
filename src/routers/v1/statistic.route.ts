import express from "express";
import { statisticController } from "../../controllers/statistic.controller";
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { asyncErrorHandler } from '../../middleware/errorHandler';

export const createStatisticRouter = (redisClient: RedisClientType, dataSource: DataSource) => {
  const router = express.Router();
  const controller = statisticController(redisClient, dataSource);

  router.get("/wallets-linked", asyncErrorHandler(controller.getWalletsLinked));
  router.get("/wallets-opened-statistic", asyncErrorHandler(controller.walletsOpenedStatistic));
  router.get("/total-stack", asyncErrorHandler(controller.getCurrentStackValue));
  router.get("/number-wallet-closed", asyncErrorHandler(controller.getNumberWalletsOutApp));
  router.get("/wallets-created-by-affiliate", asyncErrorHandler(controller.getNumberWalletsCreatedByAffiliate));
  router.get("/total-deposit-from-stack-inception", asyncErrorHandler(controller.getTotalDepositFromStackInception));
  router.get("/total-btc-eth-deposit-from-stack-inception", asyncErrorHandler(controller.getTotalBTCAndETHDepositFromStackInception));
  router.get("/total-usdc-withdraw", asyncErrorHandler(controller.getTotalWithdraw));
  router.get("/wallets-deposited-morethan-4-times", asyncErrorHandler(controller.getWalletsDepositedMorethan4Times));
  router.get("/total-btc-eth-swapped", asyncErrorHandler(controller.getTotalBTCAndETHSwapped));

  return router;
};