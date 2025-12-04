import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeacher extends Document {
  userId: mongoose.Types.ObjectId;
  subject: string;
  phone?: string;
}

const TeacherSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    subject: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>('Teacher', TeacherSchema);

export default Teacher;

