import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITimetableEntry extends Document {
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  dayOfWeek: number; // 1-7 (Monday-Sunday) or 1-6 (Monday-Saturday)
  periodNumber: number;
  subject: string;
  room?: string;
}

const TimetableEntrySchema: Schema = new Schema(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    subject: {
      type: String,
      required: true,
    },
    room: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create index to prevent duplicate entries for same class, day, and period
TimetableEntrySchema.index({ classId: 1, dayOfWeek: 1, periodNumber: 1 }, { unique: true });

const TimetableEntry: Model<ITimetableEntry> =
  mongoose.models.TimetableEntry || mongoose.model<ITimetableEntry>('TimetableEntry', TimetableEntrySchema);

export default TimetableEntry;

