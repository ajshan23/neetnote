import { Router } from 'express';
import { completeProfile, getProfileStatus } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/complete-profile', authenticate, completeProfile);
router.get('/profile-status', authenticate, getProfileStatus);

export default router;