import cron from 'node-cron';
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { main as handleDeposits } from './handleDeposits';
import { main as handleRefTransactions } from './handleRefTransactions';
import { main as handleTransactions } from './handleTransactions';
import { main as handleSwap } from './handleSwap';
import { main as handleHF } from './handleHF';
import { main as handleValueRecords } from './handleValueRecords';
import { main as handleTokenRecords } from './handleTokenRecords';
import { main as handleUSDCRecords } from './handleUSDCRecords';
import { main as handleSwapAmount } from './handleSwapAmount';

export function setupCronJobs(redisClient: RedisClientType, dataSource: DataSource) {
  // Every 1 minute
  cron.schedule('* * * * *', () => handleTransactions(redisClient, dataSource));
  cron.schedule('* * * * *', () => handleRefTransactions(redisClient, dataSource));
  cron.schedule('* * * * *', () => handleHF(redisClient, dataSource));
  cron.schedule('* * * * *', () => handleTokenRecords(redisClient, dataSource));
  cron.schedule('* * * * *', () => handleUSDCRecords(redisClient, dataSource));
  cron.schedule('* * * * *', () => handleSwapAmount(redisClient, dataSource));

  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => handleDeposits(redisClient, dataSource));
  cron.schedule('*/15 * * * *', () => handleSwap(redisClient, dataSource));
  cron.schedule('*/15 * * * *', () => handleValueRecords(redisClient, dataSource));
}