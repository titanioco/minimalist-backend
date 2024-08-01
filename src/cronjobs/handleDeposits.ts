import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import moment from "moment";
import BigNumberJS from "bignumber.js";
import { ethers } from "ethers";
import { LessThanOrEqual, MoreThan } from "typeorm";
import { getIPoolAddress } from "../constants/contracts";
import { getUSDC, getWMATIC, Token } from "../constants/tokens";
import { calculateGasMargin, getBalanceAmount, run, TEN_POW } from "../utils";
import {
    ActionType,
    AppFeeType,
    getAppFee,
    getBalance,
    getHFAfterActions,
    getTokenPricing,
    getUserAccountData,
} from "../utils/aave";
import { getIPool, getToken, getWallet } from "../utils/abis";
import { TransactionEntity } from "../utils/entities/transaction.entity";
import { UserEntity } from "../utils/entities/user.entity";
import { HANDLE_DEPOSIT_GAS_LIMIT } from "../utils/gasLimit";
import { fetchExactInTxParams, swapCollateral } from "../utils/paraswap";
import { APP_FEE_RECEIVER, executor, provider } from "../utils/provider";
import { getGasUse, getOverrides, TransactionOverrides } from "../utils/transaction";
import { TransactionStatus, TransactionType } from "../utils/types/types";
import { RefTransactionEntity } from "../utils/entities/refTransaction.entity";
import { normalize } from "@aave/math-utils";

type PopulatedTransaction = ethers.TransactionRequest;


const checkAndApprove = async (
    tokenAddress: string,
    owner: string,
    spender: string,
): Promise<PopulatedTransaction[]> => {
    const tokenContract = getToken(tokenAddress, provider);
    const allowance = await tokenContract.allowance(owner, spender);
    if (allowance > (ethers.MaxUint256 / 100n)) {
        return [];
    }
    const tx = await tokenContract.approve.populateTransaction(
        spender,
        ethers.MaxUint256
    );
    return [tx];
};

export const swapTokenAToTokenB = async (
    user: UserEntity,
    tokenIn: Token,
    tokenOut: Token,
    amountString: string,
    max = false,
    useFlashLoan = true,
): Promise<PopulatedTransaction[]> => {
    const txs: PopulatedTransaction[] = [];
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

const depositUSDC = async (
    user: UserEntity,
    amount: BigNumberJS,
    appFee: BigNumberJS,
    txFee: BigNumberJS,
): Promise<[ethers.TransactionRequest[], string[]]> => {
    const txs: ethers.TransactionRequest[] = [];
    const USDC = getUSDC();
    const iPoolContract = getIPool(getIPoolAddress(), provider);
    const usdcContract = getToken(USDC.address, provider);
    const { referrer } = user;
    const refAddress = referrer?.address ?? ethers.ZeroAddress;

    // Set E-Mode
    const mode = await iPoolContract.getUserEMode(user.wallet_address);
    if (mode.toString() !== "1") {
        const tx0 = await iPoolContract.setUserEMode.populateTransaction("1");
        txs.push(tx0);
    }

    const borrowAmount = BigNumberJS(user.deposit_amount).multipliedBy(TEN_POW(USDC.decimals));
    txs.push(...(await checkAndApprove(USDC.address, user.wallet_address, getIPoolAddress())));
    
    // Transfer USDC to wallet contract
    const tx1 = await usdcContract.transferFrom.populateTransaction(
        user.address,
        user.wallet_address,
        amount.toFixed(0)
    );
    txs.push(tx1);
    
    // Supply USDC
    const tx2 = await iPoolContract.supply.populateTransaction(
        USDC.address,
        amount.toFixed(0),
        user.wallet_address,
        0
    );
    txs.push(tx2);
    
    // Borrow USDC
    const tx3 = await iPoolContract.borrow.populateTransaction(
        USDC.address,
        borrowAmount.toFixed(0),
        2,
        0,
        user.wallet_address
    );
    txs.push(tx3);
    
    // Transfer borrowed USDC to wallet contract
    const tx4 = await usdcContract.transfer.populateTransaction(
        user.recipient,
        borrowAmount.toFixed(0)
    );
    txs.push(tx4);
    
    // Withdraw aUSDC -> USDC for fees
    const tx5 = await iPoolContract.withdraw.populateTransaction(
        USDC.address,
        appFee.plus(txFee).multipliedBy(100.5).div(100).toFixed(0),
        user.wallet_address
    );
    txs.push(tx5);

    if (refAddress !== ethers.ZeroAddress) {
        const refFee = appFee.multipliedBy(10).div(100);
        appFee = appFee.minus(refFee);

        // Transfer ref fees to referrer
        const txFee = await usdcContract.transfer.populateTransaction(
            refAddress,
            refFee.toFixed(0)
        );
        txs.push(txFee);
    }

    // Transfer fees to appfee receiver
    const tx6 = await usdcContract.transfer.populateTransaction(
        APP_FEE_RECEIVER,
        appFee.toFixed(0)
    );
    txs.push(tx6);

    const descriptions = [
        `Deposited ${getBalanceAmount(amount, USDC.decimals).toFixed()} USDC.`,
    ];

    return [txs, descriptions];
};

const handleDeposit = async (
    user: UserEntity,
    prices: Record<string, BigNumberJS>,
    overrides: TransactionOverrides,
) => {
    const { referrer } = user;
    const refAddress = referrer?.address ?? ethers.ZeroAddress;

    const walletContract = getWallet(user.wallet_address, executor);
    const USDC = getUSDC();
    const WMATIC = getWMATIC();
    const { [WMATIC.symbol]: nativePrice, [USDC.symbol]: usdcPrice } = prices;
    const txs: ethers.TransactionRequest[] = [];
    const descriptions: string[] = [];
    const accountData = await getUserAccountData(user);
    const usdcBalance = await getBalance(USDC.address, user.address);
    const usdcDeposit = BigNumberJS(user.deposit_amount)
        .multipliedBy(TEN_POW(getUSDC().decimals))
        .multipliedBy(100 + user.deposit_buffer)
        .div(100);

    if (!usdcBalance.gte(usdcDeposit)) {
        const transaction = TransactionEntity.create({
            user,
            descriptions: [`Deposit failed: insufficient ${USDC.symbol} balance.`],
            status: TransactionStatus.FAIL,
        });
        await transaction.save();
        return;
    }
    // deposit fee & borrow fee
    const appFee = getAppFee(AppFeeType.DEPOSIT, usdcDeposit).plus(
        getAppFee(AppFeeType.BORROW, BigNumberJS(user.deposit_amount).multipliedBy(TEN_POW(USDC.decimals))),
    );
    const gasLimit = HANDLE_DEPOSIT_GAS_LIMIT;
    const gas = await getGasUse(overrides, gasLimit);
    let gasUSD = gas.multipliedBy(nativePrice).div(TEN_POW(18 - USDC.decimals));
    gasUSD = BigNumberJS(gasUSD.toFixed(0));
    const afterHF = getHFAfterActions(accountData, [
        {
            token: USDC,
            amount: usdcDeposit,
            tokenPrice: usdcPrice,
            type: ActionType.DEPOSIT,
        },
        {
            token: USDC,
            amount: BigNumberJS(user.deposit_amount).multipliedBy(TEN_POW(USDC.decimals)),
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
    ]);
    if (!afterHF.gte(BigNumberJS(1.03))) {
        const transaction = TransactionEntity.create({
            user,
            descriptions: [`Deposit failed: insufficient ${USDC.symbol} balance for fee.`],
            status: TransactionStatus.FAIL,
        });
        await transaction.save();
        return;
    }

    const [txs0, descriptions0] = await depositUSDC(user, usdcDeposit, appFee, gasUSD);
    txs.push(...txs0);
    descriptions.push(...descriptions0);

    const to: string[] = txs.map((tx) => tx.to as string);
    const data: string[] = txs.map((tx) => tx.data as string);
    const value: string[] = txs.map((tx) => tx.value?.toString() || "0");
    const transaction = TransactionEntity.create({
        user,
        descriptions,
        gas: getBalanceAmount(gasUSD, USDC.decimals).toFixed(2),
    });

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
    await transaction.save();

    if (refAddress !== ethers.ZeroAddress) {
        const refTransaction = RefTransactionEntity.create({
            from: user,
            to: referrer,
            description: TransactionType.DEPOSIT_REF,
            amount: appFee.multipliedBy(10).div(100).toFixed(0),
        });

        refTransaction.hash = tx.hash;
        refTransaction.status = TransactionStatus.PENDING;
        await refTransaction.save();
    }

    user.last_deposited_at = new Date();
    await user.save();
    await UserEntity.update(
        {
            address: user.address,
        },
        { need_update: true, updated_deposit_amount: null },
    );
};

export const main = async (redisClient: RedisClientType, pool: Pool) => {
    try {
        const timestamp = moment().subtract(30, "days").toDate();
        const usersResult = await pool.query(`
            SELECT * FROM users 
            WHERE (deposit_amount > 0 AND deposit_enabled = true AND (last_deposited_at <= $1 OR last_deposited_at IS NULL))
            ORDER BY last_deposited_at ASC NULLS FIRST
        `, [timestamp]);
        const users = usersResult.rows;

        const cacheKey = 'token_pricing';
        let prices: Record<string, BigNumberJS>;
        const cachedPrices = await redisClient.get(cacheKey);
        if (cachedPrices) {
            prices = JSON.parse(cachedPrices);
        } else {
            prices = await getTokenPricing();
            await redisClient.set(cacheKey, JSON.stringify(prices), { EX: 300 }); // Cache for 5 minutes
        }

        const overrides = await getOverrides();

        await Promise.all(
            users.map(async (user: UserEntity) => {
                try {
                    // Remove the pool parameter from here
                    await run(() => handleDeposit(user, prices, overrides));
                } catch (error) {
                    console.error('Error handling deposit for user:', user.address, error);
                }
            })
        );
    } catch (error) {
        console.error('Error in handleDeposit cron job:', error);
    }
};

export default main;