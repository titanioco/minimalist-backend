import "dotenv/config";
import "reflect-metadata";
import { createConnection, getConnectionManager } from "typeorm";
import { Connection } from "typeorm/connection/Connection";
import { AppConfigEntity } from "./entities/appConfig.entity";
import { USDCConfigEntity } from "./entities/usdcConfig.entity";
import { UserEntity } from "./entities/user.entity";
import { TransactionEntity } from "./entities/transaction.entity";
import { RefTransactionEntity } from "./entities/refTransaction.entity";
import { ValueRecordEntity } from "./entities/valueRecord.entity";
import { TokenRecordEntity } from "./entities/tokenRecord.entity";

export const getConnection = async (connectionName = "default") => {
	let connection: Connection;
	const connectionManager = getConnectionManager();
	const hasConnection = connectionManager.has(connectionName);
	if (hasConnection) {
		connection = connectionManager.get(connectionName);
		if (!connection.isConnected) {
			connection = await connection.connect();
		}
	} else {
		connection = await createConnection({
			type: "postgres",
			port: 5432,
			name: connectionName,
			host: process.env.DB_HOST,
			database: process.env.DB_NAME,
			username: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			synchronize: true,
			logging: false,
			entities: [
				AppConfigEntity,
				USDCConfigEntity,
				UserEntity,
				TransactionEntity,
				RefTransactionEntity,
				ValueRecordEntity,
				TokenRecordEntity,
			],
		});
	}
	return connection;
};
