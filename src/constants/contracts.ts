import { LEDGER_ADDRESS, NETWORK } from "../utils";
import { ChainId } from "../utils/types";

export interface Address {
	137: string;
	4002: string;
}

const contracts: { [contract: string]: { [chainId in ChainId]: string } } = {
	iPool: {
		137: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
		4002: "",
	},
	swapper: {
		137: "0x301F221bc732907E2da2dbBFaA8F8F6847c170c3",
		4002: "",
	},
	ledger: {
		137: LEDGER_ADDRESS,
		4002: "",
	},
};

const startBlock: { [chainId in ChainId]: number } = {
	[ChainId.POLYGON]: 42445030,
	[ChainId.FTM_TESTNET]: 0,
};

export const getStartBlock = (chainId: ChainId = NETWORK) => {
	return startBlock[chainId];
};

export const getAddress = (address: Address, chainId: ChainId = NETWORK): string => {
	return address[chainId];
};

export const getIPoolAddress = (chainId: ChainId = NETWORK) => {
	return getAddress(contracts.iPool, chainId);
};

export const getSwapperAddress = (chainId: ChainId = NETWORK) => {
	return getAddress(contracts.swapper, chainId);
};

export const getLedgerAddress = (chainId: ChainId = NETWORK) => {
	return getAddress(contracts.ledger, chainId);
};

export default contracts;
