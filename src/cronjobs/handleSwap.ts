import { DataSource, LessThan } from 'typeorm';
import { RedisClientType } from 'redis';
import { normalize } from "@aave/math-utils";
import BigNumberJS from "bignumber.js";
import { ContractTransaction, ethers } from "ethers";
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
import { TransactionEntity } from '../utils/entities/transaction.entity';
import { UserEntity } from '../utils/entities/user.entity';
import { RefTransactionEntity } from '../utils/entities/refTransaction.entity';

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
    user: UserEntity,
    prices: Record<string, BigNumberJS>,
    overrides: TransactionOverrides,
    dataSource: DataSource
) => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        if (!canSwap(user)) return;
        const { referrer } = user;
        const refAddress = referrer?.address ?? ethers.constants.AddressZero;

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
            const transactionRepository = queryRunner.manager.getRepository(TransactionEntity);
            await transactionRepository.save(
                transactionRepository.create({
                    user,
                    descriptions: [`Swap failed: insufficient ${USDC.symbol} balance for fee.`],
                    status: TransactionStatus.FAIL
                })
            );
            
            user.last_swapped_at = moment(user.last_swapped_at).add(6, "hours").toDate();
            await queryRunner.manager.save(user);
            
            await queryRunner.commitTransaction();
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
            if (refAddress !== ethers.constants.AddressZero) {
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
            const transactionRepository = queryRunner.manager.getRepository(TransactionEntity);
            await transactionRepository.save(
                transactionRepository.create({
                    user,
                    descriptions: [`Swap failed: ${(error as Error).message}`],
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
            descriptions,
            gas: getBalanceAmount(gasUSD, USDC.decimals).toFixed(2)
        });
        transaction = await transactionRepository.save(transaction);

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

        transaction.hash = tx.hash;
        transaction.status = TransactionStatus.PENDING;
        await transactionRepository.save(transaction);

        if (refAddress !== ethers.constants.AddressZero) {
            const refTransactionRepository = queryRunner.manager.getRepository(RefTransactionEntity);
            await refTransactionRepository.save(
                refTransactionRepository.create({
                    from: user,
                    to: referrer,
                    description: TransactionType.SWAP_REF,
                    amount: appFee.multipliedBy(10).div(100).toFixed(0),
                    hash: tx.hash,
                    status: TransactionStatus.PENDING
                })
            );
        }

        user.last_swapped_at = new Date();
        await queryRunner.manager.save(user);

        await queryRunner.commitTransaction();
        console.log(`Swap successful for user ${user.address}`);
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error(`Error in handleSwap for user ${user.address}:`, error);
    } finally {
        await queryRunner.release();
    }
};

export const main = async (redisClient: RedisClientType, dataSource: DataSource) => {
    const userRepository = dataSource.getRepository(UserEntity);
    const users = await userRepository.find({
        where: {
            deposit_enabled: true,
            last_swapped_at: LessThan(moment().subtract(1, "days").toDate())
        },
        relations: ["referrer"]
    });

    const prices = await getTokenPricing();
    const overrides = await getOverrides();

    await Promise.all(
        users.map(async (user: UserEntity) => {
            try {
                await handleSwap(user, prices, overrides, dataSource);
            } catch (error) {
                console.error(error);
            }
        })
    );
};