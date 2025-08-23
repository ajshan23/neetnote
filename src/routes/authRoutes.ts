import { Router } from 'express';
import { sendOtp, verifyOtpAndLogin, getCurrentUser, refreshAccessToken } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtpAndLogin);
router.post('/refresh-token', refreshAccessToken);
router.get('/me', authenticate, getCurrentUser);

export default router;
