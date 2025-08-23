import { Request, Response } from 'express';
import User from '../models/User';
import { createOtpRecord, verifyOtp, isOtpRateLimited } from '../services/otpService';
import { sendEmail } from '../services/emailService';
import { generateAccessToken, generateRefreshToken } from '../services/authService';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../dto/ApiResponse';
import Otp from '../models/Otp';

/**
 * Send OTP
 */
export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Email is required"));
    }

    if (await isOtpRateLimited(email)) {
      return res
        .status(429)
        .json(
          new ApiResponse(
            false,
            "Too many OTP requests. Please try again later."
          )
        );
    }

    const otp = await createOtpRecord(email);

    await sendEmail({
      to: email,
      subject: "Your NEET Prep App OTP",
      html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color:#f8f9fb; padding:40px; margin:0; color:#333;">
        <div style="max-width:520px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background:#759ED1; padding:20px; text-align:center;">
            <h2 style="margin:0; font-size:22px; color:#ffffff;">NEET Preparation App</h2>
          </div>
    
          <!-- Body -->
          <div style="padding:30px; text-align:center;">
            <p style="font-size:16px; margin:0 0 15px;">Hello,</p>
            <p style="font-size:16px; margin:0 0 25px;">Use the following OTP to complete your login:</p>
            
            <!-- OTP Box -->
            <div style="display:inline-block; background:#759ED1; color:#ffffff; font-size:26px; font-weight:bold; letter-spacing:4px; padding:12px 30px; border-radius:8px; margin-bottom:25px;">
              ${otp}
            </div>
            
            <p style="font-size:14px; color:#555;">This OTP is valid for <strong>5 minutes</strong>.  
            If you did not request it, please ignore this email.</p>
          </div>
    
          <!-- Footer -->
          <div style="background:#f1f4f9; padding:15px; text-align:center; font-size:12px; color:#888;">
            © ${new Date().getFullYear()} NEET Preparation App. All rights reserved.
          </div>
        </div>
      </div>
      `,
    });
    
    
    console.log("OTP sent successfully:", otp);
    return res
      .status(200)
      .json(new ApiResponse(true, "OTP sent successfully"));
  } catch (error: any) {
    console.error("sendOtp error:", error.message);
    return res
      .status(500)
      .json(new ApiResponse(false, "Failed to send OTP"));
  }
};

/**
 * Verify OTP & Login
 */
export const verifyOtpAndLogin = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Email and OTP are required"));
    }

    const isOtpValid = await verifyOtp(email, otp);
    if (!isOtpValid) {
      return res
        .status(400)
        .json(new ApiResponse(false, "Invalid or expired OTP"));
    }
    console.log("OTP verified successfully");
    
    let user = await User.findOne({ email });

    if (!user) {
      // New user
      user = new User({
        email,
        isVerified: true,
        isProfileComplete: false,
      });
    } else {
      // Existing user
      user.isVerified = true;
    }

    await user.save();

    // Check profile completion using schema method
    let profileComplete = user.isProfileComplete;
    if (
      !profileComplete &&
      typeof (user as any).checkProfileCompletion === "function"
    ) {
      profileComplete = (user as any).checkProfileCompletion();
      if (profileComplete) {
        user.isProfileComplete = true;
        await user.save();
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(200).json(
      new ApiResponse(true, "Login successful", {
        accessToken,
        refreshToken,
        profileComplete,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
        },
        isProfileComplete: profileComplete,
      })
    );
  } catch (error: any) {
    console.error("verifyOtpAndLogin error:", error.message, error.stack);
    return res
      .status(500)
      .json(new ApiResponse(false, "Login failed", error.message));
  }
};

/**
 * Get Current User
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById((req as any).user.id)
      .select('-__v -previousNeetScore -interestedColleges -neetYear -hasAttendedNeetBefore');

    if (!user) {
      return res.status(404).json(new ApiResponse(false, 'User not found'));
    }

    res.status(200).json(new ApiResponse(true, 'User fetched successfully', user));
  } catch (error: any) {
    res.status(500).json(new ApiResponse(false, 'Failed to fetch user', undefined));
  }
};

/**
 * Refresh Access Token
 */
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json(new ApiResponse(false, 'Refresh token required'));
    }

    // Hardcoded secrets
    const ACCESS_TOKEN_SECRET = "aju_access";
    const REFRESH_TOKEN_SECRET = "aju_refresh";

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, async (err: any, decoded: any) => {
      if (err) {
        console.log("Refresh token verification failed:", err);
        return res.status(401).json(new ApiResponse(false, 'Invalid refresh token'));
      }

      // Simple payload check
      if (!decoded.id) {
        return res.status(401).json(new ApiResponse(false, 'Invalid token payload'));
      }

      // Find user - keep this simple for testing
      const user = await User.findById(decoded.id).select('_id email name');
      if (!user) {
        return res.status(404).json(new ApiResponse(false, 'User not found'));
      }

      // Generate new access token (valid for 15 minutes)
      const accessToken = generateAccessToken(user);

      // Return response matching your login endpoint
      return res.status(200).json(
        new ApiResponse(true, 'Access token refreshed', { 
          accessToken: accessToken,
          user: {
            _id: user._id,
            email: user.email,
            name: user.name
          }
        })
      );
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(500).json(new ApiResponse(false, 'Failed to refresh token'));
  }
};
