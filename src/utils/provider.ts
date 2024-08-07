import * as ethersV5 from 'ethers-v5';
import { JsonRpcProvider, Wallet } from "ethers";
import { ChainId } from "./types/types";
import { NETWORK, PRIVATE_KEY } from ".";

export const RPC_URLS: { [chainId in ChainId]: string } = {
    137: "https://polygon-rpc.com",
    4002: "https://fantom-testnet.public.blastapi.io",
};

export const NODE_URLS: { [chainId in ChainId]: string } = {
    137: "https://flashy-fittest-paper.matic.quiknode.pro/b8e5ccf9b2e24cce4e2ca749629b2078d62fdbbe",
    4002: "https://fantom-testnet.public.blastapi.io",
};

export const provider = new JsonRpcProvider(NODE_URLS[NETWORK as ChainId]);

export const executor = new Wallet(
    PRIVATE_KEY,
    new JsonRpcProvider(NODE_URLS[NETWORK as ChainId])
);

export const APP_FEE_RECEIVER = "0x546Ae6F4530300c0A74BCa377727C04a51e8c989";