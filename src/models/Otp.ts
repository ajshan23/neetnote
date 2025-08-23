import { Schema, model, Document } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  email: { 
    type: String, 
    required: true,
    index: true
  },
  otp: { 
    type: String, 
    required: true 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expires: '5m' }
  },
  isUsed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default model<IOtp>('Otp', OtpSchema);