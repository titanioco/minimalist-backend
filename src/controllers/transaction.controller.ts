import { Request, Response } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { utils } from 'ethers';
import { TransactionStatus } from '../utils/types/types';
import HttpStatus from '../utils/types/httpStatus';
import { UserEntity } from '../utils/entities/user.entity';
import { TransactionEntity } from '../utils/entities/transaction.entity';
import { RefTransactionEntity } from '../utils/entities/refTransaction.entity';

const { isAddress, getAddress } = utils;

export const transactionController = (redisClient: RedisClientType, dataSource: DataSource) => ({
  getTransactions: async (req: Request, res: Response) => {
    try {
      const { address: userAddress } = req.params;
      const page = Number(req.query.page) || 0;
      const size = Number(req.query.size) || 10;

      if (!userAddress || !isAddress(userAddress)) {
        return res.status(HttpStatus.BadRequest).json({ message: "Invalid parameters" });
      }

      const cacheKey = `transactions:${userAddress}:${page}:${size}`;
      const cachedTransactions = await redisClient.get(cacheKey);
      if (cachedTransactions) {
        return res.json(JSON.parse(cachedTransactions));
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const user = await userRepository.findOne({ where: { address: getAddress(userAddress) } });
      
      if (!user) {
        return res.json({ data: [], total: 0 });
      }

      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const [transactions, total] = await transactionRepository.findAndCount({
        where: { user: { address: user.address }, status: TransactionStatus.SUCCESS },
        order: { created_at: 'DESC' },
        take: size,
        skip: page * size
      });

      const result = {
        data: transactions,
        total: total
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 300 }); // Cache for 5 minutes
      res.json(result);
    } catch (error) {
      console.error('Error in getTransactions:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getRefTransactions: async (req: Request, res: Response) => {
    try {
      const { address: userAddress } = req.params;
      
      if (!userAddress || !isAddress(userAddress)) {
        return res.status(HttpStatus.BadRequest).json({ message: "Invalid parameters" });
      }

      const cacheKey = `ref-transactions:${userAddress}`;
      const cachedRefTransactions = await redisClient.get(cacheKey);
      if (cachedRefTransactions) {
        return res.json({ data: JSON.parse(cachedRefTransactions) });
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const user = await userRepository.findOne({ where: { address: getAddress(userAddress) } });
      
      if (!user) {
        return res.json({ data: [] });
      }

      const refTransactionRepository = dataSource.getRepository(RefTransactionEntity);
      const refTransactions = await refTransactionRepository.find({
        where: { to: { address: user.address } },
        relations: ['from', 'to'],
        order: { created_at: 'DESC' }
      });

      const result = refTransactions.map(rt => ({
        ...rt,
        from_address: rt.from.address,
        to_address: rt.to.address
      }));

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 300 }); // Cache for 5 minutes
      res.json({ data: result });
    } catch (error) {
      console.error('Error in getRefTransactions:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getTransaction: async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      
      if (!hash) {
        return res.status(HttpStatus.BadRequest).json({ message: "Invalid parameters" });
      }

      const cacheKey = `transaction:${hash}`;
      const cachedTransaction = await redisClient.get(cacheKey);
      if (cachedTransaction) {
        return res.json({ data: JSON.parse(cachedTransaction) });
      }

      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const transaction = await transactionRepository.findOne({ where: { hash } });

      if (!transaction) {
        return res.status(HttpStatus.NotFound).json({ message: "Transaction not found" });
      }

      await redisClient.set(cacheKey, JSON.stringify(transaction), { EX: 3600 }); // Cache for 1 hour
      res.json({ data: transaction });
    } catch (error) {
      console.error('Error in getTransaction:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  // You can add more methods here as needed

});

export default transactionController;