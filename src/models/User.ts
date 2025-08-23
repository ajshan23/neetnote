import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  mobile: string;
  name?: string;
  neetYear?: number;
  hasAttendedNeetBefore?: boolean;
  previousNeetScore?: number;
  interestedColleges?: Array<{
    name: string;
    location?: string;
  }>;
  isVerified: boolean;
  justAfterQnAns: boolean;
  isProfileComplete: boolean;
  followedTags?: [string];
  lastFeedUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  mobile: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please fill a valid 10-digit mobile number']
  },
  name: {
    type: String,
    required: false,
    trim: true
  },
  neetYear: {
    type: Number,
    required: false,
    min: new Date().getFullYear(),
    max: new Date().getFullYear() + 5
  },
  hasAttendedNeetBefore: {
    type: Boolean,
    required: false,
    default: false
  },
  previousNeetScore: {
    type: Number,
    required: false,
    min: 0,
    max: 720,
    validate: {
      validator: function(this: IUser, value: number | undefined) {
        if (this.hasAttendedNeetBefore) {
          return value !== undefined && value >= 0 && value <= 720;
        }
        return true;
      },
      message: 'Previous NEET score is required if you have attended NEET before'
    }
  },
  interestedColleges: {
    type: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      location: {
        type: String,
        trim: true,
        maxlength: 50
      }
    }],
    required: false,
    default: [],
    validate: {
      validator: (colleges: Array<{name: string}>) => colleges.length <= 5,
      message: 'You can select up to 5 colleges only'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  justAfterQnAns:{
    type: Boolean,
    default: false
  },
  followedTags: [{
    type: String,
    trim: true
  }],
  lastFeedUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
});

// Add method to check profile completion
UserSchema.methods.checkProfileCompletion = function() {
  return !!(
    this.name &&
    this.mobile &&
    this.neetYear &&
    this.hasAttendedNeetBefore !== undefined &&
    (this.hasAttendedNeetBefore === false || this.previousNeetScore !== undefined)
  );
};

export default model<IUser>('User', UserSchema);