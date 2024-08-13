import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { TransactionEntity } from "../utils/entities/transaction.entity";
import { provider } from "../utils/provider";
import { TransactionStatus } from "../utils/types/types";

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const transactionRepository = dataSource.getRepository(TransactionEntity);
    const txsPending = await transactionRepository.find({
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
            await transactionRepository.save(tx);
        })
    );
};