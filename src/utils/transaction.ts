import { ethers, utils } from "ethers";
import BigNumber from "bignumber.js";
import axios from "axios";
import { provider } from "./provider";

export interface TransactionOverrides {
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
}

export const getOverrides = async (): Promise<TransactionOverrides> => {
  const { data } = await axios.get(
    "https://gasstation.polygon.technology/v2"
  );
  const maxFeePerGas = utils.parseUnits(
    Math.ceil(data.fast.maxFee).toString(),
    "gwei"
  );
  const maxPriorityFeePerGas = utils.parseUnits(
    Math.ceil(data.fast.maxPriorityFee).toString(),
    "gwei"
  );
  return {
    maxFeePerGas: new BigNumber(maxFeePerGas.toString()),
    maxPriorityFeePerGas: new BigNumber(maxPriorityFeePerGas.toString()),
  };
};

export const getGasUse = async (
  overrides: TransactionOverrides,
  gasLimit: BigNumber
): Promise<BigNumber> => {
  let gasPrice = await provider.getFeeData();
  const gasPriceBN = new BigNumber(gasPrice.gasPrice?.toString() || "0");
  return gasPriceBN.plus(overrides.maxPriorityFeePerGas).multipliedBy(gasLimit);
};