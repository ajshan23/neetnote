import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import quizFromImage from './quizFromImage';
import feedRoutes from './feedRoutes';
import dailyTaskRoutes from './dailyTaskRoutes';
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/quiz', quizFromImage);
router.use('/feed', feedRoutes);
router.use("/daily-task",dailyTaskRoutes);
export default router;