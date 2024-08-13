import { DataSource } from 'typeorm';
import { RedisClientType } from 'redis';
import { USDCConfigEntity } from '../utils/entities/usdcConfig.entity';
import { TokenRecordEntity } from '../utils/entities/tokenRecord.entity';
import { UserEntity } from "../utils/entities/user.entity";
import BigNumberJS from "bignumber.js";
import { getToken } from "../utils/abis";
import { provider } from "../utils/provider";
import { TokenRecordType } from "../utils/types/types";
import { getStartBlock } from "../constants/contracts";
import { Token, getUSDC } from "../constants/tokens";
import { getBalanceAmount } from "../utils";

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
        const addresses = users.map((user) => user.address);
        const wallets = users.map((user) => user.wallet_address);
        const tokenContract = getToken(token.address);
        const filter0 = tokenContract.filters.Transfer(null, wallets, null);
        const filter1 = tokenContract.filters.Transfer(wallets, null, null);
        const events0 = await tokenContract.queryFilter(filter0, startBlock, endBlock);
        const events1 = await tokenContract.queryFilter(filter1, startBlock, endBlock);
        const events = events0.concat(events1);
        const price = "1";

        const tokenRecordRepository = queryRunner.manager.getRepository(TokenRecordEntity);
        const tokenRecords: TokenRecordEntity[] = [];

        for (const event of events) {
            const { blockNumber, logIndex, transactionHash } = event;
            const { from, to, value } = event.args!;

            if (wallets.includes(from) && addresses.includes(to)) {
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
            if (addresses.includes(from) && wallets.includes(to)) {
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
        console.error(`Error in handleTokenRecord for USDC:`, error);
    } finally {
        await queryRunner.release();
    }
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const usdcConfigRepository = dataSource.getRepository(USDCConfigEntity);
    let config = await usdcConfigRepository.findOne({});
    if (!config) {
        config = usdcConfigRepository.create({
            block_number: getStartBlock(),
        });
        config = await usdcConfigRepository.save(config);
    }

    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find();
    const USDC = getUSDC();

    const BLOCKS = 3000;
    const startBlock = config.block_number;
    const endBlock = Math.min(startBlock + BLOCKS, await provider.getBlockNumber());
    if (startBlock >= endBlock) {
        return;
    }

    try {
        await handleTokenRecord(users, USDC, startBlock, endBlock, dataSource);
        await usdcConfigRepository.update(config.id, { block_number: endBlock });
    } catch (error) {
        console.error(error);
    }
};