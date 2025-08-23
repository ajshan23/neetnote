import { Schema, model, Document } from 'mongoose';


export enum Subject {
  PHYSICS = 'physics',
  CHEMISTRY = 'chemistry',
  BIOLOGY = 'biology'
}

export interface IDailyTask extends Document {
  date: Date;
  subject: Subject;
  quiz: Schema.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DailyTaskSchema = new Schema<IDailyTask>({
  date: { type: Date, required: true, unique: true },
  subject: { 
    type: String, 
    enum: Object.values(Subject),
    required: true 
  },
  quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default model<IDailyTask>('DailyTask', DailyTaskSchema);