import mongoose, { Schema, model, Document } from 'mongoose';

export interface IQuizAttempt extends Document {
  user: Schema.Types.ObjectId;
  quiz: Schema.Types.ObjectId;
  dailyTaskRef?: Schema.Types.ObjectId;
  answers: {
    question: Schema.Types.ObjectId;
    selectedOptionId?: Schema.Types.ObjectId;
    points: number; // 4, -1, or 0
  }[];
  totalScore: number;
  totalPossibleScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedQuestions: number;
  timeTaken: number;
  completedAt: Date;
  createdAt: Date;
}

const QuizAttemptSchema = new Schema<IQuizAttempt>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  dailyTaskRef: { type: Schema.Types.ObjectId, ref: 'DailyTask' },
  answers: {
    type: [{
      question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
      selectedOptionId: { type: mongoose.Types.ObjectId },
      points: { type: Number, required: true }
    }],
    required: true
  },
  totalScore: { type: Number, required: true },
  totalPossibleScore: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  wrongAnswers: { type: Number, required: true },
  skippedQuestions: { type: Number, required: true },
  timeTaken: { type: Number, required: true },
  completedAt: { type: Date }
}, { timestamps: true });

// Indexes
QuizAttemptSchema.index({ user: 1, quiz: 1 });
QuizAttemptSchema.index({ user: 1, dailyTaskRef: 1 });
QuizAttemptSchema.index({ completedAt: -1 });
QuizAttemptSchema.index({ totalScore: -1 });

export default model<IQuizAttempt>('QuizAttempt', QuizAttemptSchema);