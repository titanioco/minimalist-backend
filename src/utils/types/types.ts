import HttpStatus from './httpStatus';

export const enum ChainId {
    POLYGON = 137,
    FTM_TESTNET = 4002,
}

export type TransactionStatus = 'pending' | 'success' | 'fail';

export const enum TransactionType {
    DEPOSIT_REF = "DEPOSIT_REFERRAL",
    SWAP_REF = "SWAP_REFERRAL",
}

export type TokenRecordType = 'deposit' | 'withdraw';

// Custom error class
export class AppError extends Error {
    constructor(public status: HttpStatus, message: string) {
        super(message);
        this.name = 'AppError';
    }
}

// Branded types for IDs
type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type TransactionId = Brand<string, 'TransactionId'>;

// Type guards
export const isTransactionStatus = (status: any): status is TransactionStatus => {
    return ['pending', 'success', 'fail'].includes(status);
};

export const isTokenRecordType = (type: any): type is TokenRecordType => {
    return ['deposit', 'withdraw'].includes(type);
};

// Helper function to create branded types
export const createUserId = (id: string): UserId => id as UserId;
export const createTransactionId = (id: string): TransactionId => id as TransactionId;