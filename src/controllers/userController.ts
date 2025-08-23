import { Request, Response } from 'express';
import User from '../models/User';
import { ApiResponse } from '../dto/ApiResponse';
import mongoose from 'mongoose';

export const completeProfile = async (req: Request, res: Response) => {
  try {
    const { name, mobile, neetYear, hasAttendedNeetBefore, previousNeetScore, interestedColleges } = req.body;

    // 1️⃣ Basic validations (before DB hit)
    if (!name || !mobile || !neetYear || hasAttendedNeetBefore === undefined) {
      return res.status(400).json(new ApiResponse(false, "Missing required fields"));
    }

    // 2️⃣ Mobile validation (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json(new ApiResponse(false, "Invalid mobile number (10 digits required)"));
    }

    // 3️⃣ NEET year validation (within allowed range)
    const currentYear = new Date().getFullYear();
    if (neetYear < currentYear || neetYear > currentYear + 5) {
      return res.status(400).json(new ApiResponse(false, `neetYear must be between ${currentYear} and ${currentYear + 5}`));
    }

    // 4️⃣ Previous score validation
    if (hasAttendedNeetBefore) {
      if (previousNeetScore === undefined || previousNeetScore < 0 || previousNeetScore > 720) {
        return res.status(400).json(new ApiResponse(false, "Previous NEET score is required and must be between 0–720"));
      }
    }

    // 5️⃣ Interested colleges validation
    if (interestedColleges && interestedColleges.length > 5) {
      return res.status(400).json(new ApiResponse(false, "You can select up to 5 colleges only"));
    }

    // 6️⃣ Update user
    const user = await User.findByIdAndUpdate(
      new mongoose.Types.ObjectId((req as any).user._id), // from authenticate middleware
      {
        name,
        mobile,
        neetYear,
        hasAttendedNeetBefore,
        previousNeetScore,
        interestedColleges,
        isProfileComplete: true
      },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!user) {
      return res.status(404).json(new ApiResponse(false, "User not found"));
    }

    // 7️⃣ Success response
    return res.status(200).json(
      new ApiResponse(true, "Profile completed successfully", user)
    );

  } catch (error: any) {
    console.error("Error completing profile:", error.message);
    return res.status(500).json(new ApiResponse(false, "Failed to complete profile", error.message));
  }
};

export const getProfileStatus = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id).select('isProfileComplete');

    if (!user) {
      return res.status(404).json(new ApiResponse(false, 'User not found'));
    }

    res.status(200).json(new ApiResponse(true, 'Profile status fetched successfully', { isProfileComplete: user.isProfileComplete }));
  } catch (error: any) {
    res.status(500).json(new ApiResponse(false, 'Failed to get profile status', undefined));
  }
};
