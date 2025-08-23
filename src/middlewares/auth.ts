import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: any;
}
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Please login to access this resource' });
    }

    const decoded: any = verifyAccessToken(token);
    const user = await User.findById(decoded.id);

    if (!user?._id) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = {
      ...user.toObject(),   // convert mongoose doc to plain object
      id: user._id.toString() // normalize id
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
  }
};
