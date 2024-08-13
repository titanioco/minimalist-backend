import { providers, Wallet } from 'ethers';
import { ChainId } from "./types/types";
import { NETWORK, PRIVATE_KEY } from ".";

export const RPC_URLS: { [chainId in ChainId]: string } = {
    137: "https://virtual.polygon.rpc.tenderly.co/fda8a3fc-3a78-4c5b-a242-e930b1e62105",
    4002: "https://fantom-testnet.public.blastapi.io",
};

export const NODE_URLS: { [chainId in ChainId]: string } = {
    137: "https://virtual.polygon.rpc.tenderly.co/fda8a3fc-3a78-4c5b-a242-e930b1e62105",
    4002: "https://fantom-testnet.public.blastapi.io",
};

export const provider = new providers.JsonRpcProvider(NODE_URLS[NETWORK as ChainId]);

export const executor = new Wallet(
    PRIVATE_KEY,
    new providers.JsonRpcProvider(NODE_URLS[NETWORK as ChainId])
);

export const APP_FEE_RECEIVER = "0x546Ae6F4530300c0A74BCa377727C04a51e8c989";