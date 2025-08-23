import { Schema, model, Document } from 'mongoose';
import { Subject } from './DailyTask';

export interface IQuestion extends Document {
  questionText: string;
  options: {
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }[];
  explanation?: string;
  imageUrl?: string;
  subject: Subject;
  isPreviousYear: boolean;
  year?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  questionText: { type: String, required: true },
  options: {
    type: [{
      text: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
      explanation: { type: String }
    }],
    required: true,
    validate: {
      validator: function(this: IQuestion, options: any[]) {
        return options.filter(opt => opt.isCorrect).length === 1;
      },
      message: 'Exactly one option must be correct'
    }
  },
  explanation: { type: String },
  imageUrl: { type: String },
  subject: { 
    type: String, 
    enum: Object.values(Subject),
    required: true 
  },
  isPreviousYear: { type: Boolean, default: false },
  year: { 
    type: Number,
    required: function(this: IQuestion) {
      return this.isPreviousYear;
    }
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'],
    required: true 
  },
  embedding: { type: [Number], required: true }
}, { timestamps: true });

export default model<IQuestion>('Question', QuestionSchema);