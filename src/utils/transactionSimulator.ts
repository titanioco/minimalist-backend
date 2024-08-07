// src/utils/transactionSimulator.ts

import { ethers } from 'ethers';
import axios from 'axios';
import {
   isDevelopment,
   TENDERLY_USER,
   TENDERLY_PROJECT,
   TENDERLY_ACCESS_KEY,
   TENDERLY_FORK_ID
} from './enviroments';
import { provider } from './provider';

export async function simulateTransaction(tx: ethers.TransactionRequest): Promise<any> {
  if (isDevelopment) {
    return simulateWithTenderly(tx);
  } else {
    return simulateWithProvider(tx);
  }
}

async function simulateWithTenderly(tx: ethers.TransactionRequest): Promise<any> {
  const response = await axios.post(
    `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork/${TENDERLY_FORK_ID}/simulate`,
    {
      from: tx.from,
      to: tx.to,
      input: tx.data,
      gas: tx.gasLimit?.toString(),
      gas_price: tx.gasPrice?.toString(),
      value: tx.value?.toString() || '0',
    },
    {
      headers: {
        'X-Access-Key': TENDERLY_ACCESS_KEY,
      },
    }
  );

  return response.data;
}

async function simulateWithProvider(tx: ethers.TransactionRequest): Promise<any> {
  try {
    const gasEstimate = await provider.estimateGas(tx);
    const feeData = await provider.getFeeData();
    
    return {
      gasUsed: gasEstimate.toString(),
      success: true,
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    };
  } catch (error) {
    console.error('Transaction simulation failed:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function setBalance(address: string, balance: string): Promise<void> {
  if (isDevelopment) {
    await axios.post(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork/${TENDERLY_FORK_ID}/balance`,
      { address, balance },
      { headers: { 'X-Access-Key': TENDERLY_ACCESS_KEY } }
    );
  } else {
    console.warn('setBalance is only available in development environment');
  }
}

export async function impersonateAccount(address: string): Promise<void> {
  if (isDevelopment) {
    await axios.post(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork/${TENDERLY_FORK_ID}/accounts/${address}/impersonate`,
      {},
      { headers: { 'X-Access-Key': TENDERLY_ACCESS_KEY } }
    );
  } else {
    console.warn('impersonateAccount is only available in development environment');
  }
}