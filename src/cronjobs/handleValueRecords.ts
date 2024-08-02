import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { getBalanceAmount } from "../utils";
import { getUserAccountData } from "../utils/aave";

const handleValueRecord = async (user: any, pool: Pool) => {
    const client = await pool.connect();
    try {
        const accountData = await getUserAccountData(user);
        const value = getBalanceAmount(accountData.totalCollateralBase, 8).toFixed(2);
        const totalDebtBase = getBalanceAmount(accountData.totalDebtBase, 8).toFixed(2);

        await client.query(`
            INSERT INTO value_records (user_id, value, total_debt_base)
            VALUES ($1, $2, $3)
        `, [user.id, value, totalDebtBase]);

        console.log(`Value record created for user ${user.address}`);
    } catch (error) {
        console.error(`Error creating value record for user ${user.address}:`, error);
    } finally {
        client.release();
    }
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    try {
        const { rows: users } = await pool.query('SELECT * FROM users');

        await Promise.all(
            users.map(async (user: any) => {
                try {
                    await handleValueRecord(user, pool);
                } catch (error) {
                    console.error(`Error handling value record for user ${user.address}:`, error);
                }
            })
        );
    } catch (error) {
        console.error('Error in handleValueRecords main function:', error);
    }
};

export default main;