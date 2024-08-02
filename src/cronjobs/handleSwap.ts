import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { normalize } from "@aave/math-utils";
import BigNumberJS from "bignumber.js";
import { ContractTransaction, ZeroAddress } from "ethers";
import moment from "moment";
import { getIPoolAddress } from "../constants/contracts";
import { Token, getUSDC, getWBTC, getWETH, getWMATIC } from "../constants/tokens";
import { TEN_POW, calculateGasMargin, getBalanceAmount } from "../utils";
import {
    ActionType,
    AppFeeType,
    SWAP_RATIO,
    getAppFee,
    getHFAfterActions,
    getTokenPricing,
    getUserAccountData,
} from "../utils/aave";
import { getIPool, getToken, getWallet } from "../utils/abis";
import { HANDLE_SWAP_GAS_LIMIT } from "../utils/gasLimit";
import { fetchExactInTxParams, swapCollateral } from "../utils/paraswap";
import { APP_FEE_RECEIVER, executor, provider } from "../utils/provider";
import { TransactionOverrides, getGasUse, getOverrides } from "../utils/transaction";
import { TransactionStatus, TransactionType } from "../utils/types/types";

const getCycle = (user: any) => {
    if (user.updated_deposit_amount !== null) {
        if (user.updated_deposit_amount < 200) return 7.5;
        return 1;
    } else {
        if (user.deposit_amount < 200) return 7.5;
        return 1;
    }
};

const canSwap = (user: any) => {
    if (!user.last_swapped_at) return true;
    const cycle = getCycle(user);
    const timestamp = moment().subtract(cycle, "days");
    return timestamp.isAfter(user.last_swapped_at);
};

export const swapTokenAToTokenB = async (
    user: any,
    tokenIn: Token,
    tokenOut: Token,
    amountString: string,
    max = false,
    useFlashLoan = true,
): Promise<ContractTransaction[]> => {
    const txs: ContractTransaction[] = [];
    const { swapCallData, augustus, destAmountWithSlippage } = await fetchExactInTxParams(
        tokenIn,
        tokenOut,
        amountString,
        user.wallet_address,
        max,
    );
    const data = await swapCollateral(
        tokenIn.address,
        tokenIn.aToken,
        tokenOut.address,
        amountString,
        normalize(destAmountWithSlippage, tokenOut.decimals),
        user.wallet_address,
        augustus,
        swapCallData,
        useFlashLoan,
        max,
    );
    const actionTx = data.find((tx: any) => ["DLP_ACTION"].includes(tx.txType));
    if (actionTx) {
        const tx0 = await actionTx.tx();
        // @ts-ignore
        txs.push(tx0);
    }
    return txs;
};

const swapUSDCToTokens = async (
    user: any,
    tokenOut: Token,
    amount: BigNumberJS,
): Promise<[ContractTransaction[], string[]]> => {
    const USDC = getUSDC();
    const aUSDCTransferAmount = amount.div(2).div(TEN_POW(USDC.decimals)).toString();
    const txs = await swapTokenAToTokenB(
        user,
        USDC,
        tokenOut,
        aUSDCTransferAmount,
        false,
        false,
    );
    const descriptions = [
        `Swapped ${BigNumberJS(aUSDCTransferAmount).toFixed(USDC.decimals)} ${USDC.symbol} to ${
            tokenOut.symbol
        }.`,
    ];
    return [txs, descriptions];
};

const handleSwap = async (
    user: any,
    prices: Record<string, BigNumberJS>,
    overrides: TransactionOverrides,
    pool: Pool
) => {
    const client = await pool.connect();
    try {
        if (!canSwap(user)) return;
        const { referrer } = user;
        const refAddress = referrer?.address ?? ZeroAddress;

        const USDC = getUSDC();
        const WMATIC = getWMATIC();
        const WBTC = getWBTC();
        const WETH = getWETH();
        const walletContract = getWallet(user.wallet_address, executor);
        const iPoolContract = getIPool(getIPoolAddress(), provider);
        const usdcContract = getToken(USDC.address, provider);
        const {
            [WMATIC.symbol]: nativePrice,
            [USDC.symbol]: usdcPrice,
            [WETH.symbol]: wethPrice,
            [WBTC.symbol]: wbtcPrice,
        } = prices;
        const txs: ContractTransaction[] = [];
        const descriptions: string[] = [];
        const accountData = await getUserAccountData(user);
        const swapRatio = BigNumberJS(SWAP_RATIO[user.deposit_buffer]);
        const cycle = getCycle(user);
        let usdcSwap: BigNumberJS;
        if (user.updated_deposit_amount !== null) {
            if (user.updated_deposit_amount === 0) {
                return;
            }
            usdcSwap = BigNumberJS(user.updated_deposit_amount)
                .div(30)
                .multipliedBy(TEN_POW(USDC.decimals))
                .multipliedBy(cycle);
        } else {
            usdcSwap = BigNumberJS(user.deposit_amount)
                .multipliedBy(user.deposit_buffer + 100)
                .div(100)
                .multipliedBy(TEN_POW(USDC.decimals))
                .multipliedBy(swapRatio)
                .div(100)
                .multipliedBy(cycle);
        }
        const wethSwap = usdcSwap
            .div(2)
            .multipliedBy(TEN_POW(WETH.decimals - USDC.decimals))
            .div(wethPrice);
        const wbtcSwap = usdcSwap
            .div(2)
            .multipliedBy(TEN_POW(WBTC.decimals - USDC.decimals))
            .div(wbtcPrice);
        // swap fee
        const appFee = getAppFee(AppFeeType.SWAP, usdcSwap);
        const gasLimit = HANDLE_SWAP_GAS_LIMIT;
        const gas = await getGasUse(overrides, gasLimit);
        let gasUSD = gas.multipliedBy(nativePrice).div(TEN_POW(18 - USDC.decimals));
        gasUSD = BigNumberJS(gasUSD.toFixed(0));
        const afterHF = getHFAfterActions(accountData, [
            {
                token: USDC,
                amount: usdcSwap,
                tokenPrice: usdcPrice,
                type: ActionType.WITHDRAW,
            },
            {
                token: USDC,
                amount: gasUSD,
                tokenPrice: usdcPrice,
                type: ActionType.WITHDRAW,
            },
            {
                token: USDC,
                amount: appFee,
                tokenPrice: usdcPrice,
                type: ActionType.WITHDRAW,
            },
            {
                token: WETH,
                amount: wethSwap,
                tokenPrice: BigNumberJS(wethPrice),
                type: ActionType.DEPOSIT,
            },
            {
                token: WBTC,
                amount: wbtcSwap,
                tokenPrice: BigNumberJS(wbtcPrice),
                type: ActionType.DEPOSIT,
            },
        ]);
        if (!afterHF.gte(BigNumberJS(1.03))) {
            await client.query(`
                INSERT INTO transactions (user_id, descriptions, status)
                VALUES ($1, $2, $3)
            `, [user.id, [`Swap failed: insufficient ${USDC.symbol} balance for fee.`], TransactionStatus.FAIL]);
            
            await client.query(`
                UPDATE users
                SET last_swapped_at = $1
                WHERE id = $2
            `, [moment(user.last_swapped_at).add(6, "hours").toDate(), user.id]);
            
            return;
        }

        try {
            const [txs0, descriptions0] = await swapUSDCToTokens(user, WETH, usdcSwap);
            const [txs1, descriptions1] = await swapUSDCToTokens(user, WBTC, usdcSwap);
            txs.push(...txs0, ...txs1);
            descriptions.push(...descriptions0, ...descriptions1);
            // Withdraw aUSDC -> USDC for fees
            const tx2 = await iPoolContract.withdraw.populateTransaction(
                USDC.address,
                appFee.plus(gasUSD).multipliedBy(100.5).div(100).toFixed(0),
                user.wallet_address,
            );
            txs.push(tx2);

            let fee = appFee;
            if (refAddress !== ZeroAddress) {
                const refFee = fee.multipliedBy(10).div(100);
                fee = fee.minus(refFee);

                // Transfer ref fees to referrer
                const txFee = await usdcContract.transfer.populateTransaction(
                    refAddress,
                    refFee.toFixed(0),
                );
                txs.push(txFee);
            }

            // Transfer fees to executor
            const tx3 = await usdcContract.transfer.populateTransaction(
                APP_FEE_RECEIVER,
                fee.toFixed(0),
            );
            txs.push(tx3);
        } catch (error) {
            await client.query(`
                INSERT INTO transactions (user_id, descriptions, status)
                VALUES ($1, $2, $3)
            `, [user.id, [`Swap failed: ${(error as Error).message}`], TransactionStatus.FAIL]);
            return;
        }

        const to: string[] = txs.map((tx) => tx.to as string);
        const data: string[] = txs.map((tx) => tx.data as string);
        const value: string[] = txs.map((tx) => tx.value?.toString() || "0");
        
        const { rows: [transaction] } = await client.query(`
            INSERT INTO transactions (user_id, descriptions, gas)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [user.id, descriptions, getBalanceAmount(gasUSD, USDC.decimals).toFixed(2)]);

        const estimatedGas = await walletContract.execute.estimateGas(
            to,
            data,
            value,
            USDC.address,
            executor.address,
            gas.toFixed(0),
        );
        const tx = await walletContract.execute(
            to,
            data,
            value,
            USDC.address,
            executor.address,
            gas.toFixed(0),
            {
                maxFeePerGas: overrides.maxFeePerGas.toFixed(0),
                maxPriorityFeePerGas: overrides.maxPriorityFeePerGas.toFixed(0),
                gasLimit: calculateGasMargin(estimatedGas),
            },
        );

        await client.query(`
            UPDATE transactions
            SET hash = $1, status = $2
            WHERE id = $3
        `, [tx.hash, TransactionStatus.PENDING, transaction.id]);

        if (refAddress !== ZeroAddress) {
            await client.query(`
                INSERT INTO ref_transactions (from_user_id, to_user_id, description, amount, hash, status)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [user.id, referrer.id, TransactionType.SWAP_REF, appFee.multipliedBy(10).div(100).toFixed(0), tx.hash, TransactionStatus.PENDING]);
        }

        await client.query(`
            UPDATE users
            SET last_swapped_at = $1
            WHERE id = $2
        `, [new Date(), user.id]);

    } catch (error) {
        console.error('Error in handleSwap:', error);
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    try {
        const { rows: users } = await pool.query(`
            SELECT u.*, r.address as referrer_address
            FROM users u
            LEFT JOIN users r ON u.referrer_id = r.id
            WHERE u.deposit_enabled = true
            AND u.last_swapped_at < $1
        `, [moment().subtract(1, "days").toDate()]);

        const cacheKey = 'token_pricing';
        let prices: Record<string, BigNumberJS>;
        const cachedPrices = await redisClient.get(cacheKey);
        
        if (cachedPrices) {
            prices = JSON.parse(cachedPrices, (key, value) => 
                typeof value === 'string' ? new BigNumberJS(value) : value
            );
        } else {
            prices = await getTokenPricing();
            await redisClient.set(cacheKey, JSON.stringify(prices), { EX: 300 }); // Cache for 5 minutes
        }

        const overrides = await getOverrides();

        for (const user of users) {
            try {
                await handleSwap(user, prices, overrides, pool);
            } catch (error) {
                console.error(`Error handling swap for user ${user.address}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in handleSwap main function:', error);
    }
};

export default main;