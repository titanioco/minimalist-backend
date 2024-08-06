import {
	constructSimpleSDK,
	SwapSide,
	OptimalRate,
	Address,
	SimpleFetchSDK,
	ContractMethod,
  } from "@paraswap/sdk";
  import { ethers } from "ethers";
  import axios from "axios";
  import BigNumber from "bignumber.js";
  import { Pool } from "@aave/contract-helpers";
  
  import { getParaSwapProvider } from "./ethersWrapper";
  import { provider } from "./provider";
  import { NETWORK } from ".";
  import { Token } from "../constants/tokens";
  
  // Initialize the SDK config
  const sdkConfig = {
	chainId: NETWORK,
	fetcher: axios,
	// Add any other necessary options, like apiKey if you have one
	// apiKey: 'YOUR_API_KEY',
  };
  
  // Function to construct the SDK
  const constructSDK = () => constructSimpleSDK(sdkConfig);
  
  // Initialize the SDK
  let paraSwapSDK: SimpleFetchSDK = constructSDK();
  
  // ExactInSwapper equivalent using the new SDK
  const ExactInSwapper = () => {
	const getRate = async (
	  amount: string,
	  srcToken: string,
	  srcDecimals: number,
	  destToken: string,
	  destDecimals: number,
	  userAddress: string,
	  options: any
	) => {
	  try {
		const priceRoute = await paraSwapSDK.swap.getRate({
		  srcToken,
		  destToken,
		  amount,
		  userAddress,
		  side: SwapSide.SELL,
		  options,
		});
		return priceRoute;
	  } catch (e) {
		console.error("Error getting rate:", e);
		throw e;
	  }
	};
  
	const getTransactionParams = async (
	  srcToken: string,
	  srcDecimals: number,
	  destToken: string,
	  destDecimals: number,
	  user: string,
	  route: OptimalRate,
	  maxSlippage: number
	) => {
	  const destAmountWithSlippage = new BigNumber(route.destAmount)
		.multipliedBy(100 - maxSlippage)
		.dividedBy(100)
		.toFixed(0);
  
	  try {
		const txParams = await paraSwapSDK.swap.buildTx({
		  srcToken,
		  destToken,
		  srcAmount: route.srcAmount,
		  destAmount: destAmountWithSlippage,
		  priceRoute: route,
		  userAddress: user,
		  partner: "aave",
		});
  
		return {
		  swapCallData: txParams.data,
		  augustus: txParams.to,
		  destAmountWithSlippage,
		};
	  } catch (e) {
		console.error("Error building transaction parameters:", e);
		throw new Error("Error building transaction parameters");
	  }
	};
  
	return {
	  getRate,
	  getTransactionParams,
	};
  };
  
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
	const swapper = ExactInSwapper();
	const route = await swapper.getRate(
	  new BigNumber(amountIn)
		.multipliedBy(new BigNumber(10).pow(tokenIn.decimals))
		.toFixed(0),
	  tokenIn.address,
	  tokenIn.decimals,
	  tokenOut.address,
	  tokenOut.decimals,
	  userAddress,
	  options
	);
	return await swapper.getTransactionParams(
	  tokenIn.address,
	  tokenIn.decimals,
	  tokenOut.address,
	  tokenOut.decimals,
	  userAddress,
	  route,
	  1
	);
  };
  
  export const swapCollateral = (
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
	const pool = getCorrectPool();
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
  
  const getCorrectPool = () => {
	const currentMarketData = {
	  COLLECTOR: "0xe8599F3cc5D38a9aD6F3684cd5CEa72f10Dbc383",
	  LENDING_POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
	  LENDING_POOL_ADDRESS_PROVIDER: "0xa97684ead0e402dc232d5a977953df7ecbab3cdb",
	  REPAY_WITH_COLLATERAL_ADAPTER: "0xA125561fca253f19eA93970534Bb0364ea74187a",
	  SWAP_COLLATERAL_ADAPTER: "0x301F221bc732907E2da2dbBFaA8F8F6847c170c3",
	  UI_INCENTIVE_DATA_PROVIDER: "0xF43EfC9789736BaF550DC016C7389210c43e7997",
	  UI_POOL_DATA_PROVIDER: "0x7006e5a16E449123a3F26920746d03337ff37340",
	  WALLET_BALANCE_PROVIDER: "0xBc790382B3686abffE4be14A030A96aC6154023a",
	  WETH_GATEWAY: "0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c",
	};
	return new Pool(provider, {
	  POOL: currentMarketData.LENDING_POOL,
	  REPAY_WITH_COLLATERAL_ADAPTER: currentMarketData.REPAY_WITH_COLLATERAL_ADAPTER,
	  SWAP_COLLATERAL_ADAPTER: currentMarketData.SWAP_COLLATERAL_ADAPTER,
	  WETH_GATEWAY: currentMarketData.WETH_GATEWAY,
	});
  };
  
  // Additional functions from the new implementation
  export const getRate = async (
	srcToken: string,
	destToken: string,
	amount: string,
	userAddress: Address,
	side: SwapSide = SwapSide.SELL
  ) => {
	try {
	  const priceRoute = await paraSwapSDK.swap.getRate({
		srcToken,
		destToken,
		amount,
		userAddress,
		side,
	  });
	  return priceRoute;
	} catch (e) {
	  console.error("Error getting rate:", e);
	  throw e;
	}
  };
  
  export const buildTxForSwap = async (
	srcToken: string,
	destToken: string,
	srcAmount: string,
	destAmount: string,
	priceRoute: OptimalRate,
	userAddress: Address,
	receiver: Address
  ) => {
	try {
	  const txParams = await paraSwapSDK.swap.buildTx({
		srcToken,
		destToken,
		srcAmount,
		destAmount,
		priceRoute,
		userAddress,
		receiver,
	  });
	  return txParams;
	} catch (e) {
	  console.error("Error building transaction:", e);
	  throw e;
	}
  };
  
  // Function to get the current provider
  export const getCurrentProvider = () => provider;
  
  // Export the SDK instance
  export { paraSwapSDK };