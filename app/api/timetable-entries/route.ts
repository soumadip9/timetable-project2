import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthToken, requireAdmin } from '@/lib/auth-helpers';
import TimetableEntry from '@/models/TimetableEntry';
import Teacher from '@/models/Teacher';
import Class from '@/models/Class';
import mongoose from 'mongoose';

// Ensure Class model is registered with Mongoose
// This import ensures the model schema is registered even if no admin pages have been visited
const _ensureClassModel = Class;

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');

    let query: any = {};

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
      }
      query.classId = new mongoose.Types.ObjectId(classId);
    }

    // If teacher, only show their entries
    if (token.role === 'teacher') {
      console.log('[API] GET /api/timetable-entries - Teacher request');
      console.log('[API] GET /api/timetable-entries - Token data:', {
        id: token.id,
        role: token.role,
        email: token.email,
      });
      
      if (!token.id) {
        console.error('[API] GET /api/timetable-entries - Token has no id');
        return NextResponse.json({ error: 'User ID not found in token' }, { status: 401 });
      }

      // Validate token.id is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(token.id as string)) {
        console.error('[API] GET /api/timetable-entries - Invalid token.id format:', token.id);
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 401 });
      }

      const userId = new mongoose.Types.ObjectId(token.id as string);
      console.log('[API] GET /api/timetable-entries - Looking for Teacher with userId:', userId.toString());
      
      const teacher = await Teacher.findOne({ userId });
      if (!teacher) {
        console.error('[API] GET /api/timetable-entries - Teacher profile not found for userId:', userId.toString());
        console.error('[API] GET /api/timetable-entries - Available teachers in DB:', await Teacher.countDocuments({}));
        
        // Instead of returning 404, return empty array so teacher can still see the page
        // This allows them to see "No timetable entries" instead of an error
        console.log('[API] GET /api/timetable-entries - Returning empty array (teacher profile missing)');
        return NextResponse.json({ success: true, data: [] }, { status: 200 });
      }
      
      console.log('[API] GET /api/timetable-entries - Found teacher:', teacher._id.toString());
      console.log('[API] GET /api/timetable-entries - Teacher userId:', teacher.userId.toString());
      query.teacherId = teacher._id;
      
      // Verify: Count entries for this teacher
      const entryCount = await TimetableEntry.countDocuments({ teacherId: teacher._id });
      console.log('[API] GET /api/timetable-entries - Total entries for this teacher:', entryCount);
    } else if (teacherId) {
      if (teacherId === 'current') {
        // For admin viewing current teacher (not used in this flow, but handle it)
        return NextResponse.json({ error: 'Invalid teacher ID' }, { status: 400 });
      }
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return NextResponse.json({ error: 'Invalid teacher ID' }, { status: 400 });
      }
      query.teacherId = new mongoose.Types.ObjectId(teacherId);
    }

    // Authorization check:
    // - admin can access all
    // - teacher already has query.teacherId set above
    // - Others need classId or teacherId parameter
    if (token.role !== 'admin' && token.role !== 'teacher' && !classId && !teacherId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] GET /api/timetable-entries - Final query:', JSON.stringify(query, null, 2));
    
    // Populate with error handling
    // Use simple populate - don't populate userId nested field as it's not needed in response
    const entries = await TimetableEntry.find(query)
      .populate('classId', 'name')
      .populate('teacherId', 'name subject')
      .lean()
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    console.log('[API] GET /api/timetable-entries - Found', entries.length, 'entries');
    
    // Log first entry details for debugging
    if (entries.length > 0) {
      console.log('[API] GET /api/timetable-entries - Sample entry:', {
        id: entries[0]._id,
        classId: entries[0].classId,
        teacherId: entries[0].teacherId,
        dayOfWeek: entries[0].dayOfWeek,
        periodNumber: entries[0].periodNumber,
      });
    }

    // Transform entries with null checks for populated fields
    const transformed = entries.map((e: any) => {
      // Handle case where classId might not be populated (deleted class)
      const classId = e.classId?._id 
        ? e.classId._id.toString() 
        : (e.classId?.toString() || 'unknown');
      const className = e.classId?.name || 'Unknown Class';
      
      // Handle case where teacherId might not be populated (deleted teacher)
      const teacherId = e.teacherId?._id 
        ? e.teacherId._id.toString() 
        : (e.teacherId?.toString() || 'unknown');
      
      return {
        id: e._id.toString(),
        classId,
        className,
        teacherId,
        dayOfWeek: e.dayOfWeek,
        periodNumber: e.periodNumber,
        subject: e.subject || '',
        room: e.room || '',
      };
    }).filter((e: any) => {
      // Filter out entries with invalid classId or teacherId (optional - you might want to keep them)
      // For now, we'll keep them but with 'unknown' values
      return true;
    });

    return NextResponse.json({ success: true, data: transformed }, { status: 200 });
  } catch (error) {
    console.error('Error fetching timetable entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timetable entries', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { classId, teacherId, dayOfWeek, periodNumber, subject, room } = body;

    if (!classId || !teacherId || !dayOfWeek || !periodNumber || !subject) {
      return NextResponse.json(
        { error: 'classId, teacherId, dayOfWeek, periodNumber, and subject are required' },
        { status: 400 }
      );
    }

    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return NextResponse.json({ error: 'Invalid classId or teacherId' }, { status: 400 });
    }

    const entry = await TimetableEntry.create({
      classId: new mongoose.Types.ObjectId(classId),
      teacherId: new mongoose.Types.ObjectId(teacherId),
      dayOfWeek: parseInt(dayOfWeek),
      periodNumber: parseInt(periodNumber),
      subject,
      room: room || undefined,
    });

    const populated = await TimetableEntry.findById(entry._id)
      .populate('classId', 'name')
      .populate('teacherId')
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: {
          id: populated!._id.toString(),
          classId: (populated as any).classId._id.toString(),
          className: (populated as any).classId.name,
          teacherId: (populated as any).teacherId._id.toString(),
          dayOfWeek: populated!.dayOfWeek,
          periodNumber: populated!.periodNumber,
          subject: populated!.subject,
          room: populated!.room || '',
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating timetable entry:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A timetable entry already exists for this class, day, and period' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create timetable entry', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, teacherId, subject, room } = body;

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    await connectDB();

    console.log('[API] PUT /api/timetable-entries - Updating entry:', id);
    
    // When updating, DO NOT change dayOfWeek or periodNumber
    // This prevents duplicate key errors on the unique index { classId, dayOfWeek, periodNumber }
    // Only allow updating: teacherId, subject, and room
    const updateData: any = {};
    if (teacherId) {
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return NextResponse.json({ error: 'Invalid teacherId' }, { status: 400 });
      }
      updateData.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (subject !== undefined) updateData.subject = subject;
    if (room !== undefined) updateData.room = room || undefined;

    console.log('[API] PUT /api/timetable-entries - Update data (excluding day/period):', updateData);

    // Verify entry exists before updating
    const existing = await TimetableEntry.findById(id);
    if (!existing) {
      console.error('[API] PUT /api/timetable-entries - Entry not found:', id);
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
    }

    console.log('[API] PUT /api/timetable-entries - Existing entry day/period:', existing.dayOfWeek, existing.periodNumber);
    console.log('[API] PUT /api/timetable-entries - Will NOT change day/period (locked)');

    const updated = await TimetableEntry.findByIdAndUpdate(id, updateData, { new: true })
      .populate('classId', 'name')
      .populate('teacherId')
      .lean();

    if (!updated) {
      console.error('[API] PUT /api/timetable-entries - Failed to update entry:', id);
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
    }

    console.log('[API] PUT /api/timetable-entries - Successfully updated entry:', id);

    return NextResponse.json({
      success: true,
      data: {
        id: updated._id.toString(),
        classId: (updated as any).classId._id.toString(),
        className: (updated as any).classId.name,
        teacherId: (updated as any).teacherId._id.toString(),
        dayOfWeek: updated.dayOfWeek,
        periodNumber: updated.periodNumber,
        subject: updated.subject,
        room: updated.room || '',
      },
    });
  } catch (error: any) {
    console.error('[API] PUT /api/timetable-entries - Error:', error);
    return NextResponse.json(
      { error: 'Failed to update timetable entry', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    await connectDB();

    const deleted = await TimetableEntry.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Timetable entry deleted' });
  } catch (error: any) {
    console.error('Error deleting timetable entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete timetable entry', message: error.message },
      { status: 500 }
    );
  }
}

