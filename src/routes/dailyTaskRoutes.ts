import { Router } from 'express';
import { 
  getAvailableDailyChallenges,
  startDailyChallenge,
  getUserDailyChallengeHistory,
  getCombinedQuizHistory,
  createDailyChallengeManual,
  generateDailyChallengeAI,
  getAllDailyChallenges,
  updateDailyChallenge,
  deleteDailyChallenge
} from '../controllers/dailyTaskController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Public routes (for users)
router.get('/available', authenticate, getAvailableDailyChallenges);

router.get('/history', authenticate, getUserDailyChallengeHistory);
router.get('/quiz-history', authenticate, getCombinedQuizHistory);

// Admin routes
router.post('/admin/create-manual', authenticate, createDailyChallengeManual);
router.post('/admin/generate-ai', authenticate, generateDailyChallengeAI);
router.get('/admin/all', authenticate, getAllDailyChallenges);
router.put('/admin/:dailyTaskId', authenticate, updateDailyChallenge);
router.delete('/admin/:dailyTaskId', authenticate, deleteDailyChallenge);
router.post('/:dailyTaskId/start', authenticate, startDailyChallenge);
export default router;