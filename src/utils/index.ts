//src\utils\index.ts
import "dotenv/config";
import BigNumberJS from "bignumber.js";
import { ethers, BigNumber  } from "ethers";
import { ChainId } from "./types/types";

export const NETWORK: number = parseInt(
  process.env.NETWORK
);

export const PRIVATE_KEY: string = process.env.PRIVATE_KEY!;
export const LEDGER_ADDRESS: string = process.env.LEDGER_ADDRESS!;

export const BIG_ZERO = new BigNumberJS(0);
export const BIG_ONE = new BigNumberJS(1);
export const BIG_TEN = new BigNumberJS(10);

export const TEN_POW = (value: string | number) => BigNumberJS(10).pow(value);

export const getDecimalAmount = (amount: BigNumberJS, decimals = 18) => {
  return new BigNumberJS(amount).times(BIG_TEN.pow(decimals));
};

export const getBalanceAmount = (amount: BigNumberJS, decimals = 18) => {
  return new BigNumberJS(amount).dividedBy(BIG_TEN.pow(decimals));
};

export const run = async (func: () => Promise<any>, times: number = 10) => {
  let count = 0;
  let success = false;
  let response: any;
  let error: any;
  while (count < times && !success) {
    try {
      response = await func();
      success = true;
    } catch (err) {
      count++;
      error = err;
    }
  }
  if (success) {
    return response;
  }
  throw new Error(error);
};

export function calculateGasMargin(value: BigNumber | string | number): BigNumber {
  const bigNumberValue = BigNumber.from(value);
  return bigNumberValue.mul(180).div(100);
}