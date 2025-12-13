import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth-helpers';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import User from '@/models/User';

// Add a reply to a message
export async function POST(
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

    // Only teachers can reply (not admins)
    if (token.role !== 'teacher') {
      console.log('[Reply API] Role check failed - user is not a teacher. Role:', token.role);
      return NextResponse.json(
        { error: `Only teachers can reply to messages. Your role: ${token.role || user.role || 'unknown'}` },
        { status: 403 }
      );
    }

    console.log('[Reply API] Teacher authenticated:', { email: user.email, role: token.role });

    const { messageId } = await params;
    console.log('[Reply API] Replying to message:', messageId);
    const body = await request.json();
    const { replyBody } = body;

    if (!replyBody || !replyBody.trim()) {
      return NextResponse.json(
        { error: 'Reply body is required' },
        { status: 400 }
      );
    }

    // Try to find the message - handle both string and ObjectId formats
    let message = null;
    try {
      message = await Message.findById(messageId);
    } catch (error) {
      console.error('Error finding message:', error);
      return NextResponse.json(
        { error: 'Invalid message ID format' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check if user is the recipient
    const isRecipient = message.recipientId?.toString() === user._id.toString();
    if (!isRecipient && !message.isBroadcast) {
      return NextResponse.json(
        { error: 'You can only reply to messages sent to you' },
        { status: 403 }
      );
    }

    // For broadcast messages, check if user is a recipient
    if (message.isBroadcast && !isRecipient) {
      return NextResponse.json(
        { error: 'You can only reply to broadcast messages you received' },
        { status: 403 }
      );
    }

    // Create the reply object
    const newReply = {
      senderId: user._id,
      senderName: user.name,
      body: replyBody.trim(),
      createdAt: new Date(),
    };

    // For broadcast messages, add reply to ALL instances of that broadcast
    // This ensures admins see the reply when viewing grouped broadcast messages
    if (message.isBroadcast) {
      try {
        // Find all messages from the same broadcast (same sender, subject, body, and createdAt within same second)
        if (!message.createdAt) {
          throw new Error('Message createdAt is missing');
        }
        const createdAt = new Date(message.createdAt);
        const timeStart = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(),
          createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds(), 0);
        const timeEnd = new Date(timeStart);
        timeEnd.setSeconds(timeEnd.getSeconds() + 1);

        console.log('[Reply API] Finding broadcast messages for reply:', {
          senderId: message.senderId,
          subject: message.subject,
          timeStart: timeStart.toISOString(),
          timeEnd: timeEnd.toISOString(),
        });

        const broadcastMessages = await Message.find({
          isBroadcast: true,
          senderId: message.senderId,
          subject: message.subject,
          body: message.body,
          createdAt: {
            $gte: timeStart,
            $lt: timeEnd,
          },
        });

        console.log('[Reply API] Found', broadcastMessages.length, 'broadcast message instances');

        if (broadcastMessages.length === 0) {
          // Fallback: just add to the current message if no other instances found
          console.warn('[Reply API] No broadcast instances found, adding reply to current message only');
          if (!message.replies) {
            message.replies = [];
          }
          message.replies.push(newReply);
          await message.save();
        } else {
          // Add reply to all instances
          const updatePromises = broadcastMessages.map(async (msg) => {
            if (!msg.replies) {
              msg.replies = [];
            }
            msg.replies.push(newReply);
            return msg.save();
          });

          await Promise.all(updatePromises);
          console.log('[Reply API] Added reply to', broadcastMessages.length, 'broadcast instances');
          
          // Verify the reply was saved by fetching one of the messages
          const verifyMsg = await Message.findById(broadcastMessages[0]._id);
          console.log('[Reply API] Verification - message now has', verifyMsg?.replies?.length || 0, 'replies');
        }

        return NextResponse.json({
          success: true,
          message: 'Reply sent successfully',
          reply: newReply,
        });
      } catch (broadcastError: any) {
        console.error('[Reply API] Error handling broadcast reply:', broadcastError);
        // Fallback to single message save
        if (!message.replies) {
          message.replies = [];
        }
        message.replies.push(newReply);
        await message.save();
        return NextResponse.json({
          success: true,
          message: 'Reply sent successfully',
          reply: newReply,
        });
      }
    } else {
      // For individual messages, just add to this one message
      if (!message.replies) {
        message.replies = [];
      }

      message.replies.push(newReply);
      await message.save();
      
      // Verify the reply was saved
      const verifyMsg = await Message.findById(messageId);
      console.log('[Reply API] Verification - individual message now has', verifyMsg?.replies?.length || 0, 'replies');

      return NextResponse.json({
        success: true,
        message: 'Reply sent successfully',
        reply: newReply,
      });
    }
  } catch (error: any) {
    console.error('[Reply API] Error adding reply:', error);
    console.error('[Reply API] Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to send reply',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

