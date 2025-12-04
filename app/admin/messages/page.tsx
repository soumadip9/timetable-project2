'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Reply {
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  recipientEmail?: string;
  subject: string;
  body: string;
  isBroadcast: boolean;
  recipientCount?: number; // Number of teachers who received broadcast
  createdAt: string;
  replies?: Reply[];
}

export default function AdminMessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

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
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, router]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/messages');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load messages:', response.status, errorData);
        alert(`Failed to load messages: ${errorData.error || 'Unknown error'}`);
        setMessages([]);
        return;
      }

      const data = await response.json();
      // API now filters to only return messages sent by admin
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        console.error('Invalid response format:', data);
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      alert(`Failed to load messages: ${error.message || 'Network error'}`);
      setMessages([]);
    } finally {
      setLoading(false);
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
                className="text-gray-700 hover:text-indigo-600 transition-colors font-bold text-sm"
              >
                Teachers
              </Link>
              <Link
                href="/admin/messages"
                className="text-indigo-600 font-bold border-b-3 border-indigo-600 pb-1.5 transition-colors text-sm"
              >
                Announcements
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-bold text-gray-800">
                {(session?.user as any)?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-red-600 hover:text-red-800 font-bold px-4 py-2 border-2 border-red-200 rounded-lg hover:bg-red-50 shadow-sm"
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
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Sent Announcements</h2>
          <Link
            href="/admin/teachers"
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            Send New Announcement
          </Link>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-12 text-center">
            <p className="text-xl font-bold text-gray-700">No announcements sent yet.</p>
            <p className="text-base text-gray-600 mt-2 font-semibold">Go to Teachers page to send announcements.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message._id}
                className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-gray-900">To:</span>
                      <span className="text-black font-semibold">
                        {message.isBroadcast 
                          ? `All Teachers (${message.recipientCount || 0} teachers)` 
                          : message.recipientEmail || 'Unknown'}
                      </span>
                      {message.isBroadcast && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                          Broadcast
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold text-black mb-2">{message.subject}</h3>
                    <p className="text-sm text-black whitespace-pre-wrap mb-3">{message.body}</p>
                    <div className="text-xs text-gray-500">
                      Sent: {new Date(message.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

