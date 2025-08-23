import Otp from '../models/Otp';
import crypto from 'crypto';

const OTP_EXPIRY_MINUTES = 5;

export const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

export const createOtpRecord = async (email: string) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  
  await Otp.updateMany(
    { email, isUsed: false },
    { $set: { isUsed: true } }
  );
  
  await Otp.create({ email, otp, expiresAt });
  return otp;
};

export const verifyOtp = async (email: string, otp: string) => {
  const otpRecord = await Otp.findOneAndUpdate(
    { 
      email, 
      otp, 
      isUsed: false,
      expiresAt: { $gt: new Date() } 
    },
    { $set: { isUsed: true } },
    { new: true }
  );
  
  return !!otpRecord;
};

export const isOtpRateLimited = async (email: string) => {
  const recentOtps = await Otp.countDocuments({
    email,
    createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
  });
  
  return recentOtps >= 3;
};