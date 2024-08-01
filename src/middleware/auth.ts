import { NextFunction, Request, Response } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { getAddress, isAddress } from 'ethers';
import { UserEntity } from '../utils/entities/user.entity';
import httpStatus from '../utils/types/httpStatus';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = '1d';

export const generateToken = (userAddress: string): string => {
    return jwt.sign({ address: userAddress }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const verifyToken = (token: string): string | object => {
    return jwt.verify(token, JWT_SECRET);
};

// Rate limiting middleware
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(httpStatus.Unauthorized).json({ error: 'No token provided' });
        }

        const decoded = verifyToken(token) as { address: string };
        const user = await UserEntity.createQueryBuilder("user")
            .where("user.address = :address", { address: getAddress(decoded.address) })
            .getOne();

        if (!user) {
            return res.status(httpStatus.Unauthorized).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(httpStatus.Unauthorized).json({ error: 'Invalid token' });
        }
        return res.status(httpStatus.InternalServerError).json({ error: 'An error occurred during authentication' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { address, signature } = req.body;

    if (!address || !isAddress(address) || !signature) {
        return res.status(httpStatus.BadRequest).json({ error: 'Missing or invalid parameters' });
    }

    const user = await UserEntity.createQueryBuilder("user")
        .where("user.address = :address", { address: getAddress(address) })
        .getOne();

    if (!user) {
        return res.status(httpStatus.Unauthorized).json({ error: 'User not found' });
    }

    try {
        const recoveredAddress = ethers.verifyMessage(user.nonce.toString(), signature);
        if (getAddress(address) !== getAddress(recoveredAddress)) {
            return res.status(httpStatus.Unauthorized).json({ error: 'Invalid signature' });
        }

        user.nonce = Math.floor(Math.random() * 1000000);
        await user.save();

        const token = generateToken(address);
        return res.json({ token });
    } catch (error) {
        return res.status(httpStatus.InternalServerError).json({ error: 'An error occurred during login' });
    }
};

export default auth;