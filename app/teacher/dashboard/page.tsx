'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface TimetableEntry {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  dayOfWeek: number;
  periodNumber: number;
  subject: string;
  room: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Reply {
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface Message {
  _id: string;
  senderName: string;
  subject: string;
  body: string;
  isBroadcast: boolean;
  isRead: boolean;
  createdAt: string;
  replies?: Reply[];
}

export default function TeacherDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/teacher');
      return;
    }

    if (status === 'authenticated' && (session?.user as any)?.role !== 'TEACHER') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      loadTimetable();
      loadMessages();
    }
  }, [status, session, router]);

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT',
      });
      // Reload messages to update read status
      loadMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };


  const loadTimetable = async () => {
    try {
      // Teacher role automatically filters to their entries
      const response = await fetch('/api/timetable-entries');
      if (response.ok) {
        const data = await response.json();
        setEntries(data.data || []);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group entries by day
  const entriesByDay = entries.reduce((acc, entry) => {
    const day = DAYS[entry.dayOfWeek - 1];
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  // Sort entries within each day by period
  Object.keys(entriesByDay).forEach((day) => {
    entriesByDay[day].sort((a, b) => a.periodNumber - b.periodNumber);
  });

  // Compute statistics
  const totalClasses = entries.length;
  const uniqueDays = new Set(entries.map((e) => e.dayOfWeek)).size;
  const periods = entries.map((e) => e.periodNumber);
  const earliestPeriod = periods.length > 0 ? Math.min(...periods) : null;
  const latestPeriod = periods.length > 0 ? Math.max(...periods) : null;

  // Calculate most frequent subject
  const subjectCounts = entries.reduce((acc, entry) => {
    acc[entry.subject] = (acc[entry.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSubject = Object.entries(subjectCounts).reduce(
    (max, [subject, count]) => {
      if (!max || count > max.count) {
        return { subject, count };
      }
      return max;
    },
    null as { subject: string; count: number } | null
  );

  // Calculate Next Class Today
  const getNextClassToday = (): TimetableEntry | null => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes for easier comparison

    // Map JavaScript dayOfWeek (0-6) to system dayOfWeek (1-6, Monday-Saturday)
    // JavaScript: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // System: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    let systemDayOfWeek: number | null = null;
    if (currentDayOfWeek === 0) {
      // Sunday - no classes in system
      return null;
    } else {
      systemDayOfWeek = currentDayOfWeek; // Monday=1, Tuesday=2, etc.
    }

    // Filter entries for today
    const todayEntries = entries.filter((e) => e.dayOfWeek === systemDayOfWeek);

    if (todayEntries.length === 0) {
      return null; // No classes today
    }

    // Sort by period number
    const sortedTodayEntries = [...todayEntries].sort((a, b) => a.periodNumber - b.periodNumber);

    // Estimate period start times (assuming Period 1 starts at 8:00 AM, each period is 1 hour)
    // Period 1: 8:00 (480 minutes)
    // Period 2: 9:00 (540 minutes)
    // Period 3: 10:00 (600 minutes)
    // etc.
    const getPeriodStartTime = (periodNumber: number): number => {
      return 8 * 60 + (periodNumber - 1) * 60; // 8 AM + (period - 1) hours in minutes
    };

    // Find the first class that hasn't started yet
    for (const entry of sortedTodayEntries) {
      const periodStartTime = getPeriodStartTime(entry.periodNumber);
      if (currentTime < periodStartTime) {
        return entry; // This class is still ahead
      }
    }

    // All classes for today have passed
    return null;
  };

  const nextClass = getNextClassToday();

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <span className="text-sm text-gray-600">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Messages Modal */}
      {showMessages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-2xl font-extrabold text-gray-900">Announcements</h3>
              <button
                onClick={() => setShowMessages(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMessages ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No announcements yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message._id}
                      className={`p-4 rounded-xl border-2 ${
                        message.isRead
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-indigo-50 border-indigo-300 shadow-md'
                      } transition-all`}
                    >
                      <div
                        onClick={() => {
                          if (!message.isRead) {
                            markAsRead(message._id);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-black">{message.senderName}</span>
                              {message.isBroadcast && (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                                  Broadcast
                                </span>
                              )}
                              {!message.isRead && (
                                <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                              )}
                            </div>
                            <h4 className="font-bold text-black mb-1">{message.subject}</h4>
                            <p className="text-sm text-black whitespace-pre-wrap">{message.body}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString()}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Timetable</h2>

        {/* Statistics Section */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
            <div className="p-4 rounded-lg bg-white shadow border">
              <p className="text-sm text-gray-500">Total Classes</p>
              <p className="text-xl font-semibold text-gray-900">{totalClasses}</p>
            </div>
            <div className="p-4 rounded-lg bg-white shadow border">
              <p className="text-sm text-gray-500">Teaching Days</p>
              <p className="text-xl font-semibold text-gray-900">{uniqueDays} days</p>
            </div>
            <div className="p-4 rounded-lg bg-white shadow border">
              <p className="text-sm text-gray-500">First Class</p>
              <p className="text-xl font-semibold text-gray-900">
                {earliestPeriod ? `Period ${earliestPeriod}` : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white shadow border">
              <p className="text-sm text-gray-500">Last Class</p>
              <p className="text-xl font-semibold text-gray-900">
                {latestPeriod ? `Period ${latestPeriod}` : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white shadow border col-span-2 sm:col-span-1">
              <p className="text-sm text-gray-500">Most Taught Subject</p>
              <p className="text-xl font-semibold text-gray-900">
                {topSubject ? `${topSubject.subject} (${topSubject.count} periods)` : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white shadow border col-span-2 sm:col-span-1">
              <p className="text-sm text-gray-500">Next Class Today</p>
              <p className="text-xl font-semibold text-gray-900">
                {nextClass
                  ? `Period ${nextClass.periodNumber} (${nextClass.subject})`
                  : 'No more classes today'}
              </p>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No timetable entries assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {DAYS.map((day) => {
              const dayEntries = entriesByDay[day] || [];
              if (dayEntries.length === 0) return null;

              return (
                <div key={day} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{day}</h3>
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            Period {entry.periodNumber} - {entry.subject}
                          </div>
                          <div className="text-sm text-gray-700">{entry.className}</div>
                        </div>
                        {entry.room && (
                          <div className="text-sm text-gray-700">Room: {entry.room}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Weekly Grid View */}
        {entries.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Weekly View</h3>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-bold text-gray-900 uppercase">
                      Period
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="px-4 py-3 bg-gray-50 text-center text-xs font-bold text-gray-900 uppercase"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((period) => (
                    <tr key={period}>
                      <td className="px-4 py-3 bg-gray-50 font-semibold text-sm text-gray-900">Period {period}</td>
                      {DAYS.map((_, dayIndex) => {
                        const day = dayIndex + 1;
                        const entry = entries.find(
                          (e) => e.dayOfWeek === day && e.periodNumber === period
                        );
                        return (
                          <td
                            key={dayIndex}
                            className="px-4 py-3 border border-gray-200 min-w-[150px]"
                          >
                            {entry ? (
                              <div>
                                <div className="font-medium text-sm text-gray-800">{entry.subject}</div>
                                <div className="text-xs text-gray-700">{entry.className}</div>
                                {entry.room && (
                                  <div className="text-xs text-gray-700">Room: {entry.room}</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-600 text-sm">-</div>
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
        )}
      </div>
    </div>
  );
}

