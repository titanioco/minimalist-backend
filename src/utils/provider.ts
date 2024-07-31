import { providers, Wallet } from "ethers";
import { ChainId } from "./types";
import { NETWORK, PRIVATE_KEY } from ".";

export const RPC_URLS: { [chainId in ChainId]: string } = {
	137: "https://polygon-rpc.com",
	4002: "https://fantom-testnet.public.blastapi.io",
};

export const NODE_URLS: { [chainId in ChainId]: string } = {
	// 137: "https://nd-615-365-374.p2pify.com/19ce042dca369d39f59c588558c02f4d",
	137: "https://flashy-fittest-paper.matic.quiknode.pro/b8e5ccf9b2e24cce4e2ca749629b2078d62fdbbe",
	4002: "https://fantom-testnet.public.blastapi.io",
};

export const provider = new providers.JsonRpcProvider(NODE_URLS[NETWORK as ChainId]);

export const executor = new Wallet(
	PRIVATE_KEY,
	new providers.JsonRpcProvider(NODE_URLS[NETWORK as ChainId]),
);

export const APP_FEE_RECEIVER = "0x546Ae6F4530300c0A74BCa377727C04a51e8c989";
