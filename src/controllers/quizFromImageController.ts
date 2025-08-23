import { Request, Response } from "express";
import { extractTextFromScreenshot, extractTextFromCameraImage } from "../services/ocrService";
import { generateQuizFromText } from "../services/geminiService";
import Question from "../models/Question";
import Quiz from "../models/Quiz";
import { uploadToS3 } from "../services/s3Service";
import sharp from 'sharp';
import fs from 'fs';
import { promisify } from 'util';
const unlinkAsync = promisify(fs.unlink);
import { fileTypeFromFile } from 'file-type';
import { ApiResponse } from "../dto/ApiResponse";
import QuizAttempt from "../models/QuizAttempt";
import { Types } from "mongoose";
import { platform } from 'os';

export async function isScreenshotByExif(filePath: string): Promise<boolean> {
  try {
    // 1. Check file stats first
    const stats = await fs.promises.stat(filePath);
    if (stats.size < 12) { // Minimum size for image headers
      return false;
    }

    // 2. Read first few bytes to verify it's an image
    const fd = await fs.promises.open(filePath, 'r');
    try {
      const { buffer } = await fd.read(Buffer.alloc(12), 0, 12, 0);
      if (!buffer.slice(0, 4).toString('hex').match(/^(ffd8|8950|4749)/)) { // JPEG/PNG/GIF magic numbers
        return false;
      }
    } finally {
      await fd.close();
    }

    // 3. Only replace backslashes on Windows
    if (platform() === 'win32') {
      filePath = filePath.replace(/\\/g, '/'); // Replace all backslashes with forward slashes
    }

    // 4. Process with sharp
    const metadata = await sharp(filePath).metadata();
    return !metadata.exif;

  } catch (err) {
    console.error('Error checking image:', err);
    return false;
  }
}
export const quizFromImages = async (req: Request, res: Response) => {
  const filesToCleanup: string[] = [];

  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json(
        new ApiResponse(false, "No images provided")
      );
    }

    let combinedText = "";
    const files = req.files as Express.Multer.File[];
    let processedCount = 0;
    const extractionErrors: string[] = [];

    // Store file paths for cleanup
    files.forEach(file => {
      if (file.path) {
        filesToCleanup.push(file.path);
      }
    });

    // Process all images
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);
        
        // 1. Check image type
        // const isScreenshot = await isScreenshotByExif(file.path);
        const isScreenshot=false;
        console.log(`Is screenshot: ${isScreenshot}`);

        // 2. Upload to S3 (for camera images)
        let url = '';
        if (!isScreenshot) {
          url = await uploadToS3(
            file.path, 
            "krishnadas-test-1", 
            `quiz-images/${Date.now()}-${file.originalname}`
          );
          console.log(`Uploaded to: ${url}`);
        }

        // 3. Extract text
        let text = '';
        if (isScreenshot) {
          text = await extractTextFromScreenshot(file.path);
        } else {
          text = await extractTextFromCameraImage(url);
        }
        
        console.log(`Extracted text: ${text.substring(0, 50)}...`);
        
        if (text.trim()) {
          combinedText += "\n" + text;
          processedCount++;
        } else {
          extractionErrors.push(`No text found in ${file.originalname}`);
        }

      } catch (error: any) {
        const errorMsg = `Error processing ${file.originalname}: ${error.message}`;
        console.error(errorMsg);
        extractionErrors.push(errorMsg);
      }
    }

    // Check results
    if (processedCount === 0) {
      return res.status(400).json(
        new ApiResponse(false, "Could not extract text from any images", {
          errors: extractionErrors,
          debug: {
            totalFiles: files.length,
            processedCount
          }
        })
      );
    }

    // Generate quiz data
    console.log(`Combined text length: ${combinedText.length}`);
    const quizData = await generateQuizFromText(combinedText);

    // Save to database
    const questionDocs = await Question.insertMany(
      quizData.questions.map((q: any) => ({
        questionText: q.questionText,
        options: q.options,
        subject: q.subject,
        difficulty: q.difficulty,
        isPreviousYear: q.isPreviousYear,
        embedding: q.embedding || [],
        explanation: q.explanation
      }))
    );

    const quizDoc = new Quiz({
      title: quizData.quizTitle || "Generated Quiz",
      description: quizData.quizDescription || "Quiz generated from images",
      contextText: combinedText,
      contextEmbedding: [],
      questions: questionDocs.map(q => q._id),
      subject: quizData.subject || "biology",
      topic: quizData.topic || "General",
      difficulty: quizData.difficulty || "medium",
      isDailyQuiz: false
    });

    await quizDoc.save();

    // Clean up files after successful processing
    try {
      await Promise.all(filesToCleanup.map(filePath => 
        unlinkAsync(filePath).catch(e => console.error(`Error deleting ${filePath}:`, e))
      ));
      console.log('Temporary files cleaned up successfully');
    } catch (cleanupError) {
      console.error('Error during file cleanup:', cleanupError);
    }

    return res.status(200).json(
      new ApiResponse(true, "Quiz generated successfully", {
        quiz: await Quiz.findById(quizDoc._id).populate('questions'),
        debug: {
          processedImages: processedCount,
          errors: extractionErrors,
          filesCleaned: filesToCleanup.length
        }
      })
    );

  } catch (err: any) {
    // Attempt to clean up files even if there's an error
    try {
      await Promise.all(filesToCleanup.map(filePath => 
        unlinkAsync(filePath).catch(e => console.error(`Error deleting ${filePath}:`, e))
      ));
      console.log('Attempted to clean up temporary files after error');
    } catch (cleanupError) {
      console.error('Error during file cleanup after failure:', cleanupError);
    }

    console.error("Quiz generation error:", err);
    return res.status(500).json(
      new ApiResponse(false, "Failed to generate quiz", {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      })
    );
  }
};
// Add to quizFromImageController.ts
export const getQuizAttemptHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const attempts = await QuizAttempt.find({ user: userId })
      .populate({
        path: 'quiz',
        select: 'title subject topic difficulty createdAt'
      })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const totalAttempts = await QuizAttempt.countDocuments({ user: userId });

    res.status(200).json(
      new ApiResponse(true, "Quiz history retrieved", {
        attempts: attempts.map((attempt:any) => ({
          id: attempt._id,
          quiz: {
            id: attempt.quiz._id,
            title: attempt.quiz.title,
            subject: attempt.quiz.subject,
            topic: attempt.quiz.topic,
            difficulty: attempt.quiz.difficulty,
            createdAt: attempt.quiz.createdAt
          },
          score: attempt.totalScore,
          maxScore: attempt.totalPossibleScore,
          percentage: ((attempt.totalScore / attempt.totalPossibleScore) * 100).toFixed(2),
          correctAnswers: attempt.correctAnswers,
          wrongAnswers: attempt.wrongAnswers,
          skippedQuestions: attempt.skippedQuestions,
          timeTaken: attempt.timeTaken,
          completedAt: attempt.completedAt || attempt.createdAt
        })),
        pagination: {
          total: totalAttempts,
          page: Number(page),
          pages: Math.ceil(totalAttempts / Number(limit)),
          limit: Number(limit)
        }
      })
    );

  } catch (error: any) {
    res.status(500).json(
      new ApiResponse(false, "Failed to fetch quiz history", error.message)
    );
  }
};

export const saveQuizAttempt = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const userId = req.user._id;
    const { answers, timeTaken } = req.body;

    // Validate input
    if (!Array.isArray(answers)) {
      return res.status(400).json(
        new ApiResponse(false, "Answers must be an array")
      );
    }

    // Get the quiz with populated questions and their options
    const quiz = await Quiz.findById(quizId)
      .populate<{ 
        questions: Array<{
          _id: Types.ObjectId;
          questionText: string;
          options: Array<{
            _id: Types.ObjectId;
            text: string;
            isCorrect: boolean;
          }>;
        }>
      }>({
        path: 'questions',
        select: 'questionText options isPreviousYear difficulty subject'
      })
      .lean();

    if (!quiz) {
      return res.status(404).json(
        new ApiResponse(false, "Quiz not found")
      );
    }

    // Calculate scores (NEET style: +4 for correct, -1 for wrong)
    let totalScore = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let skippedQuestions = 0;
    const totalPossibleScore = quiz.questions.length * 4;

    const processedAnswers = await Promise.all(
      answers.map(async (answer: any) => {
        const question = quiz.questions.find(q => 
          q._id.toString() === answer.questionId
        );

        if (!question) {
          return null;
        }

        let points = 0;
        let isCorrect = false;
        let selectedOptionId = null;

        if (!answer.selectedOptionId) {
          skippedQuestions++;
        } else {
          selectedOptionId = answer.selectedOptionId;
          const correctOption = question.options.find(opt => opt.isCorrect);
          isCorrect = correctOption?._id.toString() === selectedOptionId;
          points = isCorrect ? 4 : -1;
          totalScore += points;

          if (isCorrect) correctAnswers++;
          else wrongAnswers++;
        }

        return {
          question: question._id.toString(), // Convert to string explicitly
          selectedOptionId,
          points,
          isCorrect
        };
      })
    );

    // Filter out null answers
    const validAnswers = processedAnswers.filter(a => a !== null) as Array<{
      question: string;
      selectedOptionId: Types.ObjectId;
      points: number;
      isCorrect: boolean;
    }>;

    // Save attempt
    const attempt = new QuizAttempt({
      user: userId,
      quiz: quizId,
      answers: validAnswers,
      totalScore,
      totalPossibleScore,
      correctAnswers,
      wrongAnswers,
      skippedQuestions,
      timeTaken
    });

    await attempt.save();

    res.status(200).json(
      new ApiResponse(true, "Quiz attempt saved", {
        attemptId: attempt._id,
        score: totalScore,
        correctAnswers,
        wrongAnswers,
        skippedQuestions,
        percentage: (totalScore / totalPossibleScore * 100).toFixed(2),
        timeTaken
      })
    );

  } catch (error: any) {
    res.status(500).json(
      new ApiResponse(false, "Failed to save quiz attempt", error.message)
    );
  }
};

// Get quiz results
export const getQuizResults = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const userId = req.user._id;

    // Get all attempts for this quiz by this user
    const attempts = await QuizAttempt.find({
      user: userId,
      quiz: quizId
    })
    .sort({ createdAt: -1 })
    .populate('quiz')
    .populate({
      path: 'answers.question',
      model: 'Question',
      select: 'questionText options explanation'
    })
    .lean();

    if (!attempts.length) {
      return res.status(404).json(
        new ApiResponse(false, "No attempts found for this quiz")
      );
    }

    // Get quiz details with questions
    const quiz = await Quiz.findById(quizId)
      .populate({
        path: 'questions',
        select: 'questionText options explanation'
      })
      .lean();

    // Format the response
    const formattedAttempts = attempts.map(attempt => {
      // Create a map of user answers for quick lookup
      const userAnswerMap = new Map();
      attempt.answers.forEach((answer: any) => {
        if (answer.question && answer.question._id) {
          userAnswerMap.set(answer.question._id.toString(), {
            selectedOptionId: answer.selectedOptionId, // This is the ObjectId
            points: answer.points
          });
        }
      });

      return {
        id: attempt._id,
        date: attempt.createdAt,
        totalQuestions: attempt.correctAnswers + attempt.wrongAnswers + attempt.skippedQuestions,
        correctAnswers: attempt.correctAnswers,
        incorrectAnswers: attempt.wrongAnswers,
        skippedQuestions: attempt.skippedQuestions,
        totalScore: attempt.totalScore,
        timeTaken: attempt.timeTaken,
        percentage: (attempt.totalScore / attempt.totalPossibleScore * 100).toFixed(2),
        questions: quiz?.questions.map((q: any) => {
          const userAnswer = userAnswerMap.get(q._id.toString());
          const correctOption = q.options.find((opt: any) => opt.isCorrect);
          
          // Determine user's answer text
          let userAnswerText = null;
          let isCorrect = false;
          
          if (userAnswer && userAnswer.selectedOptionId) {
            // Find the option that matches the selectedOptionId
            const selectedOption = q.options.find((opt: any) => 
              opt._id.toString() === userAnswer.selectedOptionId.toString()
            );
            
            if (selectedOption) {
              userAnswerText = selectedOption.text;
              isCorrect = selectedOption.isCorrect;
            }
          }
          // If userAnswer exists but selectedOptionId is null/undefined, it means skipped
          // If userAnswer doesn't exist, it also means skipped (shouldn't happen in normal flow)
          
          return {
            id: q._id,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: correctOption?.text || "Unknown",
            userAnswer: userAnswerText, // Will be null for skipped questions
            isCorrect: isCorrect,
            explanation: q.explanation
          };
        })
      };
    });

    res.status(200).json(
      new ApiResponse(true, "Quiz results retrieved", {
        quizTitle: quiz?.title,
        attempts: formattedAttempts
      })
    );

  } catch (error: any) {
    res.status(500).json(
      new ApiResponse(false, "Failed to get quiz results", error.message)
    );
  }
};
// Retake quiz (generates new questions from same context)
export const retakeQuiz = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const userId = req.user._id;

    // Get original quiz
    const originalQuiz = await Quiz.findById(quizId);
    if (!originalQuiz) {
      return res.status(404).json(
        new ApiResponse(false, "Original quiz not found")
      );
    }

    const context = `${originalQuiz.contextText} and dont include these qns ${originalQuiz.questions}`;
    
    // Generate new questions from same context text
    const quizData = await generateQuizFromText(context);

    // Save new questions
    const questionDocs = await Question.insertMany(
      quizData.questions.map((q: any) => ({
        questionText: q.questionText,
        options: q.options,
        subject: q.subject,
        difficulty: q.difficulty,
        isPreviousYear: q.isPreviousYear,
        embedding: q.embedding || [],
        explanation: q.explanation
      }))
    );

    // Create new quiz with same context but new questions
    const newQuiz = new Quiz({
      title: `${originalQuiz.title} (Retake)`,
      description: originalQuiz.description,
      contextText: originalQuiz.contextText,
      contextEmbedding: originalQuiz.contextEmbedding,
      questions: questionDocs.map(q => q._id),
      subject: originalQuiz.subject,
      topic: originalQuiz.topic,
      difficulty: originalQuiz.difficulty,
      isDailyQuiz: false,
      parentQuiz: quizId // Reference to original quiz
    });

    await newQuiz.save();

    return res.status(200).json(
      new ApiResponse(true, "Quiz retake generated successfully", {
        quiz: await Quiz.findById(newQuiz._id).populate('questions'),
        debug: {
          originalQuizId: quizId,
          newQuestionsCount: questionDocs.length,
          parentQuizReference: quizId
        }
      })
    );

  } catch (error: any) {
    console.error("Quiz retake generation error:", error);
    return res.status(500).json(
      new ApiResponse(false, "Failed to generate retake quiz", {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    );
  }
};