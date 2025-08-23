import { Schema, model, Document } from 'mongoose';
import { Subject } from './DailyTask';

export interface IQuiz extends Document {
  title: string;
  description?: string;
  contextText: string;
  contextEmbedding: number[];
  imageUrl?: string;
  questions: Schema.Types.ObjectId[];
  subject: Subject;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isDailyQuiz: boolean;
  dailyTaskRef?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  parentQuiz?: Schema.Types.ObjectId;
}

const QuizSchema = new Schema<IQuiz>({
  title: { type: String, required: true },
  description: { type: String },
  contextText: { type: String, required: true },
  contextEmbedding: { type: [Number], required: true },
  imageUrl: { type: String },
  questions: [{ type: Schema.Types.ObjectId, ref: 'Question', required: true }],
  subject: { 
    type: String, 
    enum: Object.values(Subject),
    required: true 
  },
  topic: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'],
    required: true 
  },
  isDailyQuiz: { type: Boolean, default: false },
  dailyTaskRef: { type: Schema.Types.ObjectId, ref: 'DailyTask' },
  parentQuiz: { type: Schema.Types.ObjectId, ref: 'Quiz' }
}, { timestamps: true });

export default model<IQuiz>('Quiz', QuizSchema);