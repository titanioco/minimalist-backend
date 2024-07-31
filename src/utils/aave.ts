import { BigNumber } from "ethers";
import BigNumberJS from "bignumber.js";
import { getIPool, getToken } from "./abis";
import { provider } from "./provider";
import { TEN_POW } from ".";
import { UserEntity } from "./entities/user.entity";
import { getIPoolAddress } from "../constants/contracts";
import { getUSDC, getWBTC, getWETH, getWMATIC, Token } from "../constants/tokens";
import { getAggregator } from "./abis";

export const SWAP_RATIO: { [deposit_buffer: number]: number } = {
	10: 0.62,
	15: 1.14,
	20: 1.86,
	25: 2.17,
	30: 2.54,
	35: 2.97,
	40: 3.06,
};

export const convertEtherBNToBNJS = (value: BigNumber) => BigNumberJS(value.toString());

export const convertEtherBNToBNJSInObject = (
	object: Record<string, any | BigNumber>,
): Record<string, any | BigNumber> => {
	const newObject: Record<string, any | BigNumber> = {};
	for (const key in object) {
		if (Object.prototype.hasOwnProperty.call(object, key)) {
			const element = object[key];
			if (element._isBigNumber) {
				newObject[key] = convertEtherBNToBNJS(element);
			} else {
				newObject[key] = element;
			}
		}
	}
	return newObject;
};

export const getBalance = async (
	tokenAddress: string,
	address: string,
): Promise<BigNumberJS> => {
	const tokenContract = getToken(tokenAddress, provider);
	const balance = await tokenContract.balanceOf(address);
	return BigNumberJS(balance.toString());
};

export const getTokenPricing = async (): Promise<{
	[name: string]: BigNumberJS;
}> => {
	const tokens = [getUSDC(), getWMATIC(), getWETH(), getWBTC()];
	const prices = await Promise.all(
		tokens.map((token) => getAggregator(token.aggregator).latestAnswer()),
	);
	return prices.reduce((acc, cur, index) => {
		acc[tokens[index].symbol] = BigNumberJS(cur.toString()).div(TEN_POW(8));
		return acc;
	}, {});
};

export interface UserAccountData {
	totalCollateralBase: BigNumberJS;
	totalDebtBase: BigNumberJS;
	availableBorrowsBase: BigNumberJS;
	currentLiquidationThreshold: BigNumberJS;
	ltv: BigNumberJS;
	healthFactor: BigNumberJS;
}
export const getUserAccountData = async (user: UserEntity): Promise<UserAccountData> => {
	const iPoolContract = getIPool(getIPoolAddress(), provider);
	const data = await iPoolContract.getUserAccountData(user.wallet_address);
	return convertEtherBNToBNJSInObject(data) as UserAccountData;
};

export enum AppFeeType {
	DEPOSIT,
	WITHDRAW,
	BORROW,
	SWAP,
	AAVE,
}
export const APP_FEE: { [type in AppFeeType]: number } = {
	[AppFeeType.DEPOSIT]: 1.5,
	[AppFeeType.WITHDRAW]: 1.5,
	[AppFeeType.BORROW]: 1.5,
	[AppFeeType.SWAP]: 1.5,
	[AppFeeType.AAVE]: 0.5,
};
export const getAppFee = (
	transactionType: AppFeeType,
	volume: BigNumberJS,
): BigNumberJS => {
	return BigNumberJS(volume).multipliedBy(APP_FEE[transactionType]).div(100);
};

export enum ActionType {
	DEPOSIT,
	WITHDRAW,
}
export interface Action {
	token: Token;
	amount: BigNumberJS;
	tokenPrice: BigNumberJS;
	type: ActionType;
}
export const getHFAfterActions = (accountData: UserAccountData, actions: Action[]) => {
	const { totalCollateralBase, totalDebtBase, currentLiquidationThreshold } = accountData;
	let totalCollateral = totalCollateralBase
		.times(currentLiquidationThreshold)
		.div(10000)
		.div(TEN_POW(8));
	let totalDebt = BigNumberJS(totalDebtBase).div(TEN_POW(8));
	for (const { token, amount, tokenPrice, type } of actions) {
		if (type === ActionType.DEPOSIT) {
			totalCollateral = totalCollateral.plus(
				amount.multipliedBy(tokenPrice).multipliedBy(token.LT).div(TEN_POW(token.decimals)),
			);
		} else {
			totalDebt = totalDebt.plus(amount.multipliedBy(tokenPrice).div(TEN_POW(token.decimals)));
		}
	}
	return totalCollateral.div(totalDebt);
};
