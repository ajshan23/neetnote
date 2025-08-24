import { Request, Response } from 'express';
import DailyTask, { IDailyTask, Subject } from '../models/DailyTask';
import QuizAttempt from '../models/QuizAttempt';
import Quiz from '../models/Quiz';
import Question from '../models/Question';
import { generateDailyChallengeContext, generateQuizFromText } from '../services/geminiService';
import { ApiResponse } from '../dto/ApiResponse';
import { Types } from 'mongoose';

/**
 * Get available daily challenges for user (not attempted yet)
 */
export const getAvailableDailyChallenges = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all active daily tasks for today
    const dailyTasks = await DailyTask.find({
      date: today,
      isActive: true
    });
    
    // Get user's already attempted daily challenges
    const userAttempts = await QuizAttempt.find({
      user: userId,
      dailyTaskRef: { $in: dailyTasks.map(task => task._id) }
    });
    
    const attemptedDailyTaskIds = new Set(
      userAttempts.map(attempt => attempt.dailyTaskRef?.toString())
    );
    
    // Filter out attempted tasks
    const availableTasks = dailyTasks.filter((task: IDailyTask) =>
        !attemptedDailyTaskIds.has((task._id as any).toString())
      );
      
    
    res.status(200).json(
      new ApiResponse(true, 'Available daily challenges fetched successfully', {
        challenges: availableTasks.map(task => ({
          id: task._id,
          title: task.title, // Include title
          date: task.date,
          subject: task.subject,
          contextPreview: task.contextText.substring(0, 100) + '...',
          isAiGenerated: task.isAiGenerated,
          createdBy: task.createdBy
        })),
        total: availableTasks.length
      })
    );
  } catch (error: any) {
    console.error('Get available daily challenges error:', error);
    res.status(500).json(
      new ApiResponse(false, 'Failed to fetch available daily challenges')
    );
  }
};

/**
 * Start a daily challenge - Generate unique quiz for user
 */
export const startDailyChallenge = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { dailyTaskId } = req.params;
    
    // Check if daily task exists
    const dailyTask = await DailyTask.findById(dailyTaskId);
    if (!dailyTask) {
      return res.status(404).json(
        new ApiResponse(false, 'Daily challenge not found')
      );
    }
    
    // Check if user already attempted this daily task
    const existingAttempt = await Quiz.findOne({
      user: userId,
      dailyTaskRef: dailyTaskId
    });
    
    if (existingAttempt) {
      return res.status(400).json(
        new ApiResponse(false, 'You have already attempted this daily challenge', {
        
        })
      );
    }
    
    // Generate unique quiz for this user using the daily task context
    const quizData = await generateQuizFromText(dailyTask.contextText);
    
    // Save questions
    const questionDocs = await Question.insertMany(
      quizData.questions.map((q: any) => ({
        questionText: q.questionText,
        options: q.options,
        subject: dailyTask.subject,
        difficulty: q.difficulty,
        isPreviousYear: q.isPreviousYear,
        embedding: q.embedding || [],
        explanation: q.explanation
      }))
    );
    
    // Save quiz
    const quizDoc = new Quiz({
      title: dailyTask.title || `${dailyTask.subject.toUpperCase()} Daily Challenge - ${new Date().toLocaleDateString()}`,
      description: `Daily challenge for ${dailyTask.subject}`,
      contextText: dailyTask.contextText,
      contextEmbedding: dailyTask.contextEmbedding,
      questions: questionDocs.map(q => q._id),
      subject: dailyTask.subject,
      topic: 'Daily Challenge',
      difficulty: 'medium',
      isDailyQuiz: true,
      dailyTaskRef:dailyTaskId
    });
    
    await quizDoc.save();
    
    await quizDoc.populate('questions');
    
    res.status(200).json(
      new ApiResponse(true, 'Daily challenge started successfully', {
        quiz: quizDoc,
        dailyTask: {
          id: dailyTask._id,
          title: dailyTask.title,
          subject: dailyTask.subject
        }
      })
    );
  } catch (error: any) {
    console.error('Start daily challenge error:', error);
    res.status(500).json(
      new ApiResponse(false, 'Failed to start daily challenge')
    );
  }
};

/**
 * Get user's daily challenge history (using QuizAttempt)
 */
export const getUserDailyChallengeHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    // Get quiz attempts that have dailyTaskRef (daily challenges)
    const attempts = await QuizAttempt.find({ 
      user: userId, 
      dailyTaskRef: { $exists: true, $ne: null } 
    })
      .populate({
        path: 'dailyTaskRef',
        select: 'title subject date contextText isAiGenerated'
      })
      .populate({
        path: 'quiz',
        select: 'title subject difficulty'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await QuizAttempt.countDocuments({ 
      user: userId, 
      dailyTaskRef: { $exists: true, $ne: null } 
    });
    
    res.status(200).json(
      new ApiResponse(true, 'Daily challenge history fetched successfully', {
        challenges: attempts.map(attempt => ({
          id: attempt._id,
          dailyTask: attempt.dailyTaskRef,
          quiz: attempt.quiz,
          isCompleted: !!attempt.completedAt,
          score: attempt.totalScore,
          maxScore: attempt.totalPossibleScore,
          percentage: attempt.totalScore && attempt.totalPossibleScore ? 
            ((attempt.totalScore / attempt.totalPossibleScore) * 100).toFixed(2) : null,
          correctAnswers: attempt.correctAnswers,
          wrongAnswers: attempt.wrongAnswers,
          skippedQuestions: attempt.skippedQuestions,
          timeTaken: attempt.timeTaken,
          startedAt: attempt.createdAt,
          completedAt: attempt.completedAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      })
    );
  } catch (error: any) {
    console.error('Get daily challenge history error:', error);
    res.status(500).json(
      new ApiResponse(false, 'Failed to fetch daily challenge history')
    );
  }
};

/**
 * Get combined quiz history (both regular quizzes and daily challenges)
 */
export const getCombinedQuizHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { page = 1, limit = 10, type } = req.query; // type: 'all', 'daily', 'regular'
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build query based on type filter
    let query: any = { user: userId };
    
    if (type === 'daily') {
      query.dailyTaskRef = { $exists: true, $ne: null };
    } else if (type === 'regular') {
      query.dailyTaskRef = { $exists: false };
    }
    
    const attempts = await QuizAttempt.find(query)
      .populate({
        path: 'dailyTaskRef',
        select: 'title subject',
        options: { retainNullValues: true }
      })
      .populate({
        path: 'quiz',
        select: 'title subject difficulty createdAt',
        options: { retainNullValues: true }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await QuizAttempt.countDocuments(query);
    
    res.status(200).json(
      new ApiResponse(true, 'Quiz history fetched successfully', {
        attempts: attempts.map(attempt => ({
          id: attempt._id,
          type: attempt.dailyTaskRef ? 'daily' : 'regular',
          dailyTask: attempt.dailyTaskRef,
          quiz: attempt.quiz,
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
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      })
    );
  } catch (error: any) {
    res.status(500).json(
      new ApiResponse(false, "Failed to fetch quiz history", error.message)
    );
  }
};

export const createDailyChallengeManual = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user._id;
      const { title, date, subject, contextText, isAiGenerated = false } = req.body;
      
      // Validation
      if (!title || !date || !subject || !contextText) {
        return res.status(400).json(
          new ApiResponse(false, 'Title, date, subject, and contextText are required')
        );
      }
      
      if (!Object.values(Subject).includes(subject)) {
        return res.status(400).json(
          new ApiResponse(false, 'Invalid subject. Must be physics, chemistry, or biology')
        );
      }
      
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      // Check if daily task already exists for this date and subject
      const existingTask = await DailyTask.findOne({
        date: targetDate,
        subject,
        isActive: true
      });
      
      if (existingTask) {
        return res.status(400).json(
          new ApiResponse(false, 'A daily challenge already exists for this date and subject')
        );
      }
      
      // Create embedding (you might want to generate this properly)
      const contextEmbedding = Array(768).fill(0); // Placeholder embedding
      
      // Create daily task
      const dailyTask = new DailyTask({
        title,
        date: targetDate,
        subject,
        contextText,
        contextEmbedding,
        isAiGenerated,
        createdBy: userId
      });
      
      await dailyTask.save();
      
      res.status(201).json(
        new ApiResponse(true, 'Daily challenge created successfully', {
          dailyTask: {
            id: dailyTask._id,
            title: dailyTask.title,
            date: dailyTask.date,
            subject: dailyTask.subject,
            contextPreview: dailyTask.contextText.substring(0, 100) + '...',
            isAiGenerated: dailyTask.isAiGenerated
          }
        })
      );
    } catch (error: any) {
      console.error('Create daily challenge error:', error);
      res.status(500).json(
        new ApiResponse(false, 'Failed to create daily challenge')
      );
    }
  };
  
  /**
   * Generate daily challenge using AI (Admin only or automated)
   */
  export const generateDailyChallengeAI = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user._id;
      const { subject, date } = req.body;
      
      // Validation
      if (!subject || !date) {
        return res.status(400).json(
          new ApiResponse(false, 'Subject and date are required')
        );
      }
      
      if (!Object.values(Subject).includes(subject)) {
        return res.status(400).json(
          new ApiResponse(false, 'Invalid subject. Must be physics, chemistry, or biology')
        );
      }
      
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      // Check if daily task already exists for this date and subject
      const existingTask = await DailyTask.findOne({
        date: targetDate,
        subject,
        isActive: true
      });
      
      if (existingTask) {
        return res.status(400).json(
          new ApiResponse(false, 'A daily challenge already exists for this date and subject')
        );
      }
      
      // Generate context using AI
      const contextText = await generateDailyChallengeContext(subject);
      
      if (!contextText) {
        return res.status(500).json(
          new ApiResponse(false, 'Failed to generate context using AI')
        );
      }
      
      // Create embedding (placeholder - you should generate this properly)
      const contextEmbedding = Array(768).fill(0);
      
      // Create title based on subject and date
      const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Daily Challenge - ${targetDate.toLocaleDateString()}`;
      
      // Create daily task
      const dailyTask = new DailyTask({
        title,
        date: targetDate,
        subject,
        contextText,
        contextEmbedding,
        isAiGenerated: true,
        createdBy: userId
      });
      
      await dailyTask.save();
      
      res.status(201).json(
        new ApiResponse(true, 'AI-generated daily challenge created successfully', {
          dailyTask: {
            id: dailyTask._id,
            title: dailyTask.title,
            date: dailyTask.date,
            subject: dailyTask.subject,
            contextPreview: dailyTask.contextText.substring(0, 100) + '...',
            isAiGenerated: dailyTask.isAiGenerated
          }
        })
      );
    } catch (error: any) {
      console.error('Generate AI daily challenge error:', error);
      res.status(500).json(
        new ApiResponse(false, 'Failed to generate AI daily challenge')
      );
    }
  };
  
  /**
   * Automated function to generate daily challenges (to be called by cron job)
   */
  export const generateDailyChallengesAutomated = async (): Promise<void> => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const subjects = Object.values(Subject);
      
      for (const subject of subjects) {
        // Check if daily task already exists for tomorrow
        const existingTask = await DailyTask.findOne({
          date: tomorrow,
          subject,
          isActive: true
        });
        
        if (existingTask) {
          console.log(`Daily challenge already exists for ${subject} on ${tomorrow.toDateString()}`);
          continue;
        }
        
        // Generate context using AI
        const contextText = await generateDailyChallengeContext(subject);
        
        if (!contextText) {
          console.error(`Failed to generate context for ${subject}`);
          continue;
        }
        
        // Create embedding (placeholder)
        const contextEmbedding = Array(768).fill(0);
        
        // Create title
        const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Daily Challenge - ${tomorrow.toLocaleDateString()}`;
        
        // Create daily task (using system user ID or admin ID)
        const dailyTask = new DailyTask({
          title,
          date: tomorrow,
          subject,
          contextText,
          contextEmbedding,
          isAiGenerated: true,
          createdBy: new Types.ObjectId('000000000000000000000000') // System user ID
        });
        
        await dailyTask.save();
        console.log(`Created daily challenge for ${subject} on ${tomorrow.toDateString()}`);
      }
    } catch (error: any) {
      console.error('Automated daily challenge generation error:', error);
    }
  };
  
  /**
   * Get all daily challenges (Admin only)
   */
  export const getAllDailyChallenges = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, date, subject } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      
      // Build query
      let query: any = {};
      
      if (date) {
        const targetDate = new Date(date as string);
        targetDate.setHours(0, 0, 0, 0);
        query.date = targetDate;
      }
      
      if (subject && Object.values(Subject).includes(subject as Subject)) {
        query.subject = subject;
      }
      
      const dailyTasks = await DailyTask.find(query)
        .populate('createdBy', 'name email')
        .sort({ date: -1, subject: 1 })
        .skip(skip)
        .limit(Number(limit));
      
      const total = await DailyTask.countDocuments(query);
      
      res.status(200).json(
        new ApiResponse(true, 'Daily challenges fetched successfully', {
          dailyTasks: dailyTasks.map(task => ({
            id: task._id,
            title: task.title,
            date: task.date,
            subject: task.subject,
            contextPreview: task.contextText.substring(0, 100) + '...',
            isAiGenerated: task.isAiGenerated,
            isActive: task.isActive,
            createdBy: task.createdBy,
            createdAt: task.createdAt
          })),
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        })
      );
    } catch (error: any) {
      console.error('Get all daily challenges error:', error);
      res.status(500).json(
        new ApiResponse(false, 'Failed to fetch daily challenges')
      );
    }
  };
  
  /**
   * Update daily challenge (Admin only)
   */
  export const updateDailyChallenge = async (req: Request, res: Response) => {
    try {
      const { dailyTaskId } = req.params;
      const { title, contextText, isActive } = req.body;
      
      const dailyTask = await DailyTask.findById(dailyTaskId);
      
      if (!dailyTask) {
        return res.status(404).json(
          new ApiResponse(false, 'Daily challenge not found')
        );
      }
      
      if (title) dailyTask.title = title;
      if (contextText) dailyTask.contextText = contextText;
      if (isActive !== undefined) dailyTask.isActive = isActive;
      
      await dailyTask.save();
      
      res.status(200).json(
        new ApiResponse(true, 'Daily challenge updated successfully', {
          dailyTask: {
            id: dailyTask._id,
            title: dailyTask.title,
            date: dailyTask.date,
            subject: dailyTask.subject,
            isActive: dailyTask.isActive,
            isAiGenerated: dailyTask.isAiGenerated
          }
        })
      );
    } catch (error: any) {
      console.error('Update daily challenge error:', error);
      res.status(500).json(
        new ApiResponse(false, 'Failed to update daily challenge')
      );
    }
  };
  
  /**
   * Delete daily challenge (Admin only)
   */
  export const deleteDailyChallenge = async (req: Request, res: Response) => {
    try {
      const { dailyTaskId } = req.params;
      
      const dailyTask = await DailyTask.findById(dailyTaskId);
      
      if (!dailyTask) {
        return res.status(404).json(
          new ApiResponse(false, 'Daily challenge not found')
        );
      }
      
      // Check if any users have attempted this daily challenge
      const attemptCount = await QuizAttempt.countDocuments({
        dailyTaskRef: dailyTaskId
      });
      
      if (attemptCount > 0) {
        return res.status(400).json(
          new ApiResponse(false, 'Cannot delete daily challenge that has been attempted by users')
        );
      }
      
      await DailyTask.findByIdAndDelete(dailyTaskId);
      
      res.status(200).json(
        new ApiResponse(true, 'Daily challenge deleted successfully')
      );
    } catch (error: any) {
      console.error('Delete daily challenge error:', error);
      res.status(500).json(
        new ApiResponse(false, 'Failed to delete daily challenge')
      );
    }
  };