import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Timetable from '@/models/Timetable';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth-helpers';

// GET - Fetch all timetable entries
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Optional query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const dayOfWeek = searchParams.get('dayOfWeek');
    const teacherId = searchParams.get('teacherId');
    const roomId = searchParams.get('roomId');

    // Build query
    const query: any = {};
    if (dayOfWeek) {
      query.dayOfWeek = dayOfWeek;
    }
    if (teacherId) {
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return NextResponse.json(
          { error: 'Invalid teacherId format' },
          { status: 400 }
        );
      }
      query.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (roomId) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return NextResponse.json(
          { error: 'Invalid roomId format' },
          { status: 400 }
        );
      }
      query.roomId = new mongoose.Types.ObjectId(roomId);
    }

    const timetables = await Timetable.find(query)
      .populate('teacherId', 'name email')
      .populate('roomId', 'name number')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    return NextResponse.json(
      { success: true, data: timetables, count: timetables.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching timetables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timetables', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create a new timetable entry
export async function POST(request: NextRequest) {
  try {
    // Require admin role
    try {
      await requireAdmin(request);
    } catch (authError) {
      if (authError instanceof Error) {
        if (authError.message === 'Unauthorized') {
          return NextResponse.json(
            { error: 'Unauthorized. Please sign in.' },
            { status: 401 }
          );
        }
        if (authError.message.includes('Admin access required')) {
          return NextResponse.json(
            { error: 'Forbidden. Admin access required.' },
            { status: 403 }
          );
        }
      }
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await request.json();

    // Validation
    const { subject, teacherId, roomId, dayOfWeek, startTime, endTime } = body;

    // Check required fields
    if (!subject || !teacherId || !roomId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields', required: ['subject', 'teacherId', 'roomId', 'dayOfWeek', 'startTime', 'endTime'] },
        { status: 400 }
      );
    }

    // Validate subject is not empty
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json(
        { error: 'Subject must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return NextResponse.json(
        { error: 'Invalid teacherId format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }

    // Validate dayOfWeek enum
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!validDays.includes(dayOfWeek)) {
      return NextResponse.json(
        { error: `Invalid dayOfWeek. Must be one of: ${validDays.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate time format (basic validation - expects HH:MM format)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      return NextResponse.json(
        { error: 'Invalid startTime format. Expected format: HH:MM (24-hour)' },
        { status: 400 }
      );
    }

    if (!timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Invalid endTime format. Expected format: HH:MM (24-hour)' },
        { status: 400 }
      );
    }

    // Validate that endTime is after startTime
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return NextResponse.json(
        { error: 'endTime must be after startTime' },
        { status: 400 }
      );
    }

    // Create new timetable entry
    const timetable = new Timetable({
      subject: subject.trim(),
      teacherId: new mongoose.Types.ObjectId(teacherId),
      roomId: new mongoose.Types.ObjectId(roomId),
      dayOfWeek,
      startTime,
      endTime,
    });

    const savedTimetable = await timetable.save();
    await savedTimetable.populate('teacherId', 'name email');
    await savedTimetable.populate('roomId', 'name number');

    return NextResponse.json(
      { success: true, data: savedTimetable },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating timetable:', error);

    // Handle Mongoose validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { error: 'Validation error', details: errors },
        { status: 400 }
      );
    }

    // Handle duplicate key errors
    if (error instanceof Error && error.message.includes('E11000')) {
      return NextResponse.json(
        { error: 'Duplicate entry detected' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create timetable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

