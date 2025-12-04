'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Teacher {
  id: string;
  userId: string;
  name: string;
  email: string;
  subject: string;
  phone: string;
  classCount?: number;
}

export default function AdminTeachersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState<Teacher | 'all' | null>(null);
  const [messageData, setMessageData] = useState({
    subject: '',
    body: '',
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subject: '',
    phone: '',
  });

  // Filter teachers based on search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(query) ||
        teacher.email.toLowerCase().includes(query) ||
        teacher.subject.toLowerCase().includes(query)
    );
  }, [teachers, searchQuery]);

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
      loadTeachers();
    }
  }, [status, session, router]);

  const loadTeachers = async () => {
    try {
      console.log('[Teachers Page] Loading teachers...');
      const response = await fetch('/api/teachers');
      if (response.ok) {
        const data = await response.json();
        console.log('[Teachers Page] Teachers loaded:', data.data?.length || 0);
        setTeachers(data.data || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Teachers Page] Failed to load teachers:', response.status, errorData);
        alert(`Failed to load teachers: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Teachers Page] Error loading teachers:', error);
      alert('Failed to load teachers. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';
      const body = editingTeacher
        ? { id: editingTeacher.id, ...formData }
        : formData;

      console.log('[Teachers Page] Submitting teacher:', method, body);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Teachers Page] Teacher saved successfully:', result);
        setShowForm(false);
        setEditingTeacher(null);
        setFormData({ name: '', email: '', password: '', subject: '', phone: '' });
        // Reload teachers list
        await loadTeachers();
        // Also use router.refresh() to ensure server state is synced
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Teachers Page] Failed to save teacher:', response.status, error);
        alert(`Failed to save teacher: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Teachers Page] Error saving teacher:', error);
      alert('Failed to save teacher. Please check the console for details.');
    }
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      email: teacher.email,
      password: '', // Don't pre-fill password
      subject: teacher.subject,
      phone: teacher.phone,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    try {
      const response = await fetch(`/api/teachers?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadTeachers();
      } else {
        alert('Failed to delete teacher');
      }
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('Failed to delete teacher');
    }
  };

  const handleMessage = (teacher: Teacher | 'all') => {
    setMessageRecipient(teacher);
    setMessageData({ subject: '', body: '' });
    setShowMessageModal(true);
  };

  const handleSendMessage = async () => {
    if (!messageData.subject.trim() || !messageData.body.trim()) {
      alert('Please fill in both subject and announcement body');
      return;
    }

    setSendingMessage(true);
    try {
      const payload: any = {
        subject: messageData.subject,
        messageBody: messageData.body,
        isBroadcast: messageRecipient === 'all',
      };

      if (messageRecipient !== 'all' && messageRecipient) {
        // For individual messages, use the teacher's userId and email
        payload.recipientId = messageRecipient.userId;
        payload.recipientEmail = messageRecipient.email;
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          messageRecipient === 'all'
            ? `Announcement sent successfully to ${result.count || teachers.length} teachers!`
            : 'Announcement sent successfully!'
        );
        setShowMessageModal(false);
        setMessageRecipient(null);
        setMessageData({ subject: '', body: '' });
      } else {
        alert(result.error || 'Failed to send announcement. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send announcement. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg font-bold text-gray-700">Loading...</div>
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
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                Admin Dashboard
              </h1>
              <Link
                href="/admin/dashboard"
                className="text-gray-700 hover:text-indigo-600 transition-colors font-bold text-sm"
              >
                Classes
              </Link>
              <Link
                href="/admin/teachers"
                className="text-indigo-600 font-bold border-b-3 border-indigo-600 pb-1.5 transition-colors text-sm"
              >
                Teachers
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-bold text-gray-800">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-red-600 hover:text-red-800 font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition-all border-2 border-red-200 shadow-sm hover:shadow-md"
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
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Manage Teachers</h2>
          <div className="flex gap-3">
            <button
              onClick={() => handleMessage('all')}
              className="px-6 py-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Announce to All
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingTeacher(null);
                setFormData({ name: '', email: '', password: '', subject: '', phone: '' });
              }}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              {showForm ? 'Cancel' : 'Create New Teacher'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search teachers by name, email, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-base font-bold text-gray-900 bg-white shadow-md hover:shadow-lg transition-all"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm font-semibold text-gray-600">
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </p>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-7 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
            <h3 className="text-xl font-extrabold mb-5 text-gray-900 tracking-tight">
              {editingTeacher ? 'Edit Teacher' : 'Create New Teacher'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg"
                  required
                />
              </div>
              {!editingTeacher && (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg"
                    required={!editingTeacher}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Phone (Optional)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg"
                />
              </div>
            </div>
            <div className="mt-5">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                {editingTeacher ? 'Update Teacher' : 'Create Teacher'}
              </button>
            </div>
          </form>
        )}

        {filteredTeachers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-12 text-center">
            <p className="text-lg font-bold text-gray-700">
              {searchQuery ? 'No teachers found matching your search.' : 'No teachers yet. Create your first teacher to get started.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Classes/Week
                  </th>
                  <th className="px-6 py-5 text-left text-sm font-extrabold text-indigo-900 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeachers.map((teacher, index) => (
                  <tr
                    key={teacher.id}
                    className={`transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-indigo-50`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {teacher.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{teacher.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1.5 text-sm font-bold rounded-full bg-indigo-100 text-indigo-800">
                        {teacher.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-600">
                      {teacher.phone || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-4 py-2 text-sm font-extrabold rounded-full bg-blue-100 text-blue-800">
                        {teacher.classCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMessage(teacher)}
                          className="px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg font-bold text-sm transition-all border-2 border-green-200 shadow-md hover:shadow-lg flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Announce
                        </button>
                        <button
                          onClick={() => handleEdit(teacher)}
                          className="px-4 py-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg font-bold text-sm transition-all border-2 border-indigo-200 shadow-md hover:shadow-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(teacher.id)}
                          className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg font-bold text-sm transition-all border-2 border-red-200 shadow-md hover:shadow-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Message Modal */}
        {showMessageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  {messageRecipient === 'all' ? 'Send Announcement to All Teachers' : `Send Announcement to ${messageRecipient?.name}`}
                </h3>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageRecipient(null);
                    setMessageData({ subject: '', body: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {messageRecipient !== 'all' && messageRecipient && (
                <div className="mb-4 p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                  <p className="text-sm font-semibold text-gray-700">
                    <span className="font-bold text-gray-900">To:</span> {messageRecipient.email}
                  </p>
                </div>
              )}
              {messageRecipient === 'all' && (
                <div className="mb-4 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <p className="text-sm font-semibold text-gray-700">
                    <span className="font-bold text-gray-900">Recipients:</span> All {teachers.length} teachers
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Subject</label>
                  <input
                    type="text"
                    value={messageData.subject}
                    onChange={(e) => setMessageData({ ...messageData, subject: e.target.value })}
                    placeholder="Enter message subject"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-base font-bold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Announcement</label>
                  <textarea
                    value={messageData.body}
                    onChange={(e) => setMessageData({ ...messageData, body: e.target.value })}
                    placeholder="Enter your announcement here..."
                    rows={8}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold text-gray-900 bg-gray-50 hover:bg-white shadow-md hover:shadow-lg transition-all resize-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageRecipient(null);
                    setMessageData({ subject: '', body: '' });
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {sendingMessage ? 'Sending...' : 'Send Announcement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

