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
  signerOrProvider?: ethers.Signer | ethers.providers.Provider
) => {
  const signerOrProviderToUse = signerOrProvider ?? provider;
  return new ethers.Contract(address, abi, signerOrProviderToUse);
};

export const getToken = (
  address: string,
  signerOrProvider?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(ERC20_ABI, address, signerOrProvider);
};

export const getIPool = (
  address: string,
  signerOrProvider?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(IPool_ABI, address, signerOrProvider);
};

export const getWallet = (
  address: string,
  signerOrProvider?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(Wallet_ABI, address, signerOrProvider);
};

export const getLedger = (
  address: string,
  signerOrProvider?: ethers.Signer | ethers.providers.Provider
) => {
  return getContract(Ledger_ABI, address, signerOrProvider);
};

export const getAggregator = (address: string) => {
  return getContract(Aggregator_ABI, address);
};