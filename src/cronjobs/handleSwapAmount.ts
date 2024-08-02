import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import BigNumberJS from "bignumber.js";
import { getUSDC, getWBTC, getWETH } from "../constants/tokens";
import { TEN_POW } from "../utils";
import { UserAccountData, getBalance, getUserAccountData } from "../utils/aave";

const getUSDCCollateralRemaining = async (
    user: any,
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

const handleSwapAmount = async (user: any, pool: Pool) => {
    const client = await pool.connect();
    try {
        const accountData = await getUserAccountData(user);
        if (accountData.healthFactor.div(TEN_POW(18)).lt(BigNumberJS(1.03))) {
            await client.query(`
                UPDATE users 
                SET need_update = false, updated_deposit_amount = 0 
                WHERE address = $1
            `, [user.address]);
            return;
        }
        const usdcRemaining = await getUSDCCollateralRemaining(user, {
            ...accountData,
            hfSafe: BigNumberJS(1.03),
        });
        await client.query(`
            UPDATE users 
            SET need_update = false, updated_deposit_amount = $1 
            WHERE address = $2
        `, [usdcRemaining.toNumber(), user.address]);
    } catch (error) {
        console.error(`Error in handleSwapAmount for user ${user.address}:`, error);
    } finally {
        client.release();
    }
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    try {
        const { rows: users } = await pool.query(`
            SELECT * FROM users 
            WHERE need_update = true
        `);

        await Promise.all(
            users.map(async (user: any) => {
                try {
                    await handleSwapAmount(user, pool);
                } catch (error) {
                    console.error(`Error handling swap amount for user ${user.address}:`, error);
                }
            })
        );
    } catch (error) {
        console.error('Error in handleSwapAmount main function:', error);
    }
};

export default main;