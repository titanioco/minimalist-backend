import { RedisClientType } from 'redis';
import { DataSource } from 'typeorm';
import { UserEntity } from "../utils/entities/user.entity";
import { ValueRecordEntity } from "../utils/entities/valueRecord.entity";
import { getBalanceAmount } from "../utils";
import { getUserAccountData } from "../utils/aave";

const handleValueRecord = async (user: UserEntity, dataSource: DataSource) => {
    const valueRecordRepository = dataSource.getRepository(ValueRecordEntity);
    const accountData = await getUserAccountData(user);
    const value = getBalanceAmount(accountData.totalCollateralBase, 8).toFixed(2);
    const record = valueRecordRepository.create({
        user,
        value,
        totalDebtBase: getBalanceAmount(accountData.totalDebtBase, 8).toFixed(2),
    });
    await valueRecordRepository.save(record);
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find();

    await Promise.all(
        users.map(async (user: UserEntity) => {
            try {
                await handleValueRecord(user, dataSource);
            } catch (error) {
                console.error(error);
            }
        })
    );
};