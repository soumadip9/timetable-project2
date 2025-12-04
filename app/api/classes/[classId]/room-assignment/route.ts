import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth-helpers';
import Class from '@/models/Class';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> | { classId: string } }
) {
  try {
    await requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const resolvedParams = params instanceof Promise ? await params : params;
    const classId = resolvedParams.classId;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ error: 'Invalid classId' }, { status: 400 });
    }

    // Don't use lean() so we can properly access the Map
    const klass = await Class.findById(classId);
    if (!klass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // labSubjectRoomMap is stored as Mixed (plain object) in Mongoose
    let labSubjectRoomMap: Record<string, string> = {};
    if (klass.labSubjectRoomMap) {
      const mapValue = klass.labSubjectRoomMap as any;
      if (mapValue && typeof mapValue === 'object') {
        // Handle both plain objects and Mongoose subdocuments
        if (mapValue.toObject && typeof mapValue.toObject === 'function') {
          labSubjectRoomMap = mapValue.toObject();
        } else if (mapValue && typeof mapValue.get === 'function') {
          // If it's still a Map (shouldn't happen with Mixed, but handle it)
          const keys = Array.from(mapValue.keys() || []);
          keys.forEach((key: string) => {
            labSubjectRoomMap[key] = mapValue.get(key);
          });
        } else {
          // Plain object
          labSubjectRoomMap = { ...mapValue };
        }
      }
    }
    
    console.log(`[Room Assignment API GET] Class: ${klass.name}`);
    console.log(`[Room Assignment API GET] classRoom: "${klass.classRoom}"`);
    console.log(`[Room Assignment API GET] labSubjectRoomMap:`, JSON.stringify(labSubjectRoomMap, null, 2));
    console.log(`[Room Assignment API GET] Raw klass.labSubjectRoomMap:`, klass.labSubjectRoomMap);

    return NextResponse.json({
      success: true,
      data: {
        classId: klass._id.toString(),
        className: klass.name,
        classRoom: klass.classRoom || '',
        labSubjectRoomMap: labSubjectRoomMap,
      },
    });
  } catch (error: any) {
    console.error('[API] Error fetching room assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room assignment', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> | { classId: string } }
) {
  try {
    await requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const resolvedParams = params instanceof Promise ? await params : params;
    const classId = resolvedParams.classId;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ error: 'Invalid classId' }, { status: 400 });
    }

    const body = await req.json();
    const { classRoom, labSubjectRoomMap } = body;

    const klass = await Class.findById(classId);
    if (!klass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Update class room for normal subjects
    if (classRoom !== undefined) {
      klass.classRoom = classRoom || '';
    }

    // Update lab subject room mapping
    // Using Mixed type (plain object) for simpler storage
    if (labSubjectRoomMap !== undefined) {
      if (labSubjectRoomMap && typeof labSubjectRoomMap === 'object' && !(labSubjectRoomMap instanceof Map)) {
        // Set as plain object - Mongoose Mixed type stores it directly
        klass.labSubjectRoomMap = { ...labSubjectRoomMap };
        console.log(`[Room Assignment API] Saving labSubjectRoomMap:`, klass.labSubjectRoomMap);
      } else if (labSubjectRoomMap === null || labSubjectRoomMap === undefined || (typeof labSubjectRoomMap === 'object' && Object.keys(labSubjectRoomMap).length === 0)) {
        // Clear the map - set as empty object
        klass.labSubjectRoomMap = {};
      }
    }

    await klass.save();
    
    // Reload to ensure we have the saved data
    await klass.populate([]);

    // Convert Map to object for response
    let responseLabMap: Record<string, string> = {};
    if (klass.labSubjectRoomMap) {
      const mapValue = klass.labSubjectRoomMap as any;
      if (mapValue && typeof mapValue.get === 'function') {
        // Mongoose Map instance
        const keys = Array.from(mapValue.keys() || []);
        keys.forEach((key: string) => {
          responseLabMap[key] = mapValue.get(key);
        });
      } else if (mapValue && typeof mapValue === 'object') {
        // Plain object
        if (mapValue.toObject && typeof mapValue.toObject === 'function') {
          responseLabMap = mapValue.toObject();
        } else {
          responseLabMap = { ...mapValue };
        }
      }
    }
    
    console.log(`[Room Assignment API] Response labSubjectRoomMap:`, responseLabMap);

    return NextResponse.json({
      success: true,
      data: {
        classId: klass._id.toString(),
        className: klass.name,
        classRoom: klass.classRoom || '',
        labSubjectRoomMap: responseLabMap,
      },
    });
  } catch (error: any) {
    console.error('[API] Error updating room assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update room assignment', message: error.message },
      { status: 500 }
    );
  }
}

