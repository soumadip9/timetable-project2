import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth-helpers';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import TimetableEntry from '@/models/TimetableEntry';
// Note: bcryptjs not needed - User model's pre-save hook handles password hashing

export async function GET(request: NextRequest) {
  try {
    // Check if this is a simple request (no auth required for public teacher list)
    const { searchParams } = new URL(request.url);
    const simple = searchParams.get('simple') === 'true';

    if (!simple) {
      // Original admin-only endpoint
      try {
        await requireAdmin(request);
      } catch {
        console.error('[API] GET /api/teachers - Unauthorized');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    await connectDB();
    console.log('[API] GET /api/teachers - Fetching teachers');
    
    const teachers = await Teacher.find().populate('userId', 'name email role').lean();
    console.log('[API] GET /api/teachers - Found teachers:', teachers.length);
    
    // Simple format for SubjectTeacherSelector component
    if (simple) {
      const simpleTeachers = teachers
        .filter((t: any) => t.userId)
        .map((t: any) => ({
          _id: t._id.toString(),
          name: t.userId.name,
          subject: t.subject,
          email: t.userId.email,
          room: t.room || '',
        }));
      return NextResponse.json({ teachers: simpleTeachers }, { status: 200 });
    }
    
    // Get class counts for each teacher
    const teacherIds = teachers.map((t: any) => t._id);
    const classCounts = await TimetableEntry.aggregate([
      {
        $match: {
          teacherId: { $in: teacherIds },
        },
      },
      {
        $group: {
          _id: '$teacherId',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    // Create a map of teacherId -> count
    const countMap = new Map(
      classCounts.map((item: any) => [item._id.toString(), item.count])
    );

    const transformed = teachers
      .filter((t: any) => t.userId) // Filter out any teachers with missing userId
      .map((t: any) => ({
        id: t._id.toString(),
        userId: t.userId._id.toString(),
        name: t.userId.name,
        email: t.userId.email,
        subject: t.subject,
        phone: t.phone || '',
        classCount: countMap.get(t._id.toString()) || 0,
      }));

    console.log('[API] GET /api/teachers - Returning', transformed.length, 'teachers');
    return NextResponse.json({ success: true, data: transformed }, { status: 200 });
  } catch (error) {
    console.error('[API] GET /api/teachers - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teachers', message: error instanceof Error ? error.message : 'Unknown error' },
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
    const { name, email, password, subject, phone } = body;

    if (!name || !email || !password || !subject) {
      return NextResponse.json({ error: 'Name, email, password, and subject are required' }, { status: 400 });
    }

    await connectDB();

    // Normalize email (lowercase and trim) to match NextAuth logic
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('[API] POST /api/teachers - User already exists:', normalizedEmail);
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Create user with plain password - User model's pre-save hook will hash it automatically
    // This prevents double-hashing (manual hash + pre-save hook hash)
    console.log('[API] POST /api/teachers - Creating teacher user:', normalizedEmail);
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: password, // Plain password - pre-save hook will hash it
      role: 'TEACHER',
    });
    console.log('[API] POST /api/teachers - User created:', user._id.toString());

    // Create teacher
    console.log('[API] POST /api/teachers - Creating teacher profile');
    const teacher = await Teacher.create({
      userId: user._id,
      subject,
      phone: phone || undefined,
    });
    console.log('[API] POST /api/teachers - Teacher profile created:', teacher._id.toString());

    const teacherData = await Teacher.findById(teacher._id).populate('userId', 'name email').lean();
    
    if (!teacherData || !(teacherData as any).userId) {
      console.error('[API] POST /api/teachers - Failed to populate teacher data');
      throw new Error('Failed to retrieve created teacher data');
    }

    // Get class count for new teacher (will be 0)
    const classCount = await TimetableEntry.countDocuments({ teacherId: teacher._id });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: teacherData!._id.toString(),
          userId: (teacherData as any).userId._id.toString(),
          name: (teacherData as any).userId.name,
          email: (teacherData as any).userId.email,
          subject: teacherData!.subject,
          phone: teacherData!.phone || '',
          classCount,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    return NextResponse.json(
      { error: 'Failed to create teacher', message: error.message },
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
    const { id, name, email, subject, phone } = body;

    if (!id) {
      return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    await connectDB();

    const teacher = await Teacher.findById(id).populate('userId');
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Update user
    if (name || email) {
      await User.findByIdAndUpdate((teacher as any).userId._id, {
        ...(name && { name }),
        ...(email && { email }),
      });
    }

    // Update teacher
    await Teacher.findByIdAndUpdate(id, {
      ...(subject && { subject }),
      ...(phone !== undefined && { phone }),
    });

    const updated = await Teacher.findById(id).populate('userId', 'name email').lean();

    // Get class count for updated teacher
    const classCount = await TimetableEntry.countDocuments({ teacherId: id });

    return NextResponse.json({
      success: true,
      data: {
        id: updated!._id.toString(),
        userId: (updated as any).userId._id.toString(),
        name: (updated as any).userId.name,
        email: (updated as any).userId.email,
        subject: updated!.subject,
        phone: updated!.phone || '',
        classCount,
      },
    });
  } catch (error: any) {
    console.error('Error updating teacher:', error);
    return NextResponse.json(
      { error: 'Failed to update teacher', message: error.message },
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
      return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    await connectDB();

    const teacher = await Teacher.findById(id).populate('userId');
    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Delete user
    await User.findByIdAndDelete((teacher as any).userId._id);
    
    // Delete teacher
    await Teacher.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'Teacher deleted' });
  } catch (error: any) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json(
      { error: 'Failed to delete teacher', message: error.message },
      { status: 500 }
    );
  }
}
