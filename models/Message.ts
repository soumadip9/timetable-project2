import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  recipientId?: mongoose.Types.ObjectId; // null for broadcast messages
  recipientEmail?: string; // for individual messages
  subject: string;
  body: string;
  isBroadcast: boolean; // true if sent to all teachers
  read: boolean;
  readAt?: Date;
  readBy?: Array<{
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  replies?: Array<{
    senderId: mongoose.Types.ObjectId;
    senderName: string;
    body: string;
    createdAt: Date;
  }>;
}

const MessageSchema: Schema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipientEmail: {
      type: String,
      default: null,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    isBroadcast: {
      type: Boolean,
      default: false,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    replies: [
      {
        senderId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        senderName: {
          type: String,
          required: true,
        },
        body: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
MessageSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
MessageSchema.index({ isBroadcast: 1, createdAt: -1 });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;

