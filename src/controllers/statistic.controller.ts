import { Request, Response } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { DataSource, Like } from 'typeorm';
import HttpStatus from '../utils/types/httpStatus';
import { calculateETHAndBTCSwapped } from '../utils/statistic';
import { USDC, WBTC, WETH } from '../constants/tokens';
import _ from 'lodash';
import { UserEntity } from '../utils/entities/user.entity';
import { ValueRecordEntity } from '../utils/entities/valueRecord.entity';
import { TransactionEntity } from '../utils/entities/transaction.entity';
import { TokenRecordEntity } from '../utils/entities/tokenRecord.entity';

export const statisticController = (redisClient: RedisClientType, dataSource: DataSource) => ({
  getWalletsLinked: async (req: Request, res: Response) => {
    try {
      const query = req.query || {};
      const page = Number(query.page) || 1;
      const take = Number(query.take) || 10;
      const skip = (page - 1) * take;

      const cacheKey = `wallets_linked:${page}:${take}`;
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);

      const [users, total] = await userRepository.findAndCount({
        order: { created_at: 'DESC' },
        take,
        skip
      });

      const userWithValueRecordPromise = users.map(async (user) => {
        const valueRecord = await valueRecordRepository.findOne({
          where: { user: { address: user.address } },
          order: { created_at: 'DESC' }
        });
        return {
          ...user,
          valueRecord: valueRecord || null,
        };
      });

      const userWithValueRecord = await Promise.all(userWithValueRecordPromise);

      const result = {
        body: userWithValueRecord,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 300 }); // Cache for 5 minutes
      res.json(result);
    } catch (error) {
      console.error('Error in getWalletsLinked:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getWalletsDepositedMorethan4Times: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'wallets_deposited_more_than_4_times';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);

      const depositedUsers = await userRepository.createQueryBuilder('user')
        .leftJoinAndSelect('user.transactions', 'transaction')
        .where('transaction.chain_id = :chainId', { chainId: 137 })
        .andWhere('transaction.status = :status', { status: 'success' })
        .andWhere('transaction.descriptions ILIKE :description', { description: '%Deposited %' })
        .groupBy('user.address')
        .having('COUNT(transaction.id) >= 4')
        .getMany();

      const userWithValueRecordPromise = depositedUsers.map(async (user) => {
        const valueRecord = await valueRecordRepository.findOne({
          where: { user: { address: user.address } },
          order: { created_at: 'DESC' }
        });
        return {
          ...user,
          valueRecord: valueRecord || null,
        };
      });

      const userWithValueRecord = await Promise.all(userWithValueRecordPromise);

      const result = {
        body: userWithValueRecord,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getWalletsDepositedMorethan4Times:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getTotalBTCAndETHSwapped: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'total_btc_eth_swapped';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const transactionRepository = dataSource.getRepository(TransactionEntity);
      const swappedTransactions = await transactionRepository.find({
        where: {
          chain_id: 137,
          status: 'success',
          descriptions: Like('%Swapped %')
        }
      });

      const result = {
        body: calculateETHAndBTCSwapped(swappedTransactions),
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getTotalBTCAndETHSwapped:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  walletsOpenedStatistic: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'wallets_opened_statistic';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const groupedUsers = await userRepository.createQueryBuilder('user')
        .select("DATE(user.created_at)", "date")
        .addSelect("COUNT(user.address)", "count")
        .where("user.created_at >= :date", { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
        .groupBy("DATE(user.created_at)")
        .orderBy("date", "ASC")
        .getRawMany();

      const result = {
        body: groupedUsers,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in walletsOpenedStatistic:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getTotalDepositFromStackInception: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'total_deposit_from_stack_inception';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const tokenRecordRepository = dataSource.getRepository(TokenRecordEntity);
      const totalDeposit = await tokenRecordRepository.createQueryBuilder('token_record')
        .select('SUM(token_record.value)', 'total')
        .where('token_record.type = :type', { type: 'deposit' })
        .andWhere('token_record.token = :token', { token: USDC[137]?.address })
        .getRawOne();

      const result = {
        body: parseFloat(totalDeposit.total) || 0,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getTotalDepositFromStackInception:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getTotalWithdraw: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'total_withdraw';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const tokenRecordRepository = dataSource.getRepository(TokenRecordEntity);
      const totalWithdraw = await tokenRecordRepository.createQueryBuilder('token_record')
        .select('SUM(token_record.value)', 'total')
        .where('token_record.type = :type', { type: 'withdraw' })
        .andWhere('token_record.token = :token', { token: USDC[137]?.address })
        .getRawOne();

      const result = {
        body: parseFloat(totalWithdraw.total) || 0,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getTotalWithdraw:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getTotalBTCAndETHDepositFromStackInception: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'total_btc_eth_deposit_from_stack_inception';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const tokenRecordRepository = dataSource.getRepository(TokenRecordEntity);
      const totalDeposit = await tokenRecordRepository.createQueryBuilder('token_record')
        .select('SUM(token_record.value * token_record.token_price)', 'total')
        .where('token_record.type = :type', { type: 'deposit' })
        .andWhere('token_record.token IN (:...tokens)', { tokens: [WBTC[137]?.address, WETH[137]?.address] })
        .getRawOne();

      const result = {
        body: parseFloat(totalDeposit.total) || 0,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getTotalBTCAndETHDepositFromStackInception:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getCurrentStackValue: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'current_stack_value';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);
      const totalStack = await valueRecordRepository.createQueryBuilder('value_record')
        .select('value_record.chain_id', 'chain_id')
        .addSelect('SUM(value_record.value)', 'total')
        .where(qb => {
          const subQuery = qb.subQuery()
            .select('MAX(created_at)')
            .from(ValueRecordEntity, 'vr')
            .getQuery();
          return 'value_record.created_at = ' + subQuery;
        })
        .groupBy('value_record.chain_id')
        .getRawMany();

      const result = {
        body: totalStack.find(row => row.chain_id === 137)?.total || 0,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 300 }); // Cache for 5 minutes
      res.json(result);
    } catch (error) {
      console.error('Error in getCurrentStackValue:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getNumberWalletsOutApp: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'number_wallets_out_app';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);
      const walletsOutApp = await valueRecordRepository
        .createQueryBuilder('value_record')
        .select('COUNT(DISTINCT value_record.user)', 'count')
        .where('value_record.chain_id = :chainId', { chainId: 137 })
        .groupBy('value_record.user')
        .having('SUM(value_record.value) < 1')
        .getRawOne();

      const result = {
        body: parseInt(walletsOutApp.count),
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getNumberWalletsOutApp:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  getNumberWalletsCreatedByAffiliate: async (_: Request, res: Response) => {
    try {
      const cacheKey = 'number_wallets_created_by_affiliate';
      const cachedResult = await redisClient.get(cacheKey);
      if (cachedResult) {
        return res.json(JSON.parse(cachedResult));
      }

      const userRepository = dataSource.getRepository(UserEntity);
      const groupedUsers = await userRepository
        .createQueryBuilder('user')
        .select("EXTRACT(YEAR FROM user.created_at)", "year")
        .addSelect("EXTRACT(MONTH FROM user.created_at)", "month")
        .addSelect("COUNT(user.address)", "count")
        .where("user.referrer IS NOT NULL")
        .groupBy("year, month")
        .orderBy("year, month")
        .getRawMany();

      const result = {
        body: groupedUsers,
        statusCode: HttpStatus.OK,
      };

      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 }); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      console.error('Error in getNumberWalletsCreatedByAffiliate:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  // You can add more methods here as needed
});

export default statisticController;