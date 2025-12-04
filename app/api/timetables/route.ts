import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import TimetableNew from '@/models/TimetableNew';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const day = searchParams.get('day');

    const query: any = {};
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return NextResponse.json({ error: 'Invalid classId format' }, { status: 400 });
      }
      query.classId = new mongoose.Types.ObjectId(classId);
    }
    if (day) {
      query.day = day;
    }

    // Build query with sorting if classId is present
    let timetablesQuery = TimetableNew.find(query)
      .populate('classId', 'name section grade')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email specialization')
      .populate('roomId', 'name capacity building');

    // If classId is present, sort by day and timeSlot
    if (classId) {
      timetablesQuery = timetablesQuery.sort({ day: 1, timeSlot: 1 });
    }

    const timetables = await timetablesQuery.lean();

    // Transform timetables: convert _id to id and extract IDs from populated fields
    const transformed = timetables.map((t: any) => {
      const result: any = {
        ...t,
        id: t._id.toString(),
      };
      
      // Extract IDs from populated fields
      if (t.classId) {
        result.classId = typeof t.classId === 'object' && t.classId._id 
          ? t.classId._id.toString() 
          : (typeof t.classId === 'object' ? t.classId.toString() : t.classId);
      }
      if (t.subjectId) {
        result.subjectId = typeof t.subjectId === 'object' && t.subjectId._id 
          ? t.subjectId._id.toString() 
          : (typeof t.subjectId === 'object' ? t.subjectId.toString() : t.subjectId);
      }
      if (t.teacherId) {
        result.teacherId = typeof t.teacherId === 'object' && t.teacherId._id 
          ? t.teacherId._id.toString() 
          : (typeof t.teacherId === 'object' ? t.teacherId.toString() : t.teacherId);
      }
      if (t.roomId) {
        result.roomId = typeof t.roomId === 'object' && t.roomId._id 
          ? t.roomId._id.toString() 
          : (typeof t.roomId === 'object' ? t.roomId.toString() : t.roomId);
      }
      
      return result;
    });

    return NextResponse.json({ timetables: transformed }, { status: 200 });
  } catch (error) {
    console.error('Error fetching timetables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timetables', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { classId, day, timeSlot, subjectId, teacherId, roomId } = body;

    if (!classId || !day || !timeSlot || !subjectId || !teacherId || !roomId) {
      return NextResponse.json(
        { error: 'Missing required fields', required: ['classId', 'day', 'timeSlot', 'subjectId', 'teacherId', 'roomId'] },
        { status: 400 }
      );
    }

    // Validate ObjectIds
    const ids = { classId, subjectId, teacherId, roomId };
    for (const [key, value] of Object.entries(ids)) {
      if (!value) {
        return NextResponse.json({ error: `Missing ${key}` }, { status: 400 });
      }
      if (!mongoose.Types.ObjectId.isValid(value)) {
        console.error(`Invalid ${key} format:`, value);
        return NextResponse.json({ error: `Invalid ${key} format: ${value}` }, { status: 400 });
      }
    }

    // Upsert: find existing entry with same classId, day, timeSlot and update, or create new
    const existing = await TimetableNew.findOne({
      classId: new mongoose.Types.ObjectId(classId),
      day,
      timeSlot,
    });

    let saved;
    if (existing) {
      existing.subjectId = new mongoose.Types.ObjectId(subjectId);
      existing.teacherId = new mongoose.Types.ObjectId(teacherId);
      existing.roomId = new mongoose.Types.ObjectId(roomId);
      saved = await existing.save();
    } else {
      const newTimetable = new TimetableNew({
        classId: new mongoose.Types.ObjectId(classId),
        day,
        timeSlot,
        subjectId: new mongoose.Types.ObjectId(subjectId),
        teacherId: new mongoose.Types.ObjectId(teacherId),
        roomId: new mongoose.Types.ObjectId(roomId),
      });
      saved = await newTimetable.save();
    }

    await saved.populate('classId', 'name section grade');
    await saved.populate('subjectId', 'name code');
    await saved.populate('teacherId', 'name email specialization');
    await saved.populate('roomId', 'name capacity building');

    // Convert to plain object and transform _id to id
    const savedObj = saved.toObject();
    const transformed = {
      ...savedObj,
      id: savedObj._id.toString(),
      classId: savedObj.classId._id?.toString() || savedObj.classId.toString(),
      subjectId: savedObj.subjectId._id?.toString() || savedObj.subjectId.toString(),
      teacherId: savedObj.teacherId._id?.toString() || savedObj.teacherId.toString(),
      roomId: savedObj.roomId._id?.toString() || savedObj.roomId.toString(),
    };

    return NextResponse.json({ success: true, data: transformed }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('Error creating/updating timetable:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json({ error: 'Validation error', details: errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create/update timetable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { id, ...update } = body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    // Convert ObjectId strings to ObjectIds if present
    if (update.classId) update.classId = new mongoose.Types.ObjectId(update.classId);
    if (update.subjectId) update.subjectId = new mongoose.Types.ObjectId(update.subjectId);
    if (update.teacherId) update.teacherId = new mongoose.Types.ObjectId(update.teacherId);
    if (update.roomId) update.roomId = new mongoose.Types.ObjectId(update.roomId);

    const updated = await TimetableNew.findByIdAndUpdate(id, update, { new: true, runValidators: true });

    if (!updated) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    await updated.populate('classId', 'name section grade');
    await updated.populate('subjectId', 'name code');
    await updated.populate('teacherId', 'name email specialization');
    await updated.populate('roomId', 'name capacity building');

    // Convert to plain object and transform _id to id
    const updatedObj = updated.toObject();
    const transformed = {
      ...updatedObj,
      id: updatedObj._id.toString(),
      classId: typeof updatedObj.classId === 'object' && updatedObj.classId._id 
        ? updatedObj.classId._id.toString() 
        : (typeof updatedObj.classId === 'object' ? updatedObj.classId.toString() : updatedObj.classId),
      subjectId: typeof updatedObj.subjectId === 'object' && updatedObj.subjectId._id 
        ? updatedObj.subjectId._id.toString() 
        : (typeof updatedObj.subjectId === 'object' ? updatedObj.subjectId.toString() : updatedObj.subjectId),
      teacherId: typeof updatedObj.teacherId === 'object' && updatedObj.teacherId._id 
        ? updatedObj.teacherId._id.toString() 
        : (typeof updatedObj.teacherId === 'object' ? updatedObj.teacherId.toString() : updatedObj.teacherId),
      roomId: typeof updatedObj.roomId === 'object' && updatedObj.roomId._id 
        ? updatedObj.roomId._id.toString() 
        : (typeof updatedObj.roomId === 'object' ? updatedObj.roomId.toString() : updatedObj.roomId),
    };

    return NextResponse.json({ success: true, data: transformed }, { status: 200 });
  } catch (error) {
    console.error('Error updating timetable:', error);
    return NextResponse.json(
      { error: 'Failed to update timetable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const deleted = await TimetableNew.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted }, { status: 200 });
  } catch (error) {
    console.error('Error deleting timetable:', error);
    return NextResponse.json(
      { error: 'Failed to delete timetable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

