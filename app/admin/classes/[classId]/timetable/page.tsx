import { redirect } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-helpers';
import { connectDB } from '@/lib/mongodb';
import Class from '@/models/Class';
import TimetableNew from '@/models/TimetableNew';
import Teacher from '@/models/Teacher';
import Subject from '@/models/Subject';
import Room from '@/models/Room';
import mongoose from 'mongoose';
import ClassTimetableClient from './ClassTimetableClient';

async function getClass(classId: string) {
  try {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return null;
    }
    const classDoc = await Class.findById(classId).lean();
    if (!classDoc) {
      return null;
    }
    return {
      id: (classDoc as any)._id.toString(),
      name: (classDoc as any).name,
      section: (classDoc as any).section,
      grade: (classDoc as any).grade,
    };
  } catch (error) {
    console.error('Error fetching class:', error);
    return null;
  }
}

async function getTimetables(classId: string) {
  try {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return [];
    }
    const timetables = await TimetableNew.find({ classId: new mongoose.Types.ObjectId(classId) })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email specialization')
      .populate('roomId', 'name capacity building')
      .lean();
    
    return timetables.map((t: any) => {
      const result: any = {
        id: t._id.toString(),
        classId: t.classId.toString(),
        day: t.day,
        timeSlot: t.timeSlot,
      };
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
  } catch (error) {
    console.error('Error fetching timetables:', error);
    return [];
  }
}

async function getTeachers() {
  try {
    await connectDB();
    const teachers = await Teacher.find().lean();
    return teachers.map((t: any) => ({
      id: t._id.toString(),
      name: t.name,
      email: t.email,
      specialization: t.specialization,
    }));
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
}

async function getSubjects() {
  try {
    await connectDB();
    const subjects = await Subject.find().lean();
    return subjects.map((s: any) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code,
    }));
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }
}

async function getRooms() {
  try {
    await connectDB();
    const rooms = await Room.find().lean();
    return rooms.map((r: any) => ({
      id: r._id.toString(),
      name: r.name,
      capacity: r.capacity,
      building: r.building,
    }));
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

export default async function ClassTimetablePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  // Check authentication using auth helpers
  try {
    const token = await getAuthToken();
    const role = (token?.role as string)?.toUpperCase();
    if (!token || role !== 'ADMIN') {
      redirect('/login/admin');
    }
  } catch (error) {
    redirect('/login/admin');
  }

  // Fetch all data in parallel
  const [classData, timetables, teachers, subjects, rooms] = await Promise.all([
    getClass(classId),
    getTimetables(classId),
    getTeachers(),
    getSubjects(),
    getRooms(),
  ]);

  if (!classData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Class not found</h1>
          <p className="mt-2 text-gray-600">The class you're looking for doesn't exist.</p>
          <a href="/admin/classes" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Classes
          </a>
        </div>
      </div>
    );
  }

  // Data is already transformed in the fetch functions

  const className = `${classData.grade} ${classData.section}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-6">
          <a
            href="/admin/classes"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Classes
          </a>
        </div>
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          Timetable • {className}
        </h1>
        <ClassTimetableClient
          classData={classData}
          timetables={timetables}
          teachers={teachers}
          subjects={subjects}
          rooms={rooms}
        />
      </div>
    </div>
  );
}

