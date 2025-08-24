import { Schema, model, Document, Types } from 'mongoose';

export enum Subject {
  PHYSICS = 'physics',
  CHEMISTRY = 'chemistry', 
  BIOLOGY = 'biology'
}

export interface IDailyTask extends Document {
  title: string; // Added title field
  date: Date;
  subject: Subject;
  contextText: string;
  contextEmbedding: number[];
  isActive: boolean;
  isAiGenerated: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DailyTaskSchema = new Schema<IDailyTask>({
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  subject: { 
    type: String, 
    enum: Object.values(Subject),
    required: true 
  },
  contextText: { 
    type: String, 
    required: true 
  },
  contextEmbedding: { 
    type: [Number], 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isAiGenerated: { 
    type: Boolean, 
    default: false 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  }
}, { 
  timestamps: true 
});

// Compound index for daily tasks
DailyTaskSchema.index({ 
  date: 1, 
  subject: 1 
}, { 
  unique: true,
  partialFilterExpression: { isActive: true }
});

export default model<IDailyTask>('DailyTask', DailyTaskSchema);