import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClass extends Document {
  name: string;
  subjects?: string[];
  classRoom?: string; // Room assigned for normal subjects
  labSubjectRoomMap?: Record<string, string>; // Map of lab subject -> lab room
}

const ClassSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    subjects: {
      type: [String],
      default: [],
    },
    classRoom: {
      type: String,
      default: '',
    },
    labSubjectRoomMap: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Class: Model<IClass> =
  mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema);

export default Class;

