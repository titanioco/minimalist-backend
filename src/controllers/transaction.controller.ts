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

export const transactionController = (dataSource: DataSource) => ({
  getTransactions: async (req: Request, res: Response) => {
    try {
      const { address: userAddress } = req.params;
      const page = Number(req.query.page) || 0;
      const size = Number(req.query.size) || 10;

      if (!userAddress || !isAddress(userAddress)) {
        return res.status(HttpStatus.BadRequest).send({ message: "Invalid parameters" });
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const user = await userRepository.findOne({ where: { address: getAddress(userAddress) } });
      
      if (!user) {
        return res.send({ data: [], total: 0 });
      }

      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const [transactions, total] = await transactionRepository.findAndCount({
        where: { user: { address: user.address }, status: TransactionStatus.SUCCESS },
        order: { created_at: 'DESC' },
        take: size,
        skip: page * size
      });

      return res.send({ data: transactions, total });
    } catch (error) {
      console.error('Error in getTransactions:', error);
      return res.status(HttpStatus.BadRequest).send({ message: (error as Error).message });
    }
  },

  getRefTransactions: async (req: Request, res: Response) => {
    try {
      const { address: userAddress } = req.params;
      
      if (!userAddress || !isAddress(userAddress)) {
        return res.status(HttpStatus.BadRequest).send({ message: "Invalid parameters" });
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const user = await userRepository.findOne({ where: { address: getAddress(userAddress) } });
      
      if (!user) {
        return res.send({ data: [] });
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

      return res.send({ data: result });
    } catch (error) {
      console.error('Error in getRefTransactions:', error);
      return res.status(HttpStatus.BadRequest).send({ message: (error as Error).message });
    }
  },

  getTransaction: async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      
      if (!hash) {
        return res.status(HttpStatus.BadRequest).send({ message: "Invalid parameters" });
      }

      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const transaction = await transactionRepository.findOne({ where: { hash } });

      if (!transaction) {
        return res.status(HttpStatus.NotFound).send({ message: "Transaction not found" });
      }

      return res.send({ data: transaction });
    } catch (error) {
      console.error('Error in getTransaction:', error);
      return res.status(HttpStatus.BadRequest).send({ message: (error as Error).message });
    }
  },

  // You can add more methods here as needed

});

export default transactionController;