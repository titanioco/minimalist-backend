// src/utils/environment.ts

import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'development';

export const isDevelopment = env === 'development';
export const isProduction = env === 'production';

export const NETWORK: number = parseInt(process.env.NETWORK ?? '4002');
export const CHAIN_ID: number = isDevelopment ? 137 : NETWORK;

export const PRIVATE_KEY: string = process.env.PRIVATE_KEY!;
export const LEDGER_ADDRESS: string = process.env.LEDGER_ADDRESS!;

export const RPC_URL: string = isDevelopment 
  ? process.env.TENDERLY_RPC_URL! 
  : process.env.RPC_URL!;

export const EXPLORER_BASE_URL: string = isDevelopment
  ? process.env.TENDERLY_EXPLORER_URL!
  : process.env.EXPLORER_BASE_URL!;

export const TENDERLY_USER = process.env.TENDERLY_USER!;
export const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT!;
export const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY!;
export const TENDERLY_FORK_ID = process.env.TENDERLY_FORK_ID!;

export const APP_FEE_RECEIVER = process.env.APP_FEE_RECEIVER!;

export const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

export const REDIS_URL = process.env.REDIS_URL;

export const JWT_SECRET = process.env.JWT_SECRET;

export const PORT = process.env.PORT || 3000;