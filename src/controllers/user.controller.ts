import { Request, Response } from 'express-serve-static-core';
import { RedisClientType } from 'redis';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { utils, ethers } from 'ethers';
import _ from 'lodash';
import moment from 'moment';
import { getLedger } from '../utils/abis';
import { getLedgerAddress } from '../constants/contracts';
import { provider } from '../utils/provider';
import { TransactionStatus, TokenRecordType } from '../utils/types/types';
import { getTokenPricing } from '../utils/aave';
import { getWBTC, getWETH } from '../constants/tokens';
import HttpStatus from '../utils/types/httpStatus';
import { UserEntity } from '../utils/entities/user.entity';
import { TransactionEntity } from '../utils/entities/transaction.entity';
import { RefTransactionEntity } from '../utils/entities/refTransaction.entity';
import { ValueRecordEntity } from '../utils/entities/valueRecord.entity';
import { TokenRecordEntity } from '../utils/entities/tokenRecord.entity';

const { isAddress, getAddress } = utils;

export const userController = (redisClient: RedisClientType, dataSource: DataSource) => ({
    getNonce: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ where: { address: getAddress(address) } });

            if (!user) {
                return res.json({ data: '0' });
            }

            const newNonce = user.nonce + 1;
            await userRepository.update({ address: getAddress(address) }, { nonce: newNonce });

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

            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ 
                where: { address: getAddress(address) },
                relations: ['referrer']
            });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

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

            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ 
                where: { code },
                relations: ['referrer']
            });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

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

            const userRepository = dataSource.getRepository(UserEntity);
            const users = await userRepository.find();

            await redisClient.set(cacheKey, JSON.stringify(users), { EX: 300 }); // Cache for 5 minutes
            res.json({ data: users });
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

            const userRepository = dataSource.getRepository(UserEntity);
            const children = await userRepository.find({
                where: { referrer: { address: getAddress(address) } },
            });

            await redisClient.set(cacheKey, JSON.stringify(children), { EX: 300 }); // Cache for 5 minutes
            res.json({ data: children });
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

            const userRepository = dataSource.getRepository(UserEntity);
            const existingUser = await userRepository.findOne({ where: { address: getAddress(address) } });
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const ledgerContract = getLedger(getLedgerAddress(), provider);
            const walletAddress = await ledgerContract.getWallet(getAddress(address));
            if (walletAddress === ethers.constants.AddressZero) {
                return res.status(400).json({ message: 'Something went wrong' });
            }

            const userAddress = getAddress(address);
            const userCode = userAddress.slice(2, 6) + userAddress.slice(userAddress.length - 4);

            let referrer = null;
            if (code) {
                referrer = await userRepository.findOne({ where: { code } });
            }

            const newUser = userRepository.create({
                address: userAddress,
                code: userCode,
                wallet_address: walletAddress,
                recipient: userAddress,
                referrer: referrer
            });

            await userRepository.save(newUser);

            // Invalidate relevant caches
            await redisClient.del(`user:${userAddress}`);
            await redisClient.del('all:users');

            res.status(201).json({ data: newUser });
        } catch (error) {
            console.error('Error in register:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    updateUser: async (req: Request, res: Response) => {
        try {
            const { address: userAddress } = req.params;
            const data = req.body;
            if (!userAddress || !isAddress(userAddress)) {
                return res.status(HttpStatus.BadRequest).json({ message: "Invalid parameters" });
            }
    
            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ where: { address: getAddress(userAddress) } });
            
            if (!user) {
                return res.status(HttpStatus.BadRequest).json({ message: "User not found" });
            }
    
            const updateFields = [
                "safe_hf",
                "risk_hf",
                "cron_time",
                "recipient",
                "deposit_enabled",
                "protection_enabled",
                "deposit_amount",
                "deposit_buffer",
                "last_deposited_at",
                "last_swapped_at",
            ];
    
            updateFields.forEach(field => {
                if (data[field] !== undefined) {
                    user[field] = data[field];
                }
            });
    
            const updatedUser = await userRepository.save(user);
    
            if (data.transactions) {
                const transactionRepository = dataSource.getRepository(TransactionEntity);
                const transactions = data.transactions.map((transaction: any) => 
                    transactionRepository.create({
                        user: updatedUser,
                        hash: transaction.hash,
                        descriptions: transaction.descriptions,
                        status: TransactionStatus.SUCCESS
                    })
                );
                await transactionRepository.save(transactions);
            }
    
            if (data.refTransactions && updatedUser.referrer) {
                const refTransactionRepository = dataSource.getRepository(RefTransactionEntity);
                const refTransactions = data.refTransactions.map((transaction: any) => 
                    refTransactionRepository.create({
                        from: updatedUser,
                        to: updatedUser.referrer,
                        hash: transaction.hash,
                        description: transaction.description,
                        status: TransactionStatus.SUCCESS
                    })
                );
                await refTransactionRepository.save(refTransactions);
            }
    
            res.json({ data: updatedUser });
        } catch (error) {
            console.error('Error in updateUser:', error);
            res.status(HttpStatus.BadRequest).json({ message: (error as Error).message });
        }
    },

    setUserNeedUpdate: async (req: Request, res: Response) => {
        try {
            const { address } = req.params;
            if (!address || !isAddress(address)) {
                return res.status(400).json({ message: 'Invalid address' });
            }

            const userRepository = dataSource.getRepository(UserEntity);
            const result = await userRepository.update(
                { address: getAddress(address) },
                { need_update: true, updated_deposit_amount: null }
            );

            if (result.affected === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const updatedUser = await userRepository.findOne({ where: { address: getAddress(address) } });

            // Invalidate relevant caches
            await redisClient.del(`user:${address}`);

            res.json({ data: updatedUser });
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

            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ where: { address: getAddress(address) } });
            if (!user) {
                return res.json({ data: 0 });
            }

            const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);
            const timestamp = moment().subtract(1, 'years').toDate();
            const record = await valueRecordRepository.findOne({
                where: { 
                    user: { address: user.address }, 
                    created_at: MoreThanOrEqual(timestamp) 
                },
                order: { created_at: 'ASC' }
            });

            const snapshotValue = record ? parseFloat(record.value) : 0;
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
    
            const userRepository = dataSource.getRepository(UserEntity);
            const user = await userRepository.findOne({ where: { address: getAddress(address) } });
            if (!user) {
                return res.json({ data: 0 });
            }
    
            const WETH = getWETH();
            const WBTC = getWBTC();
    
            const tokenRecordRepository = dataSource.getRepository(TokenRecordEntity);
            const records = await tokenRecordRepository.find({
                where: { user: { address: user.address } },
                order: { block_number: 'ASC', log_index: 'ASC' }
            });
    
            if (records.length === 0) {
                return res.json({ data: 0 });
            }
    
            const prices = await getTokenPricing();
            const values: { [key: string]: number } = {};
            const valuesUSD: { [key: string]: number } = {};
            const averages: { [key: string]: number } = {};
    
            for (const record of records) {
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