import { BigNumber, ethers } from "ethers";
import BigNumberJS from "bignumber.js";
import axios from "axios";
import { provider } from "./provider";

export interface TransactionOverrides {
  maxFeePerGas: BigNumberJS;
  maxPriorityFeePerGas: BigNumberJS;
}

export const getOverrides = async (): Promise<TransactionOverrides> => {
  const { data } = await axios.get(
    "https://gasstation.polygon.technology/v2"
  );
  const maxFeePerGas = ethers.utils.parseUnits(
    Math.ceil(data.fast.maxFee) + "",
    "gwei"
  );
  const maxPriorityFeePerGas = ethers.utils.parseUnits(
    Math.ceil(data.fast.maxPriorityFee) + "",
    "gwei"
  );
  return {
    maxFeePerGas: BigNumberJS(maxFeePerGas.toString()),
    maxPriorityFeePerGas: BigNumberJS(maxPriorityFeePerGas.toString()),
  };
};

export const getGasUse = async (
  overrides: TransactionOverrides,
  gasLimit: BigNumberJS
): Promise<BigNumberJS> => {
  let gasPrice: BigNumber | BigNumberJS = await provider.getGasPrice();
  gasPrice = BigNumberJS(gasPrice.toString());
  return gasPrice.plus(overrides.maxPriorityFeePerGas).multipliedBy(gasLimit);
};
