// config.ts

import { ChainId } from "../utils/types";

// Define types for our configuration
type AddressConfig = {
  [contract: string]: { [chainId in ChainId]: string };
};

type TokenConfig = {
  [tokenName: string]: {
    [chainId in ChainId]: {
      name: string;
      symbol: string;
      address: string;
      aToken: string;
      decimals: number;
      LT: number;
      aggregator: string;
    } | null;
  };
};

type Config = {
  contracts: AddressConfig;
  tokens: TokenConfig;
  startBlock: { [chainId in ChainId]: number };
};

// Create the configuration object
const config: Config = {
  contracts: {
    iPool: {
      137: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      4002: "",
    },
    swapper: {
      137: "0x301F221bc732907E2da2dbBFaA8F8F6847c170c3",
      4002: "",
    },
    ledger: {
      137: "LEDGER_ADDRESS", // Replace with actual address
      4002: "",
    },
  },
  tokens: {
    USDC: {
      137: {
        name: "usdc",
        symbol: "USDC",
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        aToken: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
        decimals: 6,
        LT: 0.93,
        aggregator: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7",
      },
      4002: null,
    },
    // Add other tokens here (WMATIC, WETH, WBTC)
  },
  startBlock: {
    137: 42445030,
    4002: 0,
  },
};

// Function to get a specific part of the configuration
function getConfig<T>(path: string): T {
  return path.split('.').reduce((acc: any, part: string) => acc && acc[part], config) as T;
}

// Export functions to get specific parts of the configuration
export const getContractAddress = (contract: string, chainId: ChainId): string => 
  getConfig<AddressConfig>('contracts')[contract][chainId];

export const getTokenConfig = (token: string, chainId: ChainId) => 
  getConfig<TokenConfig>('tokens')[token][chainId];

export const getStartBlock = (chainId: ChainId): number => 
  getConfig<{ [chainId in ChainId]: number }>('startBlock')[chainId];

// You can add more specific getter functions as needed

export default getConfig; 