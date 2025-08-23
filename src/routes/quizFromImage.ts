import { Router } from "express";
import { upload } from "../configs/multerConfig";
import { 
  quizFromImages,
  saveQuizAttempt,
  getQuizResults,
  retakeQuiz
} from "../controllers/quizFromImageController";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Quiz generation (authenticated users only)
router.post(
  "/generate-quiz-from-images", 
  authenticate,
  upload.array("images", 10), 
  quizFromImages
);

// Quiz attempt tracking
router.post(
  "/:quizId/attempt",
  authenticate,
  saveQuizAttempt
);

// Get quiz results
router.get(
  "/:quizId/results",
  authenticate,
  getQuizResults
);

// Retake quiz
router.post(
  "/:quizId/retake",
  authenticate,
  retakeQuiz
);

export default router;