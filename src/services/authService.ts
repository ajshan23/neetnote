import jwt from 'jsonwebtoken';
import config from '../configs/env';

const ACCESS_TOKEN_SECRET = config.JWT_SECRET || 'aju_access';
const REFRESH_TOKEN_SECRET = config.JWT_REFRESH_SECRET || 'aju_refresh';

export const generateAccessToken = (user: any) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' } // short expiry
  );
};

export const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // longer expiry
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
