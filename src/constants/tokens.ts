import { NETWORK } from "../utils";
import { ChainId } from "../utils/types/types";

export interface Token {
	name: string;
	symbol: string;
	address: string;
	aToken: string;
	decimals: number;
	LT: number;
	aggregator: string;
}

export type TokenMap = { [chainId in ChainId]: Token | null };

const getToken = (tokenMap: TokenMap, chainId: ChainId = NETWORK): Token => {
	return tokenMap[chainId]!;
};

export const USDC: TokenMap = {
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
};

export const WMATIC: TokenMap = {
	137: {
		name: "matic",
		symbol: "WMATIC",
		address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
		aToken: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
		decimals: 18,
		LT: 0.925,
		aggregator: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
	},
	4002: null,
};

export const WETH: TokenMap = {
	137: {
		name: "ethereum",
		symbol: "WETH",
		address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
		aToken: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
		decimals: 18,
		LT: 0.9,
		aggregator: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
	},
	4002: null,
};

export const WBTC: TokenMap = {
	137: {
		name: "bitcoin",
		symbol: "WBTC",
		address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
		aToken: "0x078f358208685046a11C85e8ad32895DED33A249",
		decimals: 8,
		LT: 0.73,
		aggregator: "0xc907E116054Ad103354f2D350FD2514433D57F6f",
	},
	4002: null,
};

export const getUSDCAddress = (chainId: ChainId = NETWORK): string => {
	// @ts-ignore
	return USDC[chainId].address as string;
};

export const getUSDC = (chainId: ChainId = NETWORK): Token => {
	return getToken(USDC, chainId);
};

export const getWMATIC = (chainId: ChainId = NETWORK): Token => {
	return getToken(WMATIC, chainId);
};

export const getWETH = (chainId: ChainId = NETWORK): Token => {
	return getToken(WETH, chainId);
};

export const getWBTC = (chainId: ChainId = NETWORK): Token => {
	return getToken(WBTC, chainId);
};
