'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import SubjectTeacherSelector from '@/components/SubjectTeacherSelector';

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

interface Teacher {
  id: string;
  name: string;
  subject: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Period time mappings
const PERIOD_TIMES: Record<number, { start: string; end: string; label: string }> = {
  1: { start: '09:00', end: '09:55', label: 'Period 1' },
  2: { start: '09:55', end: '10:50', label: 'Period 2' },
  3: { start: '11:05', end: '12:00', label: 'Period 3' },
  4: { start: '12:00', end: '12:50', label: 'Period 4' },
  5: { start: '13:45', end: '14:40', label: 'Period 5' },
  6: { start: '14:40', end: '15:35', label: 'Period 6' },
  7: { start: '15:35', end: '16:30', label: 'Period 7' },
};

// Break and lunch times
const BREAK_TIMES = [
  { start: '10:50', end: '11:05', label: 'Morning Break' },
  { start: '12:50', end: '13:45', label: 'Lunch Break' },
];

export default function ClassTimetablePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  const [className, setClassName] = useState('');
  const [classSubjects, setClassSubjects] = useState<string[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [formData, setFormData] = useState({
    teacherId: '',
    dayOfWeek: '1',
    periodNumber: '1',
    subject: '',
    room: '',
  });
  const [unavailableTeachers, setUnavailableTeachers] = useState<string[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string>('');
  const [lockDayPeriod, setLockDayPeriod] = useState(false); // Lock day/period when opened from cell click

  // Generate timetable state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  
  // Advanced filter state
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState<string>('');
  const [maxPeriodsPerWeek, setMaxPeriodsPerWeek] = useState<string>('');
  const [avoidConsecutive, setAvoidConsecutive] = useState(false);
  const [subjectFrequency, setSubjectFrequency] = useState<Array<{ subject: string; maxPerWeek: string }>>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Determine if we're editing an existing entry or if day/period should be locked
  const isEditing = !!editingEntry;
  const isDayPeriodLocked = isEditing || lockDayPeriod;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      loadData();
    }
  }, [status, session, router, classId]);

  // Check teacher availability for the selected day/period
  const checkTeacherAvailability = useCallback(async (day: string, period: string, currentTeacherId?: string) => {
    if (!day || !period) return;
    
    try {
      const response = await fetch(
        `/api/teachers/availability?dayOfWeek=${day}&periodNumber=${period}&classId=${classId}`
      );
      if (response.ok) {
        const data = await response.json();
        setUnavailableTeachers(data.unavailableTeacherIds || []);
        
        // Check if currently selected teacher is unavailable
        const teacherIdToCheck = currentTeacherId || formData.teacherId;
        if (teacherIdToCheck && data.unavailableTeacherIds.includes(teacherIdToCheck)) {
          const teacher = teachers.find((t) => t.id === teacherIdToCheck);
          setAvailabilityError(
            `⚠️ Teacher "${teacher?.name || 'Unknown'}" is not free - already assigned to another class at this time.`
          );
        } else {
          setAvailabilityError('');
        }
      }
    } catch (error) {
      console.error('Error checking teacher availability:', error);
    }
  }, [classId, formData.teacherId, teachers]);

  // Check availability when form is shown and day/period changes
  useEffect(() => {
    if (showForm && formData.dayOfWeek && formData.periodNumber) {
      checkTeacherAvailability(formData.dayOfWeek, formData.periodNumber);
    }
  }, [showForm, formData.dayOfWeek, formData.periodNumber, checkTeacherAvailability]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load class info
      const classRes = await fetch(`/api/classes/${classId}`);
      if (classRes.ok) {
        const classData = await classRes.json();
        setClassName(classData.data.name);
        setClassSubjects(classData.data.subjects || []);
      }

      // Load timetable entries - add timestamp to prevent caching
      const entriesRes = await fetch(`/api/timetable-entries?classId=${classId}&_t=${Date.now()}`);
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        console.log('[Timetable] Loaded entries:', entriesData.data?.length || 0);
        setEntries(entriesData.data || []);
      } else {
        console.error('[Timetable] Failed to load entries:', entriesRes.status);
      }

      // Load teachers
      const teachersRes = await fetch('/api/teachers');
      if (teachersRes.ok) {
        const teachersData = await teachersRes.json();
        setTeachers(teachersData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntry = (day: number, period: number): TimetableEntry | undefined => {
    return entries.find((e) => e.dayOfWeek === day && e.periodNumber === period);
  };

  // Calculate subject counts per week
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((entry) => {
      counts[entry.subject] = (counts[entry.subject] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if selected teacher is unavailable
    if (unavailableTeachers.includes(formData.teacherId)) {
      const teacher = teachers.find((t) => t.id === formData.teacherId);
      alert(`Cannot assign teacher "${teacher?.name || 'Unknown'}". This teacher is not free - already assigned to another class at this time.`);
      return;
    }
    
    try {
      const url = '/api/timetable-entries';
      const method = editingEntry ? 'PUT' : 'POST';
      
      // When editing, exclude dayOfWeek and periodNumber from the update
      // They should remain unchanged to avoid duplicate key errors
      const body = editingEntry
        ? { 
            id: editingEntry.id, 
            teacherId: formData.teacherId,
            subject: formData.subject,
            room: formData.room,
            classId 
          }
        : { ...formData, classId };

      console.log('[Timetable] Submitting entry:', method, body);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        console.log('[Timetable] Entry saved successfully');
        setShowForm(false);
        setEditingEntry(null);
        setLockDayPeriod(false); // Reset lock when form closes
        setFormData({ teacherId: '', dayOfWeek: '1', periodNumber: '1', subject: '', room: '' });
        setAvailabilityError('');
        setUnavailableTeachers([]);
        loadData();
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Timetable] Failed to save entry:', response.status, error);
        alert(`Failed to save timetable entry: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Timetable] Error saving entry:', error);
      alert('Failed to save timetable entry. Please check the console for details.');
    }
  };

  const handleCellClick = (day: number, period: number) => {
    const entry = getEntry(day, period);
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        teacherId: entry.teacherId,
        dayOfWeek: entry.dayOfWeek.toString(),
        periodNumber: entry.periodNumber.toString(),
        subject: entry.subject,
        room: entry.room,
      });
    } else {
      setEditingEntry(null);
      setFormData({
        teacherId: '',
        dayOfWeek: day.toString(),
        periodNumber: period.toString(),
        subject: '',
        room: '',
      });
    }
    setLockDayPeriod(true); // Lock day/period when opened from cell click
    setShowForm(true);
    // Check availability when opening form
    checkTeacherAvailability(day.toString(), period.toString());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timetable entry?')) return;

    try {
      const response = await fetch(`/api/timetable-entries?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      } else {
        alert('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl font-bold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">Admin Dashboard</h1>
              <Link href="/admin/dashboard" className="text-base font-bold text-gray-700 hover:text-indigo-600 transition-colors">
                Classes
              </Link>
              <Link href="/admin/teachers" className="text-base font-bold text-gray-700 hover:text-indigo-600 transition-colors">
                Teachers
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-base font-bold text-gray-800">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-base font-bold text-red-600 hover:text-red-800 transition-all px-4 py-2 border-2 border-red-200 rounded-lg hover:bg-red-50 shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block text-lg font-semibold transition-colors duration-200">
              ← Back to Classes
            </Link>
            <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
              Timetable • {className}
            </h2>
          </div>
        </div>

        {/* Subject-Teacher Selector */}
        <div className="mb-6">
          <SubjectTeacherSelector 
            classId={classId} 
            initialSubjects={classSubjects.length > 0 ? classSubjects : ["Mathematics", "English", "Science"]}
            onTimetableGenerated={loadData}
          />
        </div>

        {/* Subject Count per Week */}
        {subjectCounts.length > 0 && (
          <div className="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-5 tracking-tight">Subject Count per Week</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {subjectCounts.map(({ subject, count }) => (
                <div
                  key={subject}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center"
                >
                  <div className="text-3xl font-extrabold text-blue-700 mb-2">{count}</div>
                  <div className="text-base font-bold text-gray-800">{subject}</div>
                  <div className="text-sm text-gray-600 mt-1 font-semibold">classes/week</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-700">Total Classes:</span>
                <span className="text-xl font-extrabold text-gray-900">{entries.length}</span>
              </div>
            </div>
          </div>
        )}


        {/* Generate Timetable Modal (Legacy - can be removed if not needed) */}
        {showGenerateModal && (
          <div className="mb-6 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Select teachers for this class</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedTeacherIds([]);
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 pb-3 border-b border-gray-200">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.length === teachers.length && teachers.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTeacherIds(teachers.map((t) => t.id));
                    } else {
                      setSelectedTeacherIds([]);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-base font-bold text-gray-800">Select all</span>
              </label>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {teachers.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No teachers available. Please create teachers first.</p>
              ) : (
                teachers.map((teacher) => (
                  <label
                    key={teacher.id}
                    className="flex items-center gap-3 p-3 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.includes(teacher.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeacherIds((prev) => [...prev, teacher.id]);
                        } else {
                          setSelectedTeacherIds((prev) => prev.filter((id) => id !== teacher.id));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="text-base font-bold text-gray-900">{teacher.name}</div>
                      <div className="text-sm font-semibold text-gray-700">{teacher.subject}</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Advanced Filters Section */}
            <div className="mb-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced Filters
              </button>

              {showAdvancedFilters && (
                <div className="mt-4 space-y-4 pl-6">
                  {/* Max Periods Per Day */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Periods Per Day (per teacher)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxPeriodsPerDay}
                      onChange={(e) => setMaxPeriodsPerDay(e.target.value)}
                      placeholder="e.g., 4 (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Limit how many periods a teacher can teach per day</p>
                  </div>

                  {/* Max Periods Per Week */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Periods Per Week (per teacher)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxPeriodsPerWeek}
                      onChange={(e) => setMaxPeriodsPerWeek(e.target.value)}
                      placeholder="e.g., 20 (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Limit total periods a teacher can teach per week</p>
                  </div>

                  {/* Avoid Consecutive */}
                  <div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avoidConsecutive}
                        onChange={(e) => setAvoidConsecutive(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Avoid consecutive periods for same teacher</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Prevents assigning the same teacher to adjacent periods on the same day
                    </p>
                  </div>

                  {/* Subject Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Frequency Limits (per week)
                    </label>
                    <div className="space-y-2">
                      {subjectFrequency.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={item.subject}
                            onChange={(e) => {
                              const updated = [...subjectFrequency];
                              updated[index].subject = e.target.value;
                              setSubjectFrequency(updated);
                            }}
                            placeholder="Subject name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                          <input
                            type="number"
                            min="1"
                            value={item.maxPerWeek}
                            onChange={(e) => {
                              const updated = [...subjectFrequency];
                              updated[index].maxPerWeek = e.target.value;
                              setSubjectFrequency(updated);
                            }}
                            placeholder="Max"
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSubjectFrequency(subjectFrequency.filter((_, i) => i !== index));
                            }}
                            className="px-2 py-2 text-red-600 hover:text-red-800"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectFrequency([...subjectFrequency, { subject: '', maxPerWeek: '' }]);
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Add Subject Limit
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Limit how many times each subject appears per week</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setSelectedTeacherIds([]);
                  setMaxPeriodsPerDay('');
                  setMaxPeriodsPerWeek('');
                  setAvoidConsecutive(false);
                  setSubjectFrequency([]);
                  setShowAdvancedFilters(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={generating || selectedTeacherIds.length === 0}
                onClick={async () => {
                  if (selectedTeacherIds.length === 0) return;

                  try {
                    setGenerating(true);
                    console.log('[Timetable] Generating timetable with teachers:', selectedTeacherIds);

                    // Build request body with filters
                    const requestBody: any = {
                      teacherIds: selectedTeacherIds,
                    };

                    if (maxPeriodsPerDay && maxPeriodsPerDay.trim() !== '') {
                      requestBody.maxPeriodsPerDay = parseInt(maxPeriodsPerDay, 10);
                    }

                    if (maxPeriodsPerWeek && maxPeriodsPerWeek.trim() !== '') {
                      requestBody.maxPeriodsPerWeek = parseInt(maxPeriodsPerWeek, 10);
                    }

                    if (avoidConsecutive) {
                      requestBody.avoidConsecutive = true;
                    }

                    if (subjectFrequency.length > 0) {
                      requestBody.subjectFrequency = subjectFrequency
                        .filter((item) => item.subject.trim() !== '' && item.maxPerWeek.trim() !== '')
                        .map((item) => ({
                          subject: item.subject.trim(),
                          maxPerWeek: parseInt(item.maxPerWeek, 10),
                        }));
                    }

                    console.log('[Timetable] Request body:', requestBody);

                    const response = await fetch(`/api/classes/${classId}/generate-timetable`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(requestBody),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                      console.error('[Timetable] Failed to generate timetable:', errorData);
                      alert(`Failed to generate timetable: ${errorData.error || 'Unknown error'}`);
                      return;
                    }

                    const result = await response.json();
                    console.log('[Timetable] Timetable generated successfully:', result);

                    // Close modal and refresh data
                    setShowGenerateModal(false);
                    setSelectedTeacherIds([]);
                    setMaxPeriodsPerDay('');
                    setMaxPeriodsPerWeek('');
                    setAvoidConsecutive(false);
                    setSubjectFrequency([]);
                    setShowAdvancedFilters(false);
                    loadData(); // Reload timetable entries
                    router.refresh(); // Refresh the page
                  } catch (error) {
                    console.error('[Timetable] Error generating timetable:', error);
                    alert('Failed to generate timetable. Please check the console for details.');
                  } finally {
                    setGenerating(false);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Timetable'}
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white rounded-lg shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-5">
              {editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Teacher</label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => {
                    const newTeacherId = e.target.value;
                    setFormData({ ...formData, teacherId: newTeacherId });
                    // Check availability when teacher changes
                    if (newTeacherId && formData.dayOfWeek && formData.periodNumber) {
                      checkTeacherAvailability(formData.dayOfWeek, formData.periodNumber, newTeacherId);
                    }
                  }}
                  className={`w-full px-4 py-3 text-base font-medium text-gray-900 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    availabilityError && unavailableTeachers.includes(formData.teacherId)
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  required
                >
                  <option value="" className="text-gray-500">Select teacher</option>
                  {teachers.map((teacher) => {
                    const isUnavailable = unavailableTeachers.includes(teacher.id);
                    return (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                        disabled={isUnavailable}
                        className={isUnavailable ? 'text-red-600 bg-red-50' : ''}
                      >
                        {isUnavailable
                          ? `❌ ${teacher.name} - ${teacher.subject} (Not free - already assigned to another class)`
                          : `${teacher.name} - ${teacher.subject}`}
                      </option>
                    );
                  })}
                </select>
                {availabilityError && unavailableTeachers.includes(formData.teacherId) && (
                  <p className="mt-2 text-base text-red-600 font-semibold">{availabilityError}</p>
                )}
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">
                  Day {isDayPeriodLocked && <span className="text-gray-600 text-sm font-normal">(locked)</span>}
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => {
                    setFormData({ ...formData, dayOfWeek: e.target.value });
                    // Check availability when day changes
                    if (formData.periodNumber) {
                      checkTeacherAvailability(e.target.value, formData.periodNumber);
                    }
                  }}
                  disabled={isDayPeriodLocked}
                  className={`w-full px-4 py-3 text-base font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDayPeriodLocked ? 'bg-gray-100 cursor-not-allowed text-gray-700' : 'bg-white'
                  }`}
                  required
                >
                  {DAYS.map((day, index) => (
                    <option key={index + 1} value={(index + 1).toString()} className="text-gray-900">
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">
                  Period {isDayPeriodLocked && <span className="text-gray-600 text-sm font-normal">(locked)</span>}
                </label>
                <select
                  value={formData.periodNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, periodNumber: e.target.value });
                    // Check availability when period changes
                    if (formData.dayOfWeek) {
                      checkTeacherAvailability(formData.dayOfWeek, e.target.value);
                    }
                  }}
                  disabled={isDayPeriodLocked}
                  className={`w-full px-4 py-3 text-base font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDayPeriodLocked ? 'bg-gray-100 cursor-not-allowed text-gray-700' : 'bg-white'
                  }`}
                  required
                >
                  {PERIODS.map((period) => {
                    const periodTime = PERIOD_TIMES[period];
                    return (
                    <option key={period} value={period.toString()} className="text-gray-900">
                      {periodTime.label} ({periodTime.start} - {periodTime.end})
                    </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">Room (Optional)</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="px-6 py-3 text-base font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                {editingEntry ? 'Update' : 'Create'}
              </button>
              {editingEntry && (
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(editingEntry.id);
                    setShowForm(false);
                  }}
                  className="px-6 py-3 text-base font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingEntry(null);
                  setLockDayPeriod(false); // Reset lock when form closes
                  setAvailabilityError('');
                  setUnavailableTeachers([]);
                }}
                className="px-6 py-3 text-base font-semibold bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-5 py-4 bg-gray-100 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-300">
                  Period
                </th>
                {DAYS.map((day, index) => (
                  <th 
                    key={index} 
                    className="px-5 py-4 bg-gray-100 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => {
                const periodTime = PERIOD_TIMES[period];
                return (
                <tr key={period}>
                  <td className="px-5 py-4 bg-gray-50 font-semibold text-base text-gray-800 border-r border-gray-300">
                    <div>{periodTime.label}</div>
                    <div className="text-xs text-gray-600 font-normal">{periodTime.start} - {periodTime.end}</div>
                  </td>
                  {DAYS.map((_, dayIndex) => {
                    const day = dayIndex + 1;
                    const entry = getEntry(day, period);
                    
                    return (
                      <td
                        key={dayIndex}
                        onClick={() => handleCellClick(day, period)}
                        className={`px-5 py-4 border border-gray-200 cursor-pointer min-w-[180px] transition-colors ${
                          entry 
                            ? 'bg-blue-50 hover:bg-blue-100 border-blue-200' 
                            : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        {entry ? (
                          <div className="space-y-1.5">
                            <div className="font-semibold text-base text-gray-900">
                              {entry.subject}
                            </div>
                            <div className="font-medium text-sm text-gray-700">
                              {teachers.find((t) => t.id === entry.teacherId)?.name || 'Unknown'}
                            </div>
                            {entry.room && (
                              <div className="font-medium text-sm text-gray-600">
                                Room: {entry.room}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-base italic font-medium text-center py-2">
                            No class
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

