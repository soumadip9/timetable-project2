'use client';

import { useEffect, useState } from 'react';
import type { ITimetable } from '@/models/Timetable';

// Extended type for API response with populated fields
interface TimetableEntry {
  _id: string;
  subject: string;
  teacherId: {
    _id: string;
    name?: string;
    email?: string;
  } | string;
  roomId: {
    _id: string;
    name?: string;
    number?: string;
  } | string;
  dayOfWeek: ITimetable['dayOfWeek'];
  startTime: string;
  endTime: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TimetableResponse {
  success?: boolean;
  data?: TimetableEntry[];
  count?: number;
  error?: string;
  message?: string;
}

const DAYS_OF_WEEK: ITimetable['dayOfWeek'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Generate time slots (8 AM to 6 PM in 30-minute intervals)
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 8; hour < 18; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Convert time string (HH:MM) to minutes since midnight
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if a time slot overlaps with a timetable entry
const isTimeSlotInEntry = (
  slotTime: string,
  entry: TimetableEntry
): boolean => {
  const slotMinutes = timeToMinutes(slotTime);
  const startMinutes = timeToMinutes(entry.startTime);
  const endMinutes = timeToMinutes(entry.endTime);
  return slotMinutes >= startMinutes && slotMinutes < endMinutes;
};

export default function TimetableGrid() {
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimetables = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/timetable');
        const data: TimetableResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch timetables');
        }

        setTimetables(data.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching timetables:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimetables();
  }, []);

  // Group timetables by day
  const timetablesByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = timetables.filter((entry) => entry.dayOfWeek === day);
    return acc;
  }, {} as Record<ITimetable['dayOfWeek'], TimetableEntry[]>);

  // Get entry for a specific day and time slot
  const getEntryForSlot = (
    day: ITimetable['dayOfWeek'],
    slotTime: string
  ): TimetableEntry | undefined => {
    return timetablesByDay[day]?.find((entry) =>
      isTimeSlotInEntry(slotTime, entry)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading timetable...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto p-4">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Weekly Timetable</h2>
      
      {/* Desktop/Tablet View */}
      <div className="hidden md:block">
        <div className="min-w-full border-collapse rounded-lg border border-gray-300 bg-white shadow-sm">
          {/* Header Row */}
          <div className="grid grid-cols-7 border-b border-gray-300 bg-gray-50">
            <div className="border-r border-gray-300 p-3 text-center font-semibold text-gray-700">
              Time
            </div>
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="border-r border-gray-300 p-3 text-center font-semibold text-gray-700 last:border-r-0"
              >
                {day.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Time Rows */}
          {TIME_SLOTS.map((slotTime) => (
            <div
              key={slotTime}
              className="grid grid-cols-7 border-b border-gray-200 last:border-b-0"
            >
              <div className="border-r border-gray-300 bg-gray-50 p-2 text-center text-sm font-medium text-gray-600">
                {slotTime}
              </div>
              {DAYS_OF_WEEK.map((day) => {
                const entry = getEntryForSlot(day, slotTime);
                const isStartTime = entry?.startTime === slotTime;

                return (
                  <div
                    key={`${day}-${slotTime}`}
                    className="border-r border-gray-200 p-1 last:border-r-0"
                  >
                    {isStartTime && entry && (
                      <div
                        className="rounded-md bg-blue-100 p-2 text-xs shadow-sm transition-colors hover:bg-blue-200"
                        style={{
                          minHeight: '60px',
                        }}
                        title={`${entry.subject} - ${typeof entry.teacherId === 'object' ? entry.teacherId.name || 'Teacher' : 'Teacher'} - Room ${typeof entry.roomId === 'object' ? entry.roomId.name || entry.roomId.number || 'N/A' : 'N/A'}`}
                      >
                        <div className="font-semibold text-blue-900">
                          {entry.subject}
                        </div>
                        <div className="mt-1 text-blue-700">
                          {entry.startTime} - {entry.endTime}
                        </div>
                        {typeof entry.teacherId === 'object' && entry.teacherId.name && (
                          <div className="mt-1 text-xs text-blue-600">
                            {entry.teacherId.name}
                          </div>
                        )}
                        {typeof entry.roomId === 'object' && (entry.roomId.name || entry.roomId.number) && (
                          <div className="mt-1 text-xs text-blue-600">
                            Room: {entry.roomId.name || entry.roomId.number}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {DAYS_OF_WEEK.map((day) => {
          const dayEntries = timetablesByDay[day] || [];
          if (dayEntries.length === 0) return null;

          return (
            <div key={day} className="mb-6 rounded-lg border border-gray-300 bg-white shadow-sm">
              <div className="border-b border-gray-300 bg-gray-50 p-3 text-center font-semibold text-gray-700">
                {day}
              </div>
              <div className="divide-y divide-gray-200">
                {dayEntries.map((entry) => (
                  <div
                    key={entry._id}
                    className="p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {entry.subject}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {entry.startTime} - {entry.endTime}
                        </div>
                        {typeof entry.teacherId === 'object' && entry.teacherId.name && (
                          <div className="mt-1 text-sm text-gray-700">
                            Teacher: {entry.teacherId.name}
                          </div>
                        )}
                        {typeof entry.roomId === 'object' && (entry.roomId.name || entry.roomId.number) && (
                          <div className="mt-1 text-sm text-gray-700">
                            Room: {entry.roomId.name || entry.roomId.number}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

