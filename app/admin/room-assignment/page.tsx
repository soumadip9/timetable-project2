'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Class {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  building: string;
}

interface RoomAssignment {
  classId: string;
  className: string;
  classRoom: string;
  labSubjectRoomMap: Record<string, string>;
}

interface ClassWithSubjects extends Class {
  subjects?: string[];
}

export default function RoomAssignmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<ClassWithSubjects | null>(null);
  const [assignment, setAssignment] = useState<RoomAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      
      // Load last selected class from localStorage if available
      const savedClassId = localStorage.getItem('room-assignment-selected-class');
      if (savedClassId) {
        // Small delay to ensure classes are loaded first
        setTimeout(() => {
          handleClassChange(savedClassId);
        }, 100);
      }
    }
  }, [status, session, router]);

  const loadData = async () => {
    try {
      const [classesRes, roomsRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/rooms'),
      ]);

      if (classesRes.ok) {
        const classesData = await classesRes.json();
        setClasses(classesData.data || []);
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    
    // Save selected class to localStorage for persistence
    if (classId) {
      localStorage.setItem('room-assignment-selected-class', classId);
    } else {
      localStorage.removeItem('room-assignment-selected-class');
    }
    
    const selected = classes.find((c) => c.id === classId);
    
    if (!classId) {
      setSelectedClass(null);
      setAssignment(null);
      return;
    }

    try {
      // Fetch class details with subjects
      const classResponse = await fetch(`/api/classes/${classId}`);
      let classWithSubjects: ClassWithSubjects | null = null;
      
      if (classResponse.ok) {
        const classData = await classResponse.json();
        if (classData.success && classData.data) {
          classWithSubjects = {
            ...selected,
            ...classData.data,
            subjects: classData.data.subjects || [],
          } as ClassWithSubjects;
        }
      }
      
      setSelectedClass(classWithSubjects || selected || null);

      // Fetch room assignment - always try to load saved data first
      const assignmentResponse = await fetch(`/api/classes/${classId}/room-assignment`);
      if (assignmentResponse.ok) {
        const data = await assignmentResponse.json();
        if (data.success && data.data) {
          console.log('[Room Assignment] Loaded saved assignment:', data.data);
          // Use the data from server, ensuring labSubjectRoomMap is properly initialized
          const loadedAssignment: RoomAssignment = {
            classId: data.data.classId || classId,
            className: data.data.className || selected?.name || classWithSubjects?.name || '',
            classRoom: data.data.classRoom || '',
            labSubjectRoomMap: data.data.labSubjectRoomMap || {},
          };
          setAssignment(loadedAssignment);
          console.log('[Room Assignment] Set assignment state:', loadedAssignment);
        } else {
          // Initialize empty assignment if response format is unexpected
          const emptyAssignment: RoomAssignment = {
            classId,
            className: selected?.name || classWithSubjects?.name || '',
            classRoom: '',
            labSubjectRoomMap: {},
          };
          setAssignment(emptyAssignment);
          console.log('[Room Assignment] Initialized empty assignment');
        }
      } else {
        // Initialize empty assignment if not found (404) or other error
        const errorData = await assignmentResponse.json().catch(() => ({}));
        console.log('[Room Assignment] No saved assignment found, initializing empty:', errorData);
        const emptyAssignment: RoomAssignment = {
          classId,
          className: selected?.name || classWithSubjects?.name || '',
          classRoom: '',
          labSubjectRoomMap: {},
        };
        setAssignment(emptyAssignment);
      }
    } catch (error) {
      console.error('Error loading class or room assignment:', error);
      setSelectedClass(selected || null);
      // Initialize with empty assignment on error
      const emptyAssignment: RoomAssignment = {
        classId,
        className: selected?.name || '',
        classRoom: '',
        labSubjectRoomMap: {},
      };
      setAssignment(emptyAssignment);
    }
  };

  const handleSave = async () => {
    if (!selectedClassId || !assignment) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/classes/${selectedClassId}/room-assignment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classRoom: assignment.classRoom,
          labSubjectRoomMap: assignment.labSubjectRoomMap,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Update assignment with the saved data from server
          setAssignment(result.data);
          alert('Room assignment saved successfully!');
        } else {
          alert('Room assignment saved, but there was an issue loading the response.');
          // Reload the assignment to ensure we have the latest data
          handleClassChange(selectedClassId);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save room assignment');
      }
    } catch (error) {
      console.error('Error saving room assignment:', error);
      alert('Failed to save room assignment');
    } finally {
      setSaving(false);
    }
  };

  const updateClassRoom = (roomName: string) => {
    if (!assignment) return;
    setAssignment({ ...assignment, classRoom: roomName });
  };

  const updateLabRoom = (subject: string, roomName: string) => {
    if (!assignment) return;
    const newLabMap = { ...assignment.labSubjectRoomMap };
    if (roomName) {
      newLabMap[subject] = roomName;
    } else {
      delete newLabMap[subject];
    }
    setAssignment({ ...assignment, labSubjectRoomMap: newLabMap });
  };

  // Helper function to identify lab subjects
  const isLabSubject = (subject: string): boolean => {
    return subject.trim().toLowerCase().endsWith('lab');
  };

  // Get lab subjects from the selected class's subjects list
  const labSubjects = selectedClass?.subjects?.filter((subj) => isLabSubject(subj)) || [];
  
  // Also include any lab subjects that are already in the assignment map but not in subjects list
  if (assignment?.labSubjectRoomMap) {
    const assignedLabSubjects = Object.keys(assignment.labSubjectRoomMap);
    assignedLabSubjects.forEach((subj) => {
      if (isLabSubject(subj) && !labSubjects.includes(subj)) {
        labSubjects.push(subj);
      }
    });
  }

  const normalRooms = rooms.filter((room) => {
    const roomName = room.name.toLowerCase();
    return !roomName.includes('lab');
  });

  const labRooms = rooms.filter((room) => {
    const roomName = room.name.toLowerCase();
    return roomName.includes('lab');
  });

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
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                Room Assignment
              </h1>
              <Link
                href="/admin/dashboard"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-base font-bold text-gray-800">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-8">
          {/* Class Selection */}
          <div className="mb-8">
            <label className="block text-xl font-bold text-gray-900 mb-3">
              Select Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full max-w-md px-5 py-3.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold text-gray-900 bg-gray-50 hover:bg-white transition-all shadow-md"
            >
              <option value="">-- Select a Class --</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          {selectedClass && assignment && (
            <>
              <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border-2 border-indigo-200">
                <h2 className="text-2xl font-extrabold text-gray-900 mb-6">
                  Room Assignment for {assignment.className}
                </h2>

                {/* Normal Class Room Assignment */}
                <div className="mb-8">
                  <label className="block text-lg font-bold text-gray-900 mb-3">
                    Class Room (for Normal Subjects)
                  </label>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a room that will be used for all normal (non-lab) subjects in this class.
                  </p>
                  <select
                    value={assignment.classRoom}
                    onChange={(e) => updateClassRoom(e.target.value)}
                    className="w-full max-w-md px-5 py-3.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold text-gray-900 bg-white shadow-md"
                  >
                    <option value="">-- Select Room --</option>
                    {normalRooms.map((room) => (
                      <option key={room.id} value={room.name}>
                        {room.name} ({room.building})
                      </option>
                    ))}
                  </select>
                  {assignment.classRoom && (
                    <p className="mt-2 text-sm text-green-600 font-semibold">
                      ✓ Assigned: {assignment.classRoom}
                    </p>
                  )}
                </div>

                {/* Lab Subject Room Assignment */}
                <div className="mb-8">
                  <label className="block text-lg font-bold text-gray-900 mb-3">
                    Lab Subject Room Assignments
                  </label>
                  <p className="text-sm text-gray-600 mb-4">
                    Assign specific lab rooms for each lab subject.
                  </p>

                  <div className="space-y-4">
                    {labSubjects.length === 0 ? (
                      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <p className="text-sm font-semibold text-blue-700">
                          No lab subjects found for this class. Add lab subjects (e.g., "Physics Lab", "Chemistry Lab") to the class subjects list first.
                        </p>
                      </div>
                    ) : (
                      labSubjects.map((subject) => {
                      const assignedRoom = assignment.labSubjectRoomMap[subject] || '';
                      return (
                        <div key={subject} className="flex items-center gap-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                          <label className="flex-1 text-base font-semibold text-gray-900 min-w-[200px]">
                            {subject}:
                          </label>
                          <select
                            value={assignedRoom || ''}
                            onChange={(e) => updateLabRoom(subject, e.target.value)}
                            className="flex-1 max-w-md px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-semibold text-gray-900 bg-white"
                          >
                            <option value="">-- Select Lab Room --</option>
                            {labRooms.map((room) => (
                              <option key={room.id} value={room.name}>
                                {room.name} ({room.building})
                              </option>
                            ))}
                          </select>
                          {assignedRoom && (
                            <span className="text-sm text-green-600 font-semibold">
                              ✓ {assignedRoom}
                            </span>
                          )}
                        </div>
                      );
                      })
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 flex gap-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Room Assignment'}
                  </button>
                  <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="px-8 py-3.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-bold text-base shadow-md hover:shadow-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}

          {!selectedClass && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-lg font-semibold">Please select a class to assign rooms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

