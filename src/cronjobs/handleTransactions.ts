import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { provider } from "../utils/provider";
import { TransactionStatus } from "../utils/types/types";

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    const client = await pool.connect();
    try {
        // Fetch pending transactions
        const { rows: txsPending } = await client.query(`
            SELECT * FROM transactions
            WHERE status = $1
        `, [TransactionStatus.PENDING]);

        if (txsPending.length === 0) return;

        await Promise.all(
            txsPending.map(async (tx) => {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                if (!receipt) {
                    return;
                }

                let newStatus;
                if (receipt.status === 1) {
                    newStatus = TransactionStatus.SUCCESS;
                } else if (receipt.status === 0) {
                    newStatus = TransactionStatus.FAIL;
                } else {
                    return; // Status unchanged, no need to update
                }

                // Update transaction status
                await client.query(`
                    UPDATE transactions
                    SET status = $1
                    WHERE id = $2
                `, [newStatus, tx.id]);

                console.log(`Updated transaction ${tx.id} status to ${newStatus}`);
            })
        );
    } catch (error) {
        console.error('Error in handleTransactions:', error);
    } finally {
        client.release();
    }
};

export default main;