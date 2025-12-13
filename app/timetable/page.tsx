'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Removed localStorage - using API calls instead
import type { Timetable, Class, Teacher, Subject, Room, TimetableWithDetails } from '@/types';
import type { TimeSlot, DayOfWeek } from '@/types/models';
import EntityModal from '@/components/EntityModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TIME_SLOTS: TimeSlot[] = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
];

export default function TimetablePage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<Timetable | null>(null);
  const [activeTimeSlot, setActiveTimeSlot] = useState<TimeSlot | null>(null);
  const [activeDay, setActiveDay] = useState<DayOfWeek | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [timetablesRes, classesRes, teachersRes, subjectsRes, roomsRes] = await Promise.all([
        fetch('/api/timetables'),
        fetch('/api/classes'),
        fetch('/api/teachers'),
        fetch('/api/subjects'),
        fetch('/api/rooms'),
      ]);

      // Check if responses are OK before parsing JSON
      if (!timetablesRes.ok || !classesRes.ok || !teachersRes.ok || !subjectsRes.ok || !roomsRes.ok) {
        console.error('API error:', {
          timetables: timetablesRes.status,
          classes: classesRes.status,
          teachers: teachersRes.status,
          subjects: subjectsRes.status,
          rooms: roomsRes.status,
        });
      }

      const timetablesData = timetablesRes.ok ? await timetablesRes.json() : { success: false, data: [] };
      const classesData = classesRes.ok ? await classesRes.json() : { success: false, data: [] };
      const teachersData = teachersRes.ok ? await teachersRes.json() : { success: false, teachers: [], data: [] };
      const subjectsData = subjectsRes.ok ? await subjectsRes.json() : { success: false, data: [] };
      const roomsData = roomsRes.ok ? await roomsRes.json() : { success: false, data: [] };

      // Handle different API response formats and transform _id to id
      const transformId = (item: any) => {
        if (!item) return item;
        if (item._id && !item.id) {
          return { ...item, id: item._id.toString() };
        }
        return item;
      };

      // Transform timetable data: handle populated fields and convert to flat structure
      const transformTimetable = (t: any) => {
        if (!t) return t;
        const transformed = transformId(t);
        // If fields are populated objects, extract the _id
        if (transformed.classId) {
          if (typeof transformed.classId === 'object' && transformed.classId._id) {
            transformed.classId = transformed.classId._id.toString();
          } else if (typeof transformed.classId === 'object') {
            transformed.classId = transformed.classId.toString();
          }
        }
        if (transformed.subjectId) {
          if (typeof transformed.subjectId === 'object' && transformed.subjectId._id) {
            transformed.subjectId = transformed.subjectId._id.toString();
          } else if (typeof transformed.subjectId === 'object') {
            transformed.subjectId = transformed.subjectId.toString();
          }
        }
        if (transformed.teacherId) {
          if (typeof transformed.teacherId === 'object' && transformed.teacherId._id) {
            transformed.teacherId = transformed.teacherId._id.toString();
          } else if (typeof transformed.teacherId === 'object') {
            transformed.teacherId = transformed.teacherId.toString();
          }
        }
        if (transformed.roomId) {
          if (typeof transformed.roomId === 'object' && transformed.roomId._id) {
            transformed.roomId = transformed.roomId._id.toString();
          } else if (typeof transformed.roomId === 'object') {
            transformed.roomId = transformed.roomId.toString();
          }
        }
        return transformed;
      };

      const timetablesList = (timetablesData.success ? timetablesData.data : []).map(transformTimetable);
      console.log('📊 Loaded timetables:', timetablesList);
      setTimetables(timetablesList);
      setClasses((classesData.success ? classesData.data : []).map(transformId));
      setTeachers((teachersData.teachers || (teachersData.success ? teachersData.data : [])).map(transformId));
      setSubjects((subjectsData.success ? subjectsData.data : []).map(transformId));
      setRooms((roomsData.success ? roomsData.data : []).map(transformId));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimetableForSlot = (day: DayOfWeek, timeSlot: TimeSlot): TimetableWithDetails | null => {
    // Find all timetables matching day and timeSlot (there might be multiple for different classes)
    const matchingTimetables = timetables.filter(
      (t) => t.day === day && t.timeSlot === timeSlot
    );
    
    // For now, just take the first one (you might want to add class filtering later)
    const timetable = matchingTimetables[0];
    if (!timetable) return null;

    const classItem = classes.find((c) => c.id === timetable.classId);
    const subject = subjects.find((s) => s.id === timetable.subjectId);
    const teacher = teachers.find((t) => t.id === timetable.teacherId);
    const room = rooms.find((r) => r.id === timetable.roomId);

    if (!classItem || !subject || !teacher || !room) {
      console.warn('Missing related data for timetable:', { 
        timetable, 
        classItem: !!classItem, 
        subject: !!subject, 
        teacher: !!teacher, 
        room: !!room 
      });
      return null;
    }

    return {
      ...timetable,
      class: classItem,
      subject,
      teacher,
      room,
    };
  };

  const handleSlotClick = (day: DayOfWeek, timeSlot: TimeSlot) => {
    setActiveTimeSlot(timeSlot);
    setActiveDay(day);
    const existing = timetables.find((t) => t.day === day && t.timeSlot === timeSlot);
    if (existing) {
      setEditingTimetable(existing);
      setIsModalOpen(true);
    } else {
      setEditingTimetable(null);
      setIsModalOpen(true);
    }
  };

  const handleSave = async (data: Record<string, any>) => {
    if (!activeTimeSlot) {
      alert('Please select a time slot.');
      return;
    }

    // Use activeDay if available, otherwise use data.day, otherwise use editingTimetable.day
    const day = activeDay || (data.day as DayOfWeek) || editingTimetable?.day;
    if (!day) {
      alert('Please select a day.');
      return;
    }

    // Use data.classId if provided, otherwise use editingTimetable.classId
    const classId = data.classId || editingTimetable?.classId;
    if (!classId) {
      alert('Please select a class.');
      return;
    }

    // Validate required fields
    if (!data.subjectId) {
      alert('Please select a subject.');
      return;
    }
    if (!data.teacherId) {
      alert('Please select a teacher.');
      return;
    }
    if (!data.roomId) {
      alert('Please select a room.');
      return;
    }

    console.log('💾 Saving timetable:', { classId, day, timeSlot: activeTimeSlot, subjectId: data.subjectId, teacherId: data.teacherId, roomId: data.roomId });

    try {
      const timetableData = {
        classId,
        day,
        timeSlot: activeTimeSlot,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
      };

      const res = await fetch('/api/timetables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timetableData),
      });

      const responseData = await res.json();
      console.log('📤 API Response:', { status: res.status, data: responseData });

      if (res.ok) {
        console.log('✅ Timetable saved successfully, reloading data...');
        await loadData();
        console.log('✅ Data reloaded');
        setIsModalOpen(false);
        setActiveTimeSlot(null);
        setActiveDay(null);
        setEditingTimetable(null);
      } else {
        alert(responseData.error || 'Failed to save timetable');
      }
    } catch (error) {
      console.error('Error saving timetable:', error);
      alert('Failed to save timetable');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return;
    try {
      const res = await fetch(`/api/timetables?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete timetable');
      }
    } catch (error) {
      console.error('Error deleting timetable:', error);
      alert('Failed to delete timetable');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
          <button
            onClick={() => {
              setActiveTimeSlot(null);
              setActiveDay(null);
              setEditingTimetable(null);
              setIsModalOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Add Timetable Entry
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Weekly Timetable</h2>
          
          {/* Desktop View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 bg-gray-50 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Time
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="border border-gray-300 bg-gray-50 px-4 py-2 text-center text-sm font-semibold text-gray-700"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                      {timeSlot}
                    </td>
                    {DAYS.map((day) => {
                      const entry = getTimetableForSlot(day, timeSlot);
                      return (
                        <td
                          key={`${day}-${timeSlot}`}
                          className="border border-gray-300 px-2 py-1"
                        >
                          {entry ? (
                            <div
                              className="group relative cursor-pointer rounded bg-blue-100 p-2 text-xs hover:bg-blue-200"
                              onClick={() => handleSlotClick(day, timeSlot)}
                            >
                              <div className="font-semibold text-blue-900">{entry.class.name}</div>
                              <div className="text-blue-700">{entry.subject.name}</div>
                              <div className="text-blue-600">{entry.teacher.name}</div>
                              <div className="text-blue-600">Room: {entry.room.name}</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.id);
                                }}
                                className="absolute right-1 top-1 hidden rounded bg-red-500 px-1 text-xs text-white hover:bg-red-600 group-hover:block"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer rounded border-2 border-dashed border-gray-300 p-2 text-center text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600"
                              onClick={() => handleSlotClick(day, timeSlot)}
                            >
                              Click to add
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {DAYS.map((day) => (
              <div key={day} className="rounded-lg border border-gray-300 bg-white">
                <div className="border-b border-gray-300 bg-gray-50 p-3 font-semibold text-gray-900">
                  {day}
                </div>
                <div className="divide-y divide-gray-200">
                  {TIME_SLOTS.map((timeSlot) => {
                    const entry = getTimetableForSlot(day, timeSlot);
                    return (
                      <div
                        key={timeSlot}
                        className="p-3"
                        onClick={() => handleSlotClick(day, timeSlot)}
                      >
                        <div className="text-sm font-medium text-gray-600">{timeSlot}</div>
                        {entry ? (
                          <div className="mt-2 rounded bg-blue-100 p-2">
                            <div className="font-semibold text-blue-900">{entry.class.name}</div>
                            <div className="text-blue-700">{entry.subject.name}</div>
                            <div className="text-blue-600">{entry.teacher.name}</div>
                            <div className="text-blue-600">Room: {entry.room.name}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(entry.id);
                              }}
                              className="mt-2 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-600">Click to add</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <EntityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActiveTimeSlot(null);
            setActiveDay(null);
            setEditingTimetable(null);
          }}
          onSave={handleSave}
          title={editingTimetable ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
          fields={[
            {
              key: 'classId',
              label: 'Class',
              type: 'select',
              required: true,
              options: classes.map((c) => ({
                value: c.id,
                label: `${c.name} - ${c.section} (Grade ${c.grade})`,
              })),
            },
            {
              key: 'day',
              label: 'Day',
              type: 'select',
              required: true,
              options: DAYS.map((day) => ({ value: day, label: day })),
            },
            {
              key: 'subjectId',
              label: 'Subject',
              type: 'select',
              required: true,
              options: subjects.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.code})`,
              })),
            },
            {
              key: 'teacherId',
              label: 'Teacher',
              type: 'select',
              required: true,
              options: teachers.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.specialization})`,
              })),
            },
            {
              key: 'roomId',
              label: 'Room',
              type: 'select',
              required: true,
              options: rooms.map((r) => ({
                value: r.id,
                label: `${r.name} - ${r.building} (Capacity: ${r.capacity})`,
              })),
            },
          ]}
          initialData={
            editingTimetable
              ? {
                  ...editingTimetable,
                  classId: editingTimetable.classId,
                  day: editingTimetable.day,
                  subjectId: editingTimetable.subjectId,
                  teacherId: editingTimetable.teacherId,
                  roomId: editingTimetable.roomId,
                }
              : activeDay && activeTimeSlot
              ? { day: activeDay }
              : undefined
          }
        />
      </div>
    </div>
  );
}

