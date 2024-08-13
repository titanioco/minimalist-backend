import { DataSource } from 'typeorm';
import { RedisClientType } from 'redis';
import BigNumberJS from "bignumber.js";
import { getUSDC, getWBTC, getWETH } from "../constants/tokens";
import { UserEntity } from "../utils/entities/user.entity";
import { TEN_POW } from "../utils";
import { UserAccountData, getBalance, getUserAccountData } from "../utils/aave";

const getUSDCCollateralRemaining = async (
    user: UserEntity,
    userData: UserAccountData & { hfSafe: BigNumberJS },
) => {
    const USDC = getUSDC();
    const WETH = getWETH();
    const WBTC = getWBTC();
    const aUSDCBalance = await getBalance(USDC.aToken, user.wallet_address);
    const { currentLiquidationThreshold, totalCollateralBase, totalDebtBase, hfSafe } =
        userData;
    const totalCollateralBase115 = totalDebtBase.times(hfSafe);
    const totalCollateral = totalCollateralBase.times(currentLiquidationThreshold).div(10000);
    const totalCollateralRemaining = totalCollateral.minus(totalCollateralBase115);
    const deltaLT = (2 * USDC.LT - WBTC.LT - WETH.LT) / 2;
    return BigNumberJS.min(
        totalCollateralRemaining.div(100).div(TEN_POW(USDC.decimals)).div(deltaLT),
        aUSDCBalance.div(TEN_POW(USDC.decimals)),
    );
};

const handleSwapAmount = async (user: UserEntity, dataSource: DataSource) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const accountData = await getUserAccountData(user);
        if (accountData.healthFactor.div(TEN_POW(18)).lt(BigNumberJS(1.03))) {
            user.need_update = false;
            user.updated_deposit_amount = 0;
            await queryRunner.manager.save(user);
            await queryRunner.commitTransaction();
            return;
        }
        const usdcRemaining = await getUSDCCollateralRemaining(user, {
            ...accountData,
            hfSafe: BigNumberJS(1.03),
        });
        user.need_update = false;
        user.updated_deposit_amount = usdcRemaining.toNumber();
        await queryRunner.manager.save(user);
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error(`Error in handleSwapAmount for user ${user.address}:`, error);
    } finally {
        await queryRunner.release();
    }
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find({
        where: { need_update: true }
    });

    await Promise.all(
        users.map(async (user: UserEntity) => {
            try {
                await handleSwapAmount(user, dataSource);
            } catch (error) {
                console.error(error);
            }
        })
    );
};