import { ethers } from "ethers";
import { provider } from "../provider";
import ERC20_ABI from "./ERC20.json";
import IPool_ABI from "./IPool.json";
import Wallet_ABI from "./Wallet.json";
import Ledger_ABI from "./Ledger.json";
import Aggregator_ABI from "./Aggregator.json";

const getContract = (
  abi: any,
  address: string,
  signer?: ethers.Signer | ethers.providers.Provider
) => {
  const signerOrProvider = signer ?? provider;
  return new ethers.Contract(address, abi, signerOrProvider);
};

export const getToken = (
  address: string,
  signer?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(ERC20_ABI, address, signer);
};

export const getIPool = (
  address: string,
  signer?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(IPool_ABI, address, signer);
};

export const getWallet = (
  address: string,
  signer?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(Wallet_ABI, address, signer);
};

export const getLedger = (
  address: string,
  signer?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(Ledger_ABI, address, signer);
};

export const getAggregator = (address: string) => {
  return getContract(Aggregator_ABI, address);
};
