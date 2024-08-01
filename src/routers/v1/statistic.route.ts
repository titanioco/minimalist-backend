import express from "express";
import { statisticController } from "../../controllers/statistic.controller";
import { RedisClientType } from 'redis';

export const createStatisticRouter = (redisClient: RedisClientType) => {
  const router = express.Router();
  const controller = statisticController(redisClient);

  router.get("/wallets-linked", controller.getWalletsLinked);
  router.get("/wallets-opened-statistic", controller.walletsOpenedStatistic);
  router.get("/total-stack", controller.getCurrentStackValue);
  router.get("/number-wallet-closed", controller.getNumberWalletsOutApp);
  router.get("/wallets-created-by-affiliate", controller.getNumberWalletsCreatedByAffiliate);
  router.get("/total-deposit-from-stack-inception", controller.getTotalDepositFromStackInception);
  router.get("/total-btc-eth-deposit-from-stack-inception", controller.getTotalBTCAndETHDepositFromStackInception);
  router.get("/total-usdc-withdraw", controller.getTotalWithdraw);
  router.get("/wallets-deposited-morethan-4-times", controller.getWalletsDepositedMorethan4Times);
  router.get("/total-btc-eth-swapped", controller.getTotalBTCAndETHSwapped);

  return router;
};