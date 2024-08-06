import {
	constructSimpleSDK,
	SwapSide,
	OptimalRate,
	ContractMethod,
  } from "@paraswap/sdk";
  import BigNumber from "bignumber.js";
  import axios from "axios";
  import { Pool } from "@aave/contract-helpers";
  import { Token } from "../constants/tokens";
  import { provider } from "./provider";
  import { NETWORK } from ".";
  import { getIPoolAddress, getSwapperAddress } from "../constants/contracts";
  
  // Initialize the SDK
  const sdkConfig = {
	chainId: NETWORK,
	fetcher: axios,
  };
  
  const paraSwapSDK = constructSimpleSDK(sdkConfig);
  
  export const fetchExactInTxParams = async (
	tokenIn: Token,
	tokenOut: Token,
	amountIn: string,
	userAddress: string,
	max = false
  ) => {
	const options: any = {
	  partner: "aave",
	};
  
	if (max) {
	  options.excludeContractMethods = [ContractMethod.simpleSwap];
	}
  
	const priceRoute = await paraSwapSDK.swap.getRate({
	  srcToken: tokenIn.address,
	  destToken: tokenOut.address,
	  amount: new BigNumber(amountIn)
		.multipliedBy(new BigNumber(10).pow(tokenIn.decimals))
		.toFixed(0),
	  userAddress,
	  side: SwapSide.SELL,
	  options,
	});
  
	const swapParams = await paraSwapSDK.swap.buildTx({
	  srcToken: tokenIn.address,
	  destToken: tokenOut.address,
	  srcAmount: priceRoute.srcAmount,
	  destAmount: priceRoute.destAmount,
	  priceRoute,
	  userAddress,
	  partner: "aave",
	});
  
	return {
	  swapCallData: swapParams.data,
	  augustus: swapParams.to,
	  destAmountWithSlippage: new BigNumber(priceRoute.destAmount)
		.multipliedBy(0.99) // 1% slippage, adjust as needed
		.toFixed(0),
	};
  };
  
  export const swapCollateral = async (
	tokenInUnderlying: string,
	tokenInAToken: string,
	tokenOutUnderlying: string,
	amountIn: string,
	minAmountOut: string,
	userAddress: string,
	augustus: string,
	swapCallData: string,
	useFlashLoan: boolean,
	swapAll = false
  ) => {
	// Dynamically get the AAVE_POOL_ADDRESS and SWAP_COLLATERAL_ADAPTER
	const AAVE_POOL_ADDRESS = getIPoolAddress();
	const SWAP_COLLATERAL_ADAPTER = getSwapperAddress();
  
	// Initialize the Pool from AAVE SDK with the dynamic addresses
	const pool = new Pool(provider, {
	  POOL: AAVE_POOL_ADDRESS,
	  SWAP_COLLATERAL_ADAPTER: SWAP_COLLATERAL_ADAPTER,
	});
  
	return pool.swapCollateral({
	  fromAsset: tokenInUnderlying,
	  toAsset: tokenOutUnderlying,
	  swapAll,
	  fromAToken: tokenInAToken,
	  fromAmount: amountIn,
	  minToAmount: minAmountOut,
	  user: userAddress,
	  flash: useFlashLoan,
	  augustus,
	  swapCallData,
	});
  };
  
  export const ExactInSwapper = () => {
	const getRate = async (
	  amount: string,
	  srcToken: string,
	  srcDecimals: number,
	  destToken: string,
	  destDecimals: number,
	  userAddress: string,
	  options: any
	) => {
	  return paraSwapSDK.swap.getRate({
		srcToken,
		destToken,
		amount,
		userAddress,
		side: SwapSide.SELL,
		options,
	  });
	};
  
	const getTransactionParams = async (
	  srcToken: string,
	  srcDecimals: number,
	  destToken: string,
	  destDecimals: number,
	  user: string,
	  route: OptimalRate,
	  maxSlippage: number
	): Promise<{ swapCallData: string; augustus: string; destAmountWithSlippage: string }> => {
	  const destAmountWithSlippage = new BigNumber(route.destAmount)
		.multipliedBy(100 - maxSlippage)
		.dividedBy(100)
		.toFixed(0);
  
	  const swapParams = await paraSwapSDK.swap.buildTx({
		srcToken,
		destToken,
		srcAmount: route.srcAmount,
		destAmount: destAmountWithSlippage,
		priceRoute: route,
		userAddress: user,
		partner: "aave",
	  });
  
	  return {
		swapCallData: swapParams.data,
		augustus: swapParams.to,
		destAmountWithSlippage,
	  };
	};
  
	return {
	  getRate,
	  getTransactionParams,
	};
  };