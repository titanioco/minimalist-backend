import { providers, Wallet } from 'ethers';
import { ChainId } from "./types/types";
import { NETWORK, PRIVATE_KEY } from ".";
import { RPC_URL } from './enviroments';
import { SimulationProvider, vPolygon } from './simulationProvider.ts';

export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const TENDERLY_FORK_RPC_URL = process.env.TENDERLY_FORK_RPC_URL || vPolygon.rpcUrls.default.http[0];

export const RPC_URLS: { [chainId in ChainId]: string } = {
    137: RPC_URL,
    // Add other chain IDs as needed
};

export const NODE_URLS: { [chainId in ChainId]: string } = {
    137: RPC_URL,
    // Add other chain IDs as needed
};

// Use SimulationProvider for development, regular JsonRpcProvider for production
export const provider = IS_DEVELOPMENT
    ? new SimulationProvider(TENDERLY_FORK_RPC_URL)
    : new providers.JsonRpcProvider(NODE_URLS[NETWORK as ChainId]);

// Set up the SimulationProvider if in development mode
if (IS_DEVELOPMENT && provider instanceof SimulationProvider) {
    provider.setBypassPermissions(true);
    console.log('Simulation mode: Permission checks bypassed for development');
}

// Create executor wallet
export const executor = new Wallet(PRIVATE_KEY, provider);

export const APP_FEE_RECEIVER = "0xAA40Ff4866F915D9777238b7a8422A8673CDC0B5";

// Helper function to get the appropriate provider based on the environment
export function getProvider(chainId: ChainId): providers.Provider {
    if (IS_DEVELOPMENT) {
        const simProvider = new SimulationProvider(TENDERLY_FORK_RPC_URL);
        simProvider.setBypassPermissions(true);
        return simProvider;
    } else {
        return new providers.JsonRpcProvider(NODE_URLS[chainId]);
    }
}

// Helper function to get a wallet connected to the appropriate provider
export function getWallet(privateKey: string, chainId: ChainId): Wallet {
    return new Wallet(privateKey, getProvider(chainId));
}