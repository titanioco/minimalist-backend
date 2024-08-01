import { Request, Response } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { getPool } from '../database';
import HttpStatus from '../utils/types/httpStatus';
import { calculateETHAndBTCSwapped } from '../utils/statistic';
import { USDC, WBTC, WETH } from '../constants/tokens';
import _ from 'lodash';

export const statisticController = (redisClient: RedisClientType) => ({
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

      const pool = getPool();
      const usersResult = await pool.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [take, skip]
      );

      const userWithValueRecordPromise = usersResult.rows.map(async (user) => {
        const valueRecordResult = await pool.query(
          'SELECT * FROM value_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        return {
          ...user,
          valueRecord: valueRecordResult.rows[0] || null,
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

      const pool = getPool();
      const depositedTransactions = await pool.query(
        `SELECT u.*, COUNT(t.id) as deposit_count
         FROM users u
         JOIN transactions t ON u.id = t.user_id
         WHERE t.chain_id = $1 AND t.status = $2 AND t.descriptions ILIKE $3
         GROUP BY u.id
         HAVING COUNT(t.id) >= 4`,
        [137, 'success', '%Deposited %']
      );

      const valueRecordPromise = depositedTransactions.rows.map(async (user) => {
        const valueRecordResult = await pool.query(
          'SELECT * FROM value_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        return {
          ...user,
          valueRecord: valueRecordResult.rows[0] || null,
        };
      });

      const userWithValueRecord = await Promise.all(valueRecordPromise);

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

      const pool = getPool();
      const swappedTransactions = await pool.query(
        `SELECT * FROM transactions 
         WHERE chain_id = $1 AND status = $2 AND descriptions ILIKE $3`,
        [137, 'success', '%Swapped %']
      );

      const result = {
        body: calculateETHAndBTCSwapped(swappedTransactions.rows),
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

      const pool = getPool();
      const groupedUsers = await pool.query(
        `SELECT DATE(created_at) as date, COUNT(address) as count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`
      );

      const result = {
        body: groupedUsers.rows,
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

      const pool = getPool();
      const totalDeposit = await pool.query(
        `SELECT SUM(value::numeric) as total
         FROM token_records
         WHERE type = $1 AND token = $2`,
        ['deposit', USDC[137]?.address]
      );

      const result = {
        body: parseFloat(totalDeposit.rows[0].total) || 0,
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

      const pool = getPool();
      const totalWithdraw = await pool.query(
        `SELECT SUM(value::numeric) as total
         FROM token_records
         WHERE type = $1 AND token = $2`,
        ['withdraw', USDC[137]?.address]
      );

      const result = {
        body: parseFloat(totalWithdraw.rows[0].total) || 0,
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

      const pool = getPool();
      const totalDeposit = await pool.query(
        `SELECT SUM(value::numeric * token_price::numeric) as total
         FROM token_records
         WHERE type = $1 AND token IN ($2, $3)`,
        ['deposit', WBTC[137]?.address, WETH[137]?.address]
      );

      const result = {
        body: parseFloat(totalDeposit.rows[0].total) || 0,
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

      const pool = getPool();
      const totalStack = await pool.query(
        `SELECT chain_id, SUM(value::numeric) as total
         FROM value_records
         WHERE created_at = (SELECT MAX(created_at) FROM value_records)
         GROUP BY chain_id`
      );

      const result = {
        body: totalStack.rows.find(row => row.chain_id === 137)?.total || 0,
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

      const pool = getPool();
      const walletsOutApp = await pool.query(
        `SELECT COUNT(*) as count
         FROM (
           SELECT user_id, SUM(value::numeric) as total_value
           FROM value_records
           WHERE chain_id = $1
           GROUP BY user_id
           HAVING SUM(value::numeric) < 1
         ) as subquery`,
        [137]
      );

      const result = {
        body: parseInt(walletsOutApp.rows[0].count),
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

      const pool = getPool();
      const groupedUsers = await pool.query(
        `SELECT 
           EXTRACT(YEAR FROM created_at) as year, 
           EXTRACT(MONTH FROM created_at) as month,
           COUNT(address) as count
         FROM users
         WHERE referrer_address IS NOT NULL
         GROUP BY year, month
         ORDER BY year, month`
      );

      const result = {
        body: groupedUsers.rows,
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