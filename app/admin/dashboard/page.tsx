'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Class {
  id: string;
  name: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      loadClasses();
    }
  }, [status, session, router]);

  const loadClasses = async () => {
    try {
      const response = await fetch('/api/classes');
      if (response.ok) {
        const data = await response.json();
        setClasses(data.data || []);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName }),
      });

      if (response.ok) {
        setNewClassName('');
        setShowCreateForm(false);
        loadClasses();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create class');
      }
    } catch (error) {
      console.error('Error creating class:', error);
      alert('Failed to create class');
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;

    try {
      console.log('[Dashboard] Deleting class - ID:', id, 'Type:', typeof id);
      
      // Validate ID before sending
      if (!id || typeof id !== 'string') {
        console.error('[Dashboard] Invalid class ID:', id);
        alert('Invalid class ID. Please refresh the page and try again.');
        return;
      }

      const response = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Dashboard] Class deleted successfully:', result);
        // Remove from local state immediately for better UX
        setClasses(classes.filter((c) => c.id !== id));
        // Also reload to ensure sync with server
        loadClasses();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Dashboard] Failed to delete class:', response.status, errorData);
        console.error('[Dashboard] Response status:', response.status, 'Status text:', response.statusText);
        alert(`Failed to delete class: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Dashboard] Error deleting class:', error);
      alert('Failed to delete class. Please check the console for details.');
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
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                Admin Dashboard
              </h1>
              <Link
                href="/admin/dashboard"
                className="text-indigo-600 font-bold border-b-3 border-indigo-600 pb-1.5 transition-colors text-base"
              >
                Classes
              </Link>
              <Link
                href="/admin/teachers"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                Teachers
              </Link>
              <Link
                href="/admin/analytics"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                Analytics
              </Link>
              <Link
                href="/admin/messages"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                Announcements
              </Link>
              <Link
                href="/rooms"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                Rooms
              </Link>
              <Link
                href="/admin/room-assignment"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-semibold text-base"
              >
                Room Assignment
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-base font-bold text-gray-800">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-base text-red-600 hover:text-red-800 font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition-all border-2 border-red-200 shadow-sm hover:shadow-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Classes</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            {showCreateForm ? 'Cancel' : 'Create New Class'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateClass} className="mb-6 p-7 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
            <h3 className="text-2xl font-extrabold mb-5 text-gray-900 tracking-tight">Create New Class</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Class name (e.g., Class 5A)"
                className="flex-1 px-5 py-3.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg font-bold text-gray-900 shadow-md hover:shadow-lg bg-gray-50 hover:bg-white"
                required
              />
              <button
                type="submit"
                className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                Create Class
              </button>
            </div>
          </form>
        )}

        {classes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="text-gray-700 text-xl font-bold">No classes yet.</p>
              <p className="text-gray-600 text-base mt-2 font-semibold">Create your first class to get started.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classes.map((classItem, index) => (
                  <tr
                    key={classItem.id}
                    className={`transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-indigo-50`}
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <Link
                        href={`/admin/classes/${classItem.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold text-xl transition-all inline-flex items-center gap-2 hover:scale-105"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                        {classItem.name}
                      </Link>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteClass(classItem.id)}
                        className="px-4 py-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl font-bold text-base transition-all border-2 border-red-200 shadow-md hover:shadow-lg"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
