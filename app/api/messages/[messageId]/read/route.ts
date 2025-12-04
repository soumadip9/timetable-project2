import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth-helpers';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import User from '@/models/User';

// Mark message as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await connectDB();
    const token = await getAuthToken(request);

    if (!token || !token.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findOne({ email: token.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { messageId } = await params;
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user is the recipient
    if (
      message.recipientId &&
      message.recipientId.toString() !== user._id.toString() &&
      !message.isBroadcast
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if user is the recipient
    if (
      message.recipientId &&
      message.recipientId.toString() !== user._id.toString() &&
      !message.isBroadcast
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // For broadcast messages, add user to readBy array
    if (message.isBroadcast) {
      const hasRead = message.readBy?.some(
        (read: any) => read.userId?.toString() === user._id.toString()
      );

      if (!hasRead) {
        if (!message.readBy) {
          message.readBy = [];
        }
        message.readBy.push({
          userId: user._id,
          readAt: new Date(),
        });
        await message.save();
      }
    } else {
      // For individual messages, mark as read
      if (message.recipientId?.toString() === user._id.toString()) {
        message.read = true;
        message.readAt = new Date();
        await message.save();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message marked as read',
    });
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark message as read' },
      { status: 500 }
    );
  }
}

