import { ethers as ethersV6 } from "ethers";
import * as ethersV5 from "ethers-v5";

export const convertToV5Provider = (v6Provider: ethersV6.Provider): ethersV5.providers.Provider => {
  // This is a simple conversion and might need to be expanded based on your specific needs
  return new ethersV5.providers.Web3Provider(v6Provider as any);
};

export const getParaSwapProvider = (provider: ethersV6.Provider) => {
  return convertToV5Provider(provider);
};