import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import quizFromImage from './quizFromImage';
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/quiz', quizFromImage);
export default router;