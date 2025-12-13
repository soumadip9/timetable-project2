import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth-helpers';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

// Get messages for the current user (teacher)
export async function GET(request: NextRequest) {
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

    console.log('[Messages API] User:', user.email, 'Role:', token.role);

    // For teachers, get messages sent to them
    // For admins, get messages they sent (so they can see replies)
    let query: any = {};
    const userRole = token.role?.toUpperCase();
    
    if (userRole === 'TEACHER') {
      // Teachers see messages sent to them
      query = { recipientId: user._id };
    } else if (userRole === 'ADMIN') {
      // Admins see messages they sent (to see replies)
      query = { senderId: user._id };
    } else {
      // Default: show both (fallback)
      query = {
        $or: [
          { recipientId: user._id },
          { senderId: user._id },
        ],
      };
    }

    console.log('[Messages API] Query:', JSON.stringify(query));
    
    // Don't use lean() so we can properly access replies subdocuments
    const allMessages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Convert to plain objects but ensure replies are included
    const messagesData = allMessages.map(msg => msg.toObject ? msg.toObject() : msg);

    console.log('[Messages API] Found messages:', messagesData.length);

    // Mark which messages are read/unread for this user
    const userIdStr = String(user._id);
    
    // For admins, group broadcast messages to avoid duplicates
    let processedMessages: any[] = [];
    
    if (userRole === 'ADMIN') {
      // Group broadcast messages by subject + body + createdAt (within same second)
      const broadcastGroups = new Map<string, any[]>();
      const individualMessages: any[] = [];
      
      for (const msg of messagesData) {
        if (msg.isBroadcast) {
          // Create a key from subject, body, and createdAt (rounded to second)
          if (!msg.createdAt) {
            console.warn('[Messages API] Broadcast message missing createdAt:', msg._id);
            continue;
          }
          const createdAt = new Date(msg.createdAt);
          const timeKey = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), 
            createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds()).toISOString();
          const key = `${msg.subject}|${msg.body}|${timeKey}`;
          
          if (!broadcastGroups.has(key)) {
            broadcastGroups.set(key, []);
          }
          broadcastGroups.get(key)!.push(msg);
        } else {
          individualMessages.push(msg);
        }
      }
      
      // Process broadcast groups - merge into one message per group
      for (const [key, group] of broadcastGroups.entries()) {
        const firstMsg = group[0];
        const allReplies: any[] = [];
        const allReadBy: any[] = [];
        
        // Merge all replies from all instances
        for (const msg of group) {
          console.log('[Messages API] Processing broadcast instance:', {
            _id: msg._id,
            hasReplies: !!msg.replies,
            repliesType: typeof msg.replies,
            repliesIsArray: Array.isArray(msg.replies),
            repliesLength: msg.replies?.length || 0,
            repliesSample: msg.replies?.[0] || null,
          });
          
          if (msg.replies && Array.isArray(msg.replies)) {
            console.log('[Messages API] Found', msg.replies.length, 'replies in broadcast instance:', msg._id);
            allReplies.push(...msg.replies);
          } else if (msg.replies && !Array.isArray(msg.replies)) {
            console.warn('[Messages API] Replies is not an array:', typeof msg.replies, msg.replies);
          }
          
          if (msg.readBy && Array.isArray(msg.readBy)) {
            allReadBy.push(...msg.readBy);
          }
        }
        
        console.log('[Messages API] Total replies before deduplication:', allReplies.length);
        
        // Sort replies by createdAt
        allReplies.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return aTime - bTime;
        });
        
        // Remove duplicate replies (same senderId + body + createdAt)
        const uniqueReplies = allReplies.filter((reply, idx, self) => {
          const replyKey = `${String(reply.senderId)}|${reply.body}|${reply.createdAt}`;
          return idx === self.findIndex(r => `${String(r.senderId)}|${r.body}|${r.createdAt}` === replyKey);
        });
        
        console.log('[Messages API] Unique replies after deduplication:', uniqueReplies.length);
        
        const formattedReplies = uniqueReplies.map((reply: any) => {
          try {
            return {
              senderId: String(reply.senderId || ''),
              senderName: reply.senderName || 'Unknown',
              body: reply.body || '',
              createdAt: reply.createdAt ? (reply.createdAt instanceof Date ? reply.createdAt.toISOString() : String(reply.createdAt)) : new Date().toISOString(),
            };
          } catch (e) {
            console.error('[Messages API] Error formatting reply:', e, reply);
            return null;
          }
        }).filter((r: any) => r !== null);
        
        console.log('[Messages API] Formatted replies count:', formattedReplies.length);
        
        const senderIdStr = firstMsg.senderId ? String(firstMsg.senderId) : '';
        
        processedMessages.push({
          ...firstMsg,
          _id: String(firstMsg._id || ''),
          senderId: senderIdStr,
          recipientId: null, // Broadcast has no single recipient
          isBroadcast: true,
          isRead: true, // Sent messages are always read
          recipientCount: group.length, // Number of teachers who received this
          replies: formattedReplies,
        });
      }
      
      // Process individual messages
      for (const msg of individualMessages) {
        const senderIdStr = msg.senderId ? String(msg.senderId) : '';
        const recipientIdStr = msg.recipientId ? String(msg.recipientId) : null;
        
        console.log('[Messages API] Processing individual message:', msg._id, 'with', (msg.replies || []).length, 'replies');
        
        const formattedReplies = (msg.replies || []).map((reply: any) => {
          try {
            return {
              senderId: String(reply.senderId || ''),
              senderName: reply.senderName || 'Unknown',
              body: reply.body || '',
              createdAt: reply.createdAt ? (reply.createdAt instanceof Date ? reply.createdAt.toISOString() : String(reply.createdAt)) : new Date().toISOString(),
            };
          } catch (e) {
            console.error('[Messages API] Error formatting reply:', e, reply);
            return null;
          }
        }).filter((r: any) => r !== null);
        
        processedMessages.push({
          ...msg,
          _id: String(msg._id || ''),
          senderId: senderIdStr,
          recipientId: recipientIdStr,
          isRead: true, // Sent messages are always read
          replies: formattedReplies,
        });
      }
    } else {
      // For teachers, process normally
      processedMessages = messagesData.map((msg: any) => {
        const recipientIdStr = msg.recipientId ? String(msg.recipientId) : null;
        const senderIdStr = msg.senderId ? String(msg.senderId) : '';
        
        const isRecipient = recipientIdStr === userIdStr;
        const isSender = senderIdStr === userIdStr;
        
        let isRead = false;
        
        if (isSender) {
          isRead = true;
        } else if (msg.isBroadcast && isRecipient) {
          isRead = msg.readBy?.some(
            (read: any) => String(read.userId) === userIdStr
          ) || false;
        } else if (isRecipient) {
          isRead = msg.read || false;
        }
        
        const formattedReplies = (msg.replies || []).map((reply: any) => ({
          senderId: String(reply.senderId || ''),
          senderName: reply.senderName || 'Unknown',
          body: reply.body || '',
          createdAt: reply.createdAt ? (reply.createdAt instanceof Date ? reply.createdAt.toISOString() : String(reply.createdAt)) : new Date().toISOString(),
        }));

        return {
          ...msg,
          _id: String(msg._id || ''),
          senderId: senderIdStr,
          recipientId: recipientIdStr,
          isRead,
          replies: formattedReplies,
        };
      });
    }

    // Sort by createdAt descending
    processedMessages.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    // Count unread messages (only messages where user is recipient, not sender)
    const unreadCount = processedMessages.filter((msg: any) => {
      if (userRole === 'ADMIN') return false; // Admins don't have unread sent messages
      const recipientIdStr = msg.recipientId ? String(msg.recipientId) : null;
      const isRecipient = recipientIdStr === userIdStr;
      return isRecipient && !msg.isRead;
    }).length;

    return NextResponse.json({
      success: true,
      messages: processedMessages,
      unreadCount,
    });
  } catch (error: any) {
    console.error('[Messages API] Error fetching messages:', error);
    console.error('[Messages API] Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch messages',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Send a message
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const token = await getAuthToken(request);

    if (!token || !token.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRole = (token.role || '').toUpperCase();
    if (tokenRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can send messages' }, { status: 403 });
    }

    const user = await User.findOne({ email: token.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { recipientId, recipientEmail, subject, messageBody, isBroadcast } = body;

    if (!subject || !messageBody) {
      return NextResponse.json(
        { error: 'Subject and message body are required' },
        { status: 400 }
      );
    }

    if (isBroadcast) {
      // Send to all teachers
      const teachers = await Teacher.find().populate('userId');
      // Filter out teachers without userId populated
      const validTeachers = teachers.filter((teacher: any) => teacher.userId && teacher.userId._id);
      
      if (validTeachers.length === 0) {
        return NextResponse.json(
          { error: 'No teachers found to send message to' },
          { status: 404 }
        );
      }

      const messages = validTeachers.map((teacher: any) => ({
        senderId: user._id,
        senderName: user.name,
        recipientId: teacher.userId._id,
        recipientEmail: teacher.userId.email,
        subject,
        body: messageBody,
        isBroadcast: true,
        read: false,
      }));

      await Message.insertMany(messages);

      return NextResponse.json({
        success: true,
        message: `Message sent to ${validTeachers.length} teachers`,
        count: validTeachers.length,
      });
    } else {
      // Send to individual teacher
      if (!recipientId && !recipientEmail) {
        return NextResponse.json(
          { error: 'Recipient ID or email is required' },
          { status: 400 }
        );
      }

      let recipientUserId = null;
      if (recipientId) {
        recipientUserId = recipientId;
      } else if (recipientEmail) {
        const recipientUser = await User.findOne({ email: recipientEmail });
        if (!recipientUser) {
          return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }
        recipientUserId = recipientUser._id;
      }

      const message = new Message({
        senderId: user._id,
        senderName: user.name,
        recipientId: recipientUserId,
        recipientEmail,
        subject,
        body: messageBody,
        isBroadcast: false,
        read: false,
      });

      await message.save();

      return NextResponse.json({
        success: true,
        message: 'Message sent successfully',
        messageId: message._id,
      });
    }
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

