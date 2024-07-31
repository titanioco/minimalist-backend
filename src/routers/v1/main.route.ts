import { getNonce, getUsers } from "controllers/user.controllers";

import express from "express";

const mainRouteV1 = express.Router();

mainRouteV1.get("/nonce/:address", getNonce);
mainRouteV1.get("/users", getUsers);

// mainRouteV1.get("/handle_transactions", handleTransactions);
// mainRouteV1.get("/handle_deposit", handleDeposit);
// mainRouteV1.get("/handle_swap", handleSwap);
// mainRouteV1.get("/handle_hf", handleHF);

export { mainRouteV1 };
