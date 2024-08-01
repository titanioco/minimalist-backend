import cron from 'node-cron';
import { RedisClientType } from 'redis';
import { getPool } from '../database';  // Import the getPool function
import { main as handleDeposits } from './handleDeposits';
import { main as handleRefTransactions } from './cronjobs/handleRefTransactions';
import { main as handleTransactions } from './cronjobs/handleTransactions';
import { main as handleSwap } from './cronjobs/handleSwap';
import { main as handleHF } from './cronjobs/handleHF';
import { main as handleValueRecords } from './cronjobs/handleValueRecords';
import { main as handleTokenRecords } from './cronjobs/handleTokenRecords';
import { main as handleUSDCRecords } from './cronjobs/handleUSDCRecords';
import { main as handleSwapAmount } from './cronjobs/handleSwapAmount';

export function setupCronJobs(redisClient: RedisClientType) {
  const pool = getPool();  // Get the pool instance

  // Every 1 minute
  cron.schedule('* * * * *', () => handleTransactions(redisClient, pool));
  cron.schedule('* * * * *', () => handleRefTransactions(redisClient, pool));
  cron.schedule('* * * * *', () => handleHF(redisClient, pool));
  cron.schedule('* * * * *', () => handleTokenRecords(redisClient, pool));
  cron.schedule('* * * * *', () => handleUSDCRecords(redisClient, pool));
  cron.schedule('* * * * *', () => handleSwapAmount(redisClient, pool));

  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => handleDeposits(redisClient, pool));
  cron.schedule('*/15 * * * *', () => handleSwap(redisClient, pool));
  cron.schedule('*/15 * * * *', () => handleValueRecords(redisClient, pool));
}