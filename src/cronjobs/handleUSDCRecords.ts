import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import BigNumberJS from "bignumber.js";
import { getToken } from "../utils/abis";
import { provider } from "../utils/provider";
import { TokenRecordType } from "../utils/types/types";
import { getStartBlock } from "../constants/contracts";
import { Token, getUSDC } from "../constants/tokens";
import { getBalanceAmount } from "../utils";
import { Log, EventLog } from 'ethers';

// Type guard to check if the event is an EventLog
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
        const addresses = users.map((user: any) => user.address);
        const wallets = users.map((user: any) => user.wallet_address);
        const tokenContract = getToken(token.address);
        const filter0 = tokenContract.filters.Transfer(null, wallets, null);
        const filter1 = tokenContract.filters.Transfer(wallets, null, null);
        const events0 = await tokenContract.queryFilter(filter0, startBlock, endBlock);
        const events1 = await tokenContract.queryFilter(filter1, startBlock, endBlock);
        const events = events0.concat(events1);
        const price = "1";

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

            if (from && to && value) {
                if (wallets.includes(from) && addresses.includes(to)) {
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
                        getBalanceAmount(BigNumberJS(value.toString()), token.decimals).toString(),
                    ]);
                }
                if (addresses.includes(from) && wallets.includes(to)) {
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
                        getBalanceAmount(BigNumberJS(value.toString()), token.decimals).toString(),
                    ]);
                }
            }
        }
    } finally {
        client.release();
    }
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    const client = await pool.connect();
    try {
        let config = await client.query('SELECT * FROM usdc_config LIMIT 1');
        if (config.rows.length === 0) {
            await client.query(`
                INSERT INTO usdc_config (block_number)
                VALUES ($1)
            `, [getStartBlock()]);
            config = await client.query('SELECT * FROM usdc_config LIMIT 1');
        }

        const { rows: users } = await client.query('SELECT * FROM users');
        const USDC = getUSDC();

        const BLOCKS = 3000;
        const startBlock = config.rows[0].block_number;
        const endBlock = Math.min(startBlock + BLOCKS, await provider.getBlockNumber());
        if (startBlock >= endBlock) {
            return;
        }

        try {
            await handleTokenRecord(users, USDC, startBlock, endBlock, pool);
            await client.query(`
                UPDATE usdc_config
                SET block_number = $1
                WHERE id = $2
            `, [endBlock, config.rows[0].id]);
        } catch (error) {
            console.error('Error in handleUSDCRecords:', error);
        }
    } finally {
        client.release();
    }
};

export default main;