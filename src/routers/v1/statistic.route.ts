import express from "express";
import { RedisClientType } from 'redis';
import {
	getNumberWalletsCreatedByAffiliate,
	getNumberWalletsOutApp,
	getTotalBTCAndETHDepositFromStackInception,
	getTotalDepositFromStackInception,
	getCurrentStackValue,
	getTotalWithdraw,
	getWalletsDepositedMorethan4Times,
	getWalletsLinked,
	walletsOpenedStatistic,
	getTotalBTCAndETHSwapped,
} from "controllers/statistic.controllers";

const createStatisticRouteV1 = (redisClient: RedisClientType) => {
	const router = express.Router();

	router.get("/wallets-linked", getWalletsLinked);
	router.get("/wallets-opened-statistic", walletsOpenedStatistic);
	router.get("/total-stack", getCurrentStackValue);
	router.get("/number-wallet-closed", getNumberWalletsOutApp);
	router.get("/wallets-created-by-affiliate", getNumberWalletsCreatedByAffiliate);
	router.get("/total-deposit-from-stack-inception", getTotalDepositFromStackInception);
	router.get("/total-btc-eth-deposit-from-stack-inception", getTotalBTCAndETHDepositFromStackInception);
	router.get("/total-usdc-withdraw", getTotalWithdraw);
	router.get("/wallets-deposited-morethan-4-times", getWalletsDepositedMorethan4Times);
	router.get("/total-btc-eth-swapped", getTotalBTCAndETHSwapped);

	return router;
};

export { createStatisticRouteV1 };