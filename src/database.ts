import { DataSource } from 'typeorm';
import { AppConfigEntity } from './utils/entities/appConfig.entity';
import { RefTransactionEntity } from './utils/entities/refTransaction.entity';
import { TokenRecordEntity } from './utils/entities/tokenRecord.entity';
import { TransactionEntity } from './utils/entities/transaction.entity';
import { USDCConfigEntity } from './utils/entities/usdcConfig.entity';
import { UserEntity } from './utils/entities/user.entity';
import { ValueRecordEntity } from './utils/entities/valueRecord.entity';
import { DB_CONFIG } from './utils/enviroments';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    username: DB_CONFIG.username,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
    entities: [
      AppConfigEntity,
      RefTransactionEntity,
      TokenRecordEntity,
      TransactionEntity,
      USDCConfigEntity,
      UserEntity,
      ValueRecordEntity
    ],
    synchronize: false,
    logging: ['error'],
    poolSize: 20
  });
  
  export async function initializeDataSource(): Promise<DataSource> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    return AppDataSource;
  }
  
  export async function closeDataSource(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
  
  export async function getRepository<T>(entityClass: new () => T) {
    const dataSource = await initializeDataSource();
    return dataSource.getRepository(entityClass);
  }
  
  export async function executeQuery(query: string, parameters: any[] = []): Promise<any> {
    const dataSource = await initializeDataSource();
    return dataSource.query(query, parameters);
  }