export const calculateETHAndBTCSwapped = (transactions: any[]) => {
	let totalSwappedUSDCtoWETH = 0;
	let totalSwappedUSDCtoWBTC = 0;

	transactions.forEach((transaction) => {
		transaction.descriptions.forEach((description: any) => {
			if (description.includes("Swapped") && description.includes("USDC to WETH")) {
				const amount = parseFloat(description.split(" ")[1]);
				totalSwappedUSDCtoWETH += amount;
			}
			if (description.includes("Swapped") && description.includes("USDC to WBTC")) {
				const amount = parseFloat(description.split(" ")[1]);
				totalSwappedUSDCtoWBTC += amount;
			}
		});
	});

	return {
		totalSwappedUSDCtoWETH,
		totalSwappedUSDCtoWBTC,
	};
};
