import { Request, Response } from 'express';
import { RedisClientType } from 'redis';
import { getPool } from '../database';
import { isAddress, getAddress } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import _ from 'lodash';
import moment from 'moment';
import { getLedger } from '../utils/abis';
import { getLedgerAddress } from '../constants/contracts';
import { provider } from '../utils/provider';
import { TokenRecordType, TransactionStatus } from '../utils/types/types';
import { getTokenPricing } from '../utils/aave';
import { getWBTC, getWETH } from '../constants/tokens';

export const userController = (redisClient: RedisClientType) => ({
    getNonce: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const pool = getPool();
            const result = await pool.query('SELECT nonce FROM users WHERE address = $1', [getAddress(address)]);

            if (result.rows.length === 0) {
                return res.json({ data: '0' });
            }

            const newNonce = result.rows[0].nonce + 1;
            await pool.query('UPDATE users SET nonce = $1 WHERE address = $2', [newNonce, getAddress(address)]);

            res.json({ data: newNonce.toString() });
        } catch (error) {
            console.error('Error in getNonce:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getUser: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const cacheKey = `user:${address}`;
            const cachedUser = await redisClient.get(cacheKey);
            if (cachedUser) {
                return res.json({ data: JSON.parse(cachedUser) });
            }

            const pool = getPool();
            const result = await pool.query(
                'SELECT u.*, r.address AS referrer_address FROM users u LEFT JOIN users r ON u.referrer_id = r.id WHERE u.address = $1',
                [getAddress(address)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const user = result.rows[0];
            await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 });
            res.json({ data: user });
        } catch (error) {
            console.error('Error in getUser:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getUserByCode: async (req: Request, res: Response) => {
        try {
            const { code } = req.params;
            if (!code) {
                return res.status(400).json({ message: 'Invalid code' });
            }

            const cacheKey = `user:code:${code}`;
            const cachedUser = await redisClient.get(cacheKey);
            if (cachedUser) {
                return res.json({ data: JSON.parse(cachedUser) });
            }

            const pool = getPool();
            const result = await pool.query(
                'SELECT u.*, r.address AS referrer_address FROM users u LEFT JOIN users r ON u.referrer_id = r.id WHERE u.code = $1',
                [code]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const user = result.rows[0];
            await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 });
            res.json({ data: user });
        } catch (error) {
            console.error('Error in getUserByCode:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getUsers: async (_: Request, res: Response) => {
        try {
            const cacheKey = 'all:users';
            const cachedUsers = await redisClient.get(cacheKey);
            if (cachedUsers) {
                return res.json({ data: JSON.parse(cachedUsers) });
            }

            const pool = getPool();
            const result = await pool.query('SELECT * FROM users');

            await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 300 }); // Cache for 5 minutes
            res.json({ data: result.rows });
        } catch (error) {
            console.error('Error in getUsers:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getChildren: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const cacheKey = `children:${address}`;
            const cachedChildren = await redisClient.get(cacheKey);
            if (cachedChildren) {
                return res.json({ data: JSON.parse(cachedChildren) });
            }

            const pool = getPool();
            const result = await pool.query(
                'SELECT u.* FROM users u INNER JOIN users r ON u.referrer_id = r.id WHERE r.address = $1',
                [getAddress(address)]
            );

            await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 300 }); // Cache for 5 minutes
            res.json({ data: result.rows });
        } catch (error) {
            console.error('Error in getChildren:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    register: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            const { code } = req.body;

            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const pool = getPool();
            const existingUser = await pool.query('SELECT * FROM users WHERE address = $1', [getAddress(address)]);
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const ledgerContract = getLedger(getLedgerAddress(), provider);
            const walletAddress = await ledgerContract.getWallet(getAddress(address));
            if (walletAddress === ethers.constants.AddressZero) {
                return res.status(400).json({ message: 'Something went wrong' });
            }

            const userAddress = getAddress(address);
            const userCode = userAddress.slice(2, 6) + userAddress.slice(userAddress.length - 4);

            let referrerId = null;
            if (code) {
                const referrer = await pool.query('SELECT id FROM users WHERE code = $1', [code]);
                if (referrer.rows.length > 0) {
                    referrerId = referrer.rows[0].id;
                }
            }

            const newUser = await pool.query(
                'INSERT INTO users (address, code, wallet_address, recipient, referrer_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [userAddress, userCode, walletAddress, userAddress, referrerId]
            );

            // Invalidate relevant caches
            await redisClient.del(`user:${userAddress}`);
            await redisClient.del('all:users');

            res.status(201).json({ data: newUser.rows[0] });
        } catch (error) {
            console.error('Error in register:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    updateUser: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            const data = req.body;

            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const pool = getPool();
            const existingUser = await pool.query('SELECT * FROM users WHERE address = $1', [getAddress(address)]);
            if (existingUser.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updateFields = [
                'safe_hf', 'risk_hf', 'cron_time', 'recipient', 'deposit_enabled',
                'protection_enabled', 'deposit_amount', 'deposit_buffer',
                'last_deposited_at', 'last_swapped_at'
            ];

            const updates = [];
            const values = [];
            let paramCounter = 1;

            for (const field of updateFields) {
                if (data[field] !== undefined) {
                    updates.push(`${field} = $${paramCounter}`);
                    values.push(data[field]);
                    paramCounter++;
                }
            }

            if (updates.length > 0) {
                values.push(getAddress(address));
                await pool.query(
                    `UPDATE users SET ${updates.join(', ')} WHERE address = $${paramCounter}`,
                    values
                );
            }

            if (data.transactions) {
                const transactionValues = data.transactions.map((transaction: any) => [
                    existingUser.rows[0].id,
                    transaction.hash,
                    JSON.stringify(transaction.descriptions),
                    TransactionStatus.SUCCESS
                ]);

                await pool.query(
                    'INSERT INTO transactions (user_id, hash, descriptions, status) VALUES ' +
                    transactionValues.map((_: any, index: number) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`).join(', '),
                    transactionValues.flat()
                );
            }

            if (data.refTransactions && existingUser.rows[0].referrer_id) {
                const refTransactionValues = data.refTransactions.map((transaction: any) => [
                    existingUser.rows[0].id,
                    existingUser.rows[0].referrer_id,
                    transaction.hash,
                    transaction.description,
                    TransactionStatus.SUCCESS
                ]);

                await pool.query(
                    'INSERT INTO ref_transactions (from_id, to_id, hash, description, status) VALUES ' +
                    refTransactionValues.map((_: any, index: number) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`).join(', '),
                    refTransactionValues.flat()
                );
            }

            // Invalidate relevant caches
            await redisClient.del(`user:${address}`);
            await redisClient.del('all:users');

            const updatedUser = await pool.query(
                'SELECT u.*, r.address AS referrer_address FROM users u LEFT JOIN users r ON u.referrer_id = r.id WHERE u.address = $1',
                [getAddress(address)]
            );

            res.json({ data: updatedUser.rows[0] });
        } catch (error) {
            console.error('Error in updateUser:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    setUserNeedUpdate: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const pool = getPool();
            const result = await pool.query(
                'UPDATE users SET need_update = true, updated_deposit_amount = NULL WHERE address = $1 RETURNING *',
                [getAddress(address)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Invalidate relevant caches
            await redisClient.del(`user:${address}`);

            res.json({ data: result.rows[0] });
        } catch (error) {
            console.error('Error in setUserNeedUpdate:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getSnapshot: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const cacheKey = `snapshot:${address}`;
            const cachedSnapshot = await redisClient.get(cacheKey);
            if (cachedSnapshot) {
                return res.json({ data: parseFloat(cachedSnapshot) });
            }

            const pool = getPool();
            const user = await pool.query('SELECT id FROM users WHERE address = $1', [getAddress(address)]);
            if (user.rows.length === 0) {
                return res.json({ data: 0 });
            }

            const timestamp = moment().subtract(1, 'years').toDate();
            const record = await pool.query(
                'SELECT value FROM value_records WHERE user_id = $1 AND created_at >= $2 ORDER BY created_at ASC LIMIT 1',
                [user.rows[0].id, timestamp]
            );

            const snapshotValue = record.rows.length > 0 ? parseFloat(record.rows[0].value) : 0;
            await redisClient.set(cacheKey, snapshotValue.toString(), { EX: 3600 }); // Cache for 1 hour
            res.json({ data: snapshotValue });
        } catch (error) {
            console.error('Error in getSnapshot:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    getYTD: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const cacheKey = `ytd:${address}`;
            const cachedYTD = await redisClient.get(cacheKey);
            if (cachedYTD) {
                return res.json({ data: parseFloat(cachedYTD) });
            }

            const pool = getPool();
            const user = await pool.query('SELECT id FROM users WHERE address = $1', [getAddress(address)]);
            if (user.rows.length === 0) {
                return res.json({ data: 0 });
            }

            const WETH = getWETH();
            const WBTC = getWBTC();

            const records = await pool.query(
                `SELECT * FROM token_records 
             WHERE user_id = $1 
             ORDER BY block_number ASC, log_index ASC`,
                [user.rows[0].id]
            );

            if (records.rows.length === 0) {
                return res.json({ data: 0 });
            }

            const prices = await getTokenPricing();
            const values: { [key: string]: number } = {};
            const valuesUSD: { [key: string]: number } = {};
            const averages: { [key: string]: number } = {};

            for (const record of records.rows) {
                if (!values[record.token]) {
                    values[record.token] = 0;
                    valuesUSD[record.token] = 0;
                }

                if (record.type === TokenRecordType.DEPOSIT) {
                    values[record.token] += parseFloat(record.value);
                    valuesUSD[record.token] += parseFloat(record.value) * parseFloat(record.token_price);
                } else {
                    values[record.token] -= parseFloat(record.value);
                    valuesUSD[record.token] -= parseFloat(record.value) * parseFloat(record.token_price);
                }
            }

            for (const token of [WETH, WBTC]) {
                if (values[token.address]) {
                    averages[token.address] = valuesUSD[token.address] / values[token.address];
                } else {
                    averages[token.address] = prices[token.symbol].toNumber();
                }
            }

            const ytd =
                (prices[WETH.symbol].toNumber() - averages[WETH.address]) * values[WETH.address] +
                (prices[WBTC.symbol].toNumber() - averages[WBTC.address]) * values[WBTC.address];

            await redisClient.set(cacheKey, ytd.toString(), { EX: 3600 }); // Cache for 1 hour
            res.json({ data: ytd });
        } catch (error) {
            console.error('Error in getYTD:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // You can add more methods here as needed
});