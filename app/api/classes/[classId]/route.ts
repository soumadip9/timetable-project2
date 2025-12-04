import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth-helpers';
import Class from '@/models/Class';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> | { classId: string } }
) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const classId = resolvedParams.classId;
    
    if (!classId || typeof classId !== 'string') {
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }
    
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ error: 'Invalid class ID format' }, { status: 400 });
    }

    const classDoc = await Class.findById(classId).lean();

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: classDoc._id.toString(),
        name: classDoc.name,
        subjects: classDoc.subjects || [],
      },
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    return NextResponse.json(
      { error: 'Failed to fetch class', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> | { classId: string } }
) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      console.error('[API] DELETE /api/classes/[classId] - Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const classId = resolvedParams.classId;
    
    console.log('[API] DELETE /api/classes/[classId] - Attempting to delete:', classId);
    console.log('[API] DELETE /api/classes/[classId] - ClassId type:', typeof classId, 'value:', classId);
    
    if (!classId || typeof classId !== 'string') {
      console.error('[API] DELETE /api/classes/[classId] - Missing or invalid classId parameter:', classId);
      return NextResponse.json({ error: 'Invalid class ID' }, { status: 400 });
    }
    
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      console.error('[API] DELETE /api/classes/[classId] - Invalid ObjectId format:', classId);
      return NextResponse.json({ error: 'Invalid class ID format' }, { status: 400 });
    }

    const deleted = await Class.findByIdAndDelete(classId);

    if (!deleted) {
      console.error('[API] DELETE /api/classes/[classId] - Class not found:', classId);
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    console.log('[API] DELETE /api/classes/[classId] - Successfully deleted:', classId);
    return NextResponse.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    console.error('[API] DELETE /api/classes/[classId] - Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete class', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
