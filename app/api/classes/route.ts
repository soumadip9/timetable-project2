import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth-helpers';
import Class from '@/models/Class';

export async function GET(request: NextRequest) {
  try {
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const classes = await Class.find().lean();
    
    const transformed = classes.map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
    }));

    return NextResponse.json({ success: true, data: transformed }, { status: 200 });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classes', message: error instanceof Error ? error.message : 'Unknown error' },
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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    await connectDB();
    const newClass = await Class.create({ name });

    return NextResponse.json(
      { success: true, data: { id: newClass._id.toString(), name: newClass.name } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating class:', error);
    
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Class name already exists' }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to create class', message: error.message },
      { status: 500 }
    );
  }
}
