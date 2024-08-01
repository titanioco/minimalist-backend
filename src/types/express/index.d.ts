import * as express from 'express';
import { UserEntity } from '../../utils/entities/user.entity';

declare global {
    namespace Express {
        interface Request {
            user?: UserEntity;
        }
    }
}

export = express;