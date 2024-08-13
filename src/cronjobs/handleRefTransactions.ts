import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { RefTransactionEntity } from "../utils/entities/refTransaction.entity";
import { provider } from "../utils/provider";
import { TransactionStatus } from "../utils/types/types";

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const refTransactionRepository = dataSource.getRepository(RefTransactionEntity);
    const txsPending = await refTransactionRepository.find({
        where: { status: TransactionStatus.PENDING }
    });

    if (txsPending.length === 0) return;

    await Promise.all(
        txsPending.map(async (tx) => {
            const receipt = await provider.getTransactionReceipt(tx.hash);
            if (!receipt) return;

            tx.status = receipt.status === 1 ? TransactionStatus.SUCCESS :
                        receipt.status === 0 ? TransactionStatus.FAIL :
                        tx.status;
            await refTransactionRepository.save(tx);
        })
    );
};