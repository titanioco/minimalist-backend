import { DataSource } from 'typeorm';
import { RedisClientType } from 'redis';
import BigNumberJS from "bignumber.js";
import { ContractTransaction } from "ethers";
import { getIPoolAddress } from "../constants/contracts";
import { getUSDC, getWBTC, getWETH, getWMATIC } from "../constants/tokens";
import { BIG_ZERO, TEN_POW, calculateGasMargin, getBalanceAmount } from "../utils";
import {
    Action,
    ActionType,
    UserAccountData,
    getBalance,
    getHFAfterActions,
    getTokenPricing,
    getUserAccountData,
} from "../utils/aave";
import { getIPool, getWallet } from "../utils/abis";
import { HANDLE_HF_GAS_LIMIT } from "../utils/gasLimit";
import { executor, provider } from "../utils/provider";
import { TransactionOverrides, getGasUse, getOverrides } from "../utils/transaction";
import { TransactionStatus } from "../utils/types/types";
import { swapTokenAToTokenB } from "./handleSwap";
import { UserEntity } from '../utils/entities/user.entity';
import { TransactionEntity } from '../utils/entities/transaction.entity';

const getTotalCollateralMissing = (userData: UserAccountData & { hfSafe: BigNumberJS }) => {
    const USDC = getUSDC();
    const { currentLiquidationThreshold, totalCollateralBase, totalDebtBase, hfSafe } = userData;
    const totalCollateralBase115 = totalDebtBase.times(hfSafe);
    const totalCollateral = totalCollateralBase.times(currentLiquidationThreshold).div(10000);
    const totalCollateralMissing = totalCollateralBase115.minus(totalCollateral);
    return totalCollateralMissing.div(100).div(TEN_POW(USDC.decimals));
};

const handleMissingCollateral = async (
    user: any,
    txFee: BigNumberJS,
    prices: Record<string, BigNumberJS>,
): Promise<ContractTransaction[]> => {
    const USDC = getUSDC();
    const WETH = getWETH();
    const WBTC = getWBTC();
    const accountData = await getUserAccountData(user);
    if (accountData.healthFactor.div(TEN_POW(18)).gt(BigNumberJS(1.03))) return [];
    let hfSafe = BigNumberJS(1.06);
    if (accountData.healthFactor.div(TEN_POW(18)).lte(BigNumberJS(1.01))) {
        hfSafe = BigNumberJS(1.08);
    } else if (accountData.healthFactor.div(TEN_POW(18)).lte(BigNumberJS(1.02))) {
        hfSafe = BigNumberJS(1.07);
    }
    let collateralMissing = getTotalCollateralMissing({
        ...accountData,
        hfSafe,
    });
    const actions: Action[] = [];
    collateralMissing = collateralMissing.plus(txFee.div(TEN_POW(USDC.decimals)));
    actions.push({
        token: USDC,
        amount: txFee,
        tokenPrice: prices[USDC.symbol],
        type: ActionType.WITHDRAW,
    });
    const txs: ContractTransaction[] = [];
    const aTokenBalances = await Promise.all([
        getBalance(WBTC.aToken, user.wallet_address),
        getBalance(WETH.aToken, user.wallet_address),
    ]);
    const totalDeltaLT = 2 * USDC.LT - WBTC.LT - WETH.LT;
    while (!collateralMissing.isZero() && aTokenBalances.some((balance) => balance.gt(0))) {
        const collateralMissingEachStep = collateralMissing.div(totalDeltaLT);
        collateralMissing = BIG_ZERO;
        for (const [i, token] of [WBTC, WETH].entries()) {
            if (aTokenBalances[i].eq(0)) continue;
            const aTokenPrice = prices[token.symbol];
            const deltaLT = USDC.LT - token.LT;
            const usdBalance = aTokenBalances[i].div(TEN_POW(token.decimals)).times(aTokenPrice);
            try {
                if (usdBalance.gt(collateralMissingEachStep)) {
                    txs.push(
                        ...(await swapTokenAToTokenB(
                            user,
                            token,
                            USDC,
                            collateralMissingEachStep.div(aTokenPrice).toFixed(token.decimals),
                        )),
                    );
                    actions.push({
                        token: USDC,
                        amount: collateralMissingEachStep.times(deltaLT).multipliedBy(TEN_POW(USDC.decimals)),
                        tokenPrice: prices[USDC.symbol],
                        type: ActionType.DEPOSIT,
                    });
                    aTokenBalances[i] = aTokenBalances[i].minus(
                        collateralMissingEachStep.div(aTokenPrice).multipliedBy(TEN_POW(token.decimals)),
                    );
                } else {
                    const amountString = aTokenBalances[i]
                        .div(TEN_POW(token.decimals))
                        .toFixed(token.decimals);
                    if (BigNumberJS(amountString).gt(0)) {
                        txs.push(...(await swapTokenAToTokenB(user, token, USDC, amountString, true)));
                        actions.push({
                            token: USDC,
                            amount: usdBalance.multipliedBy(TEN_POW(USDC.decimals)),
                            tokenPrice: prices[USDC.symbol],
                            type: ActionType.DEPOSIT,
                        });
                        collateralMissing = collateralMissing.plus(
                            collateralMissingEachStep.minus(usdBalance).times(deltaLT),
                        );
                    }
                    aTokenBalances[i] = BIG_ZERO;
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
    const afterHF = getHFAfterActions(accountData, actions);
    if (afterHF.lte(accountData.healthFactor.div(TEN_POW(18)))) {
        throw new Error("Not enough collateral to handle");
    }
    return txs;
};

const handleHF = async (
    user: UserEntity,
    prices: Record<string, BigNumberJS>,
    overrides: TransactionOverrides,
    dataSource: DataSource
) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const USDC = getUSDC();
        const WMATIC = getWMATIC();
        const walletContract = getWallet(user.wallet_address, executor);
        const iPoolContract = getIPool(getIPoolAddress(), provider);
        const { [WMATIC.symbol]: nativePrice } = prices;
        const txs: ContractTransaction[] = [];
        const gasLimit = HANDLE_HF_GAS_LIMIT.multipliedBy(1.5);
        const gas = await getGasUse(overrides, gasLimit);
        let gasUSD = gas.multipliedBy(nativePrice).div(TEN_POW(18 - USDC.decimals));
        gasUSD = BigNumberJS(gasUSD.toFixed(0));
        try {
            txs.push(...(await handleMissingCollateral(user, gasUSD, prices)));
            if (txs.length === 0) {
                return;
            }
            // Withdraw aUSDC -> USDC for fees
            const tx0 = await iPoolContract.withdraw.populateTransaction(
                USDC.address,
                gasUSD.multipliedBy(100.5).div(100).toFixed(0),
                user.wallet_address
            );
            txs.push(tx0);
        } catch (error) {
            const transactionRepository = queryRunner.manager.getRepository(TransactionEntity);
            await transactionRepository.save(
                transactionRepository.create({
                    user,
                    descriptions: [`Handle healthfactor failed: ${(error as Error).message}`],
                    status: TransactionStatus.FAIL
                })
            );
            await queryRunner.commitTransaction();
            return;
        }

        const to: string[] = txs.map((tx) => tx.to as string);
        const data: string[] = txs.map((tx) => tx.data as string);
        const value: string[] = txs.map((tx) => tx.value?.toString() || "0");

        const transactionRepository = queryRunner.manager.getRepository(TransactionEntity);
        let transaction = transactionRepository.create({
            user,
            descriptions: [`Handled healthfactor.`],
            gas: getBalanceAmount(gasUSD, USDC.decimals).toFixed(2)
        });
        transaction = await transactionRepository.save(transaction);

        const estimatedGas = await walletContract.execute.estimateGas(
            to,
            data,
            value,
            USDC.address,
            executor.address,
            gas.toFixed(0)
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
            }
        );

        transaction.hash = tx.hash;
        transaction.status = TransactionStatus.PENDING;
        await transactionRepository.save(transaction);

        const userRepository = queryRunner.manager.getRepository(UserEntity);
        user.need_update = true;
        user.updated_deposit_amount = null;
        await userRepository.save(user);

        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error(`Error in handleHF for user ${user.address}:`, error);
    } finally {
        await queryRunner.release();
    }
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find({
        where: { protection_enabled: true },
        relations: ["referrer"]
    });

    const prices = await getTokenPricing();
    const overrides = await getOverrides();

    await Promise.all(
        users.map(async (user: UserEntity) => {
            try {
                await handleHF(user, prices, overrides, dataSource);
            } catch (error) {
                console.error(error);
            }
        })
    );
};