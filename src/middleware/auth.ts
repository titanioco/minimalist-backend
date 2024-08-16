import { ethers } from "ethers";
import { getAddress, isAddress } from "ethers/lib/utils";
import { UserEntity } from "../utils/entities/user.entity";
import { getConnection } from "../utils/postgresql";
import { NextFunction, Request, Response } from "express-serve-static-core";
import httpStatus from "../utils/types/httpStatus";

const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await getConnection();
        const body = req.body || {};
        let userAddress: string = body?.address as string;
        const signature: string = body?.signature as string;
        if (!userAddress) {
            userAddress = req.params.address as string;
        }
        if (!userAddress || !isAddress(userAddress) || !signature) {
            return res.status(httpStatus.BadRequest).json({
                error: "Missing parameters",
            });
        }
        const user = await UserEntity.findOne({
            where: { address: getAddress(userAddress) }
        });
        if (!user) {
            return res.status(httpStatus.Unauthorized).json({
                error: "User not found",
            });
        }
        const decodedAddress = ethers.utils.verifyMessage(String(user.nonce), signature);
        if (getAddress(userAddress) !== decodedAddress) {
            return res.status(httpStatus.Unauthorized).json({
                error: "Unauthorized",
            });
        }
        // Update nonce
        user.nonce++;
        await user.save();

        // Attach the user to the request object
        (req as any).user = user;

        next();
    } catch (error) {
        if (error instanceof Error) {
            return res.status(httpStatus.BadRequest).json({
                error: error.message,
            });
        }
    }
};

export default auth;