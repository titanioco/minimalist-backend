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
import express from "express";

const statisticRouteV1 = express.Router();

statisticRouteV1.get("/wallets-linked", getWalletsLinked);
statisticRouteV1.get("/wallets-opened-statistic", walletsOpenedStatistic);
statisticRouteV1.get("/total-stack", getCurrentStackValue);
statisticRouteV1.get("/number-wallet-closed", getNumberWalletsOutApp);
statisticRouteV1.get("/wallets-created-by-affiliate", getNumberWalletsCreatedByAffiliate);
statisticRouteV1.get("/total-deposit-from-stack-inception", getTotalDepositFromStackInception);
statisticRouteV1.get("/total-btc-eth-deposit-from-stack-inception", getTotalBTCAndETHDepositFromStackInception);
statisticRouteV1.get("/total-usdc-withdraw", getTotalWithdraw);
statisticRouteV1.get("/wallets-deposited-morethan-4-times", getWalletsDepositedMorethan4Times);
statisticRouteV1.get("/total-btc-eth-swapped", getTotalBTCAndETHSwapped);

export { statisticRouteV1 };
