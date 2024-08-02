import { Pool } from 'pg';
import BigNumberJS from "bignumber.js";
import { getBalanceAmount } from "../utils";
import { getAggregator, getToken } from "../utils/abis";
import { getUSDC, getWBTC, getWETH, Token } from "../constants/tokens";
import { TokenRecordType } from "../utils/types/types";
import { Log, EventLog } from 'ethers';
import { RedisClientType } from 'redis';
import { getStartBlock } from '../constants/contracts';
import { provider } from '../utils/provider';

function isEventLog(event: Log | EventLog): event is EventLog {
    return 'args' in event;
}

const handleTokenRecord = async (
    users: any[],
    token: Token,
    startBlock: number,
    endBlock: number,
    pool: Pool
) => {
    const client = await pool.connect();
    try {
        const wallets = users.map((user: any) => user.wallet_address);
        const aggregatorContract = getAggregator(token.aggregator);
        const tokenContract = getToken(token.aToken);
        const filter0 = tokenContract.filters.Transfer(null, wallets, null);
        const filter1 = tokenContract.filters.Transfer(wallets, null, null);
        const events0 = await tokenContract.queryFilter(filter0, startBlock, endBlock);
        const events1 = await tokenContract.queryFilter(filter1, startBlock, endBlock);
        const events = events0.concat(events1);
        const price0 = await aggregatorContract.latestAnswer({
            blockTag: startBlock,
        });
        const price1 = await aggregatorContract.latestAnswer({
            blockTag: startBlock,
        });
        const price = getBalanceAmount(
            BigNumberJS(price0.toString()).plus(price1.toString()).div(2),
            8,
        ).toFixed(2);

        for (const event of events) {
            const blockNumber = event.blockNumber;
            const logIndex = 'logIndex' in event ? event.logIndex : 0;
            const transactionHash = event.transactionHash;

            let from: string | undefined;
            let to: string | undefined;
            let value: BigNumberJS | undefined;

            if (isEventLog(event) && event.args) {
                [from, to, value] = event.args;
            } else {
                console.warn('Event does not have expected structure:', event);
                continue;
            }

            if (from && wallets.includes(from)) {
                await client.query(`
                    INSERT INTO token_records (user_id, block_number, log_index, hash, type, token, token_price, value)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    users.find((user: any) => user.wallet_address === from)?.id,
                    blockNumber,
                    logIndex,
                    transactionHash,
                    TokenRecordType.WITHDRAW,
                    token.address,
                    price,
                    getBalanceAmount(BigNumberJS(value?.toString() ?? '0'), token.decimals).toString(),
                ]);
            }
            if (to && wallets.includes(to)) {
                await client.query(`
                    INSERT INTO token_records (user_id, block_number, log_index, hash, type, token, token_price, value)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    users.find((user: any) => user.wallet_address === to)?.id,
                    blockNumber,
                    logIndex,
                    transactionHash,
                    TokenRecordType.DEPOSIT,
                    token.address,
                    price,
                    getBalanceAmount(BigNumberJS(value?.toString() ?? '0'), token.decimals).toString(),
                ]);
            }
        }
    } finally {
        client.release();
    }
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    const client = await pool.connect();
    try {
        let config = await client.query('SELECT * FROM app_config LIMIT 1');
        if (config.rows.length === 0) {
            await client.query(`
                INSERT INTO app_config (block_number)
                VALUES ($1)
            `, [getStartBlock()]);
            config = await client.query('SELECT * FROM app_config LIMIT 1');
        }

        const { rows: users } = await client.query('SELECT * FROM users');
        const WETH = getWETH();
        const WBTC = getWBTC();
        const USDC = getUSDC();

        const BLOCKS = 3000;
        const startBlock = config.rows[0].block_number;
        const endBlock = Math.min(startBlock + BLOCKS, await provider.getBlockNumber());
        if (startBlock >= endBlock) {
            return;
        }

        try {
            await handleTokenRecord(users, WETH, startBlock, endBlock, pool);
            await handleTokenRecord(users, WBTC, startBlock, endBlock, pool);
            await handleTokenRecord(users, USDC, startBlock, endBlock, pool);
            await client.query(`
                UPDATE app_config
                SET block_number = $1
                WHERE id = $2
            `, [endBlock, config.rows[0].id]);
        } catch (error) {
            console.error('Error in handleTokenRecords:', error);
        }
    } finally {
        client.release();
    }
};

export default main;