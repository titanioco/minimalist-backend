import { Request, Response } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { getPool } from '../database';
import { isAddress, getAddress } from 'ethers';
import { TransactionStatus } from '../utils/types/types';
import HttpStatus from '../utils/types/httpStatus';

export const transactionController = (redisClient: RedisClientType) => ({
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

      const pool = getPool();
      const userResult = await pool.query('SELECT id FROM users WHERE address = $1', [getAddress(userAddress)]);
      
      if (userResult.rows.length === 0) {
        return res.json({ data: [], total: 0 });
      }

      const userId = userResult.rows[0].id;
      
      const [transactionsResult, totalResult] = await Promise.all([
        pool.query(
          'SELECT * FROM transactions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
          [userId, 'success' as TransactionStatus, size, page * size]
        ),
        pool.query(
          'SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND status = $2',
          [userId, 'success' as TransactionStatus]
        )
      ]);

      const result = {
        data: transactionsResult.rows,
        total: parseInt(totalResult.rows[0].count)
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

      const pool = getPool();
      const userResult = await pool.query('SELECT id FROM users WHERE address = $1', [getAddress(userAddress)]);
      
      if (userResult.rows.length === 0) {
        return res.json({ data: [] });
      }

      const userId = userResult.rows[0].id;

      const refTransactionsResult = await pool.query(
        `SELECT rt.*, u_from.address as from_address, u_to.address as to_address 
         FROM ref_transactions rt
         JOIN users u_from ON rt.from_id = u_from.id
         JOIN users u_to ON rt.to_id = u_to.id
         WHERE rt.to_id = $1
         ORDER BY rt.created_at DESC`,
        [userId]
      );

      await redisClient.set(cacheKey, JSON.stringify(refTransactionsResult.rows), { EX: 300 }); // Cache for 5 minutes
      res.json({ data: refTransactionsResult.rows });
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

      const pool = getPool();
      const transactionResult = await pool.query('SELECT * FROM transactions WHERE hash = $1', [hash]);

      if (transactionResult.rows.length === 0) {
        return res.status(HttpStatus.NotFound).json({ message: "Transaction not found" });
      }

      await redisClient.set(cacheKey, JSON.stringify(transactionResult.rows[0]), { EX: 3600 }); // Cache for 1 hour
      res.json({ data: transactionResult.rows[0] });
    } catch (error) {
      console.error('Error in getTransaction:', error);
      res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
    }
  },

  // You can add more methods here as needed

});

export default transactionController;