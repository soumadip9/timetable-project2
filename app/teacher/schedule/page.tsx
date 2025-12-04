'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

type TimetableEntry = {
  id: string;
  classId: string;
  day: string;
  timeSlot: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  class?: { name: string; section: string; grade: number };
  subject?: { name: string; code: string };
  room?: { name: string; building: string };
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
] as const;

type DayOfWeek = typeof DAYS[number];
type TimeSlot = typeof TIME_SLOTS[number];

export default function TeacherSchedule() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      const role = (session?.user as any)?.role;
      if (role !== 'teacher') {
        router.push('/auth/signin?error=Forbidden');
        return;
      }

      // Load teacher's schedule
      loadSchedule();
    }
  }, [session, status, router]);

  const loadSchedule = async () => {
    try {
      const teacherId = (session?.user as any)?.teacherId;
      
      if (!teacherId) {
        console.error('Teacher ID not found in session');
        setLoading(false);
        return;
      }

      // Load all timetables, classes, subjects, and rooms
      const [timetablesRes, classesRes, subjectsRes, roomsRes] = await Promise.all([
        fetch('/api/timetables'),
        fetch('/api/classes'),
        fetch('/api/subjects'),
        fetch('/api/rooms'),
      ]);

      const timetablesData = await timetablesRes.json();
      const classesData = await classesRes.json();
      const subjectsData = await subjectsRes.json();
      const roomsData = await roomsRes.json();

      // Transform data
      const transformId = (item: any) => {
        if (!item) return item;
        if (item._id && !item.id) {
          return { ...item, id: item._id.toString() };
        }
        return item;
      };

      const allTimetables = (timetablesData.success ? timetablesData.data : []).map(transformId);
      const allClasses = (classesData.success ? classesData.data : []).map(transformId);
      const allSubjects = (subjectsData.success ? subjectsData.data : []).map(transformId);
      const allRooms = (roomsData.success ? roomsData.data : []).map(transformId);

      // Filter timetables by teacherId
      const teacherTimetables = allTimetables.filter(
        (t: any) => {
          const tid = typeof t.teacherId === 'object' && t.teacherId?._id
            ? t.teacherId._id.toString()
            : (typeof t.teacherId === 'object' ? t.teacherId.toString() : t.teacherId);
          return tid === teacherId;
        }
      );

      // Enrich with related data
      const enrichedTimetables = teacherTimetables.map((t: any) => {
        const classItem = allClasses.find((c: any) => {
          const cid = typeof t.classId === 'object' && t.classId?._id
            ? t.classId._id.toString()
            : (typeof t.classId === 'object' ? t.classId.toString() : t.classId);
          return c.id === cid;
        });
        const subject = allSubjects.find((s: any) => {
          const sid = typeof t.subjectId === 'object' && t.subjectId?._id
            ? t.subjectId._id.toString()
            : (typeof t.subjectId === 'object' ? t.subjectId.toString() : t.subjectId);
          return s.id === sid;
        });
        const room = allRooms.find((r: any) => {
          const rid = typeof t.roomId === 'object' && t.roomId?._id
            ? t.roomId._id.toString()
            : (typeof t.roomId === 'object' ? t.roomId.toString() : t.roomId);
          return r.id === rid;
        });

        return {
          ...t,
          classId: typeof t.classId === 'object' && t.classId?._id
            ? t.classId._id.toString()
            : (typeof t.classId === 'object' ? t.classId.toString() : t.classId),
          subjectId: typeof t.subjectId === 'object' && t.subjectId?._id
            ? t.subjectId._id.toString()
            : (typeof t.subjectId === 'object' ? t.subjectId.toString() : t.subjectId),
          roomId: typeof t.roomId === 'object' && t.roomId?._id
            ? t.roomId._id.toString()
            : (typeof t.roomId === 'object' ? t.roomId.toString() : t.roomId),
          class: classItem,
          subject: subject,
          room: room,
        };
      });

      setTimetables(enrichedTimetables);
      setClasses(allClasses);
      setSubjects(allSubjects);
      setRooms(allRooms);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimetableForSlot = (day: DayOfWeek, timeSlot: TimeSlot): TimetableEntry | null => {
    return timetables.find(
      (t) => t.day === day && t.timeSlot === timeSlot
    ) || null;
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {session.user?.name}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Timetable Grid */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Time
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {TIME_SLOTS.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {timeSlot}
                    </td>
                    {DAYS.map((day) => {
                      const entry = getTimetableForSlot(day, timeSlot);
                      return (
                        <td key={day} className="px-4 py-3 text-sm">
                          {entry ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                              <div className="font-medium text-blue-900">
                                {entry.subject?.name || 'Subject'}
                              </div>
                              <div className="text-xs text-blue-800 mt-1">
                                {entry.class?.name || 'Class'} - {entry.room?.name || 'Room'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-600">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Summary</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-gray-700 font-medium">Total Classes</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(timetables.map(t => t.classId)).size}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700 font-medium">Total Subjects</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(timetables.map(t => t.subjectId)).size}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700 font-medium">Total Hours/Week</div>
              <div className="text-2xl font-bold text-gray-900">
                {timetables.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

