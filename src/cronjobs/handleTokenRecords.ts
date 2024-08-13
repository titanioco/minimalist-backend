import { DataSource } from 'typeorm';
import BigNumberJS from "bignumber.js";
import { getBalanceAmount } from "../utils";
import { AppConfigEntity } from '../utils/entities/appConfig.entity';
import { TokenRecordEntity } from '../utils/entities/tokenRecord.entity';
import { UserEntity } from "../utils/entities/user.entity";
import { getAggregator, getToken } from "../utils/abis";
import { getUSDC, getWBTC, getWETH, Token } from "../constants/tokens";
import { TokenRecordType } from "../utils/types/types";
import { RedisClientType } from 'redis';
import { getStartBlock } from '../constants/contracts';
import { provider } from '../utils/provider';

const handleTokenRecord = async (
    users: UserEntity[],
    token: Token,
    startBlock: number,
    endBlock: number,
    dataSource: DataSource
) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const wallets = users.map((user) => user.wallet_address);
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
            blockTag: endBlock,
        });
        const price = getBalanceAmount(
            BigNumberJS(price0.toString()).plus(price1.toString()).div(2),
            8,
        ).toFixed(2);

        const tokenRecordRepository = queryRunner.manager.getRepository(TokenRecordEntity);
        const tokenRecords: TokenRecordEntity[] = [];

        for (const event of events) {
            const { blockNumber, logIndex, transactionHash } = event;
            const { from, to, value } = event.args!;

            if (wallets.includes(from)) {
                const user = users.find((user) => user.wallet_address === from);
                if (user) {
                    tokenRecords.push(tokenRecordRepository.create({
                        user,
                        block_number: blockNumber,
                        log_index: logIndex,
                        hash: transactionHash,
                        type: TokenRecordType.WITHDRAW,
                        token: token.address,
                        token_price: price,
                        value: getBalanceAmount(BigNumberJS(value.toString()), token.decimals).toString()
                    }));
                }
            }
            if (wallets.includes(to)) {
                const user = users.find((user) => user.wallet_address === to);
                if (user) {
                    tokenRecords.push(tokenRecordRepository.create({
                        user,
                        block_number: blockNumber,
                        log_index: logIndex,
                        hash: transactionHash,
                        type: TokenRecordType.DEPOSIT,
                        token: token.address,
                        token_price: price,
                        value: getBalanceAmount(BigNumberJS(value.toString()), token.decimals).toString()
                    }));
                }
            }
        }

        if (tokenRecords.length > 0) {
            await tokenRecordRepository.save(tokenRecords);
        }

        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error(`Error in handleTokenRecord for token ${token.symbol}:`, error);
    } finally {
        await queryRunner.release();
    }
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const appConfigRepository = dataSource.getRepository(AppConfigEntity);
    let config = await appConfigRepository.findOne({});
    if (!config) {
        config = appConfigRepository.create({
            block_number: getStartBlock(),
        });
        config = await appConfigRepository.save(config);
    }

    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find();

    const WETH = getWETH();
    const WBTC = getWBTC();
    const USDC = getUSDC();

    const BLOCKS = 3000;
    const startBlock = config.block_number;
    const endBlock = Math.min(startBlock + BLOCKS, await provider.getBlockNumber());
    if (startBlock >= endBlock) {
        return;
    }

    try {
        await handleTokenRecord(users, WETH, startBlock, endBlock, dataSource);
        await handleTokenRecord(users, WBTC, startBlock, endBlock, dataSource);
        await handleTokenRecord(users, USDC, startBlock, endBlock, dataSource);
        await appConfigRepository.update(config.id, { block_number: endBlock });
    } catch (error) {
        console.error(error);
    }
};