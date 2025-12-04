'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Class, Teacher, Subject, Room, Timetable } from '@/types';

export default function DashboardClient() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const router = useRouter();
  const [stats, setStats] = useState({
    classes: 0,
    teachers: 0,
    subjects: 0,
    rooms: 0,
    timetables: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const [classesRes, teachersRes, subjectsRes, roomsRes, timetablesRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/teachers'),
        fetch('/api/subjects'),
        fetch('/api/rooms'),
        fetch('/api/timetables'),
      ]);

      // Check if responses are OK and JSON
      const checkResponse = (res: Response, name: string) => {
        if (!res.ok) {
          console.error(`${name} API error:`, res.status, res.statusText);
          return null;
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`${name} API returned non-JSON:`, contentType);
          return null;
        }
        return res;
      };

      const classes = classesRes.ok ? await classesRes.json() : { success: false, data: [] };
      const teachers = teachersRes.ok ? await teachersRes.json() : { success: false, data: [] };
      const subjects = subjectsRes.ok ? await subjectsRes.json() : { success: false, data: [] };
      const rooms = roomsRes.ok ? await roomsRes.json() : { success: false, data: [] };
      const timetables = timetablesRes.ok ? await timetablesRes.json() : { success: false, timetables: [], data: [] };

      setStats({
        classes: classes.success ? classes.data?.length || 0 : (classes.teachers?.length || 0),
        teachers: teachers.success ? teachers.data?.length || 0 : (teachers.teachers?.length || 0),
        subjects: subjects.success ? subjects.data?.length || 0 : 0,
        rooms: rooms.success ? rooms.data?.length || 0 : 0,
        timetables: timetables.success ? timetables.data?.length || 0 : (timetables.timetables?.length || 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for session to load
    if (status === 'loading') {
      return;
    }
    
    // Redirect to signin if not authenticated (immediate redirect)
    if (status === 'unauthenticated') {
      console.log('🔒 [Client] Redirecting unauthenticated user to /auth/signin');
      window.location.href = '/auth/signin';
      return;
    }
    
    // Only load stats if authenticated
    if (status === 'authenticated') {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  const handleExport = async () => {
    try {
      const [classesRes, teachersRes, subjectsRes, roomsRes, timetablesRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/teachers'),
        fetch('/api/subjects'),
        fetch('/api/rooms'),
        fetch('/api/timetables'),
      ]);

      // Handle responses with error checking
      const getData = async (res: Response) => {
        if (!res.ok) {
          console.error('API error:', res.status, res.statusText);
          return [];
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Non-JSON response:', contentType);
          return [];
        }
        const data = await res.json();
        return data.success ? data.data : (data.teachers || data.timetables || []);
      };

      const [classes, teachers, subjects, rooms, timetables] = await Promise.all([
        getData(classesRes),
        getData(teachersRes),
        getData(subjectsRes),
        getData(roomsRes),
        getData(timetablesRes),
      ]);

      const data = {
        classes,
        teachers,
        subjects,
        rooms,
        timetables,
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetable-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please check the console for details.');
    }
  };

  // Show loading while checking authentication or loading data
  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect is happening)
  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Redirecting to sign in...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Timetable Management System</h1>
          <button
            onClick={handleExport}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Export JSON
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Classes" count={stats.classes} href="/classes" color="bg-blue-500" />
          <StatCard title="Teachers" count={stats.teachers} href="/teachers" color="bg-green-500" />
          <StatCard title="Subjects" count={stats.subjects} href="/subjects" color="bg-yellow-500" />
          <StatCard title="Rooms" count={stats.rooms} href="/rooms" color="bg-purple-500" />
          <StatCard title="Timetables" count={stats.timetables} href="/timetable" color="bg-red-500" />
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isAdmin ? (
              <Link
                href="/admin/classes"
                className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <h3 className="font-semibold text-gray-900">Manage Classes</h3>
                <p className="mt-1 text-sm text-gray-600">Admin: Add, edit, or delete classes</p>
              </Link>
            ) : (
              <Link
                href="/classes"
                className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <h3 className="font-semibold text-gray-900">Manage Classes</h3>
                <p className="mt-1 text-sm text-gray-600">Add, edit, or delete classes</p>
              </Link>
            )}
            <Link
              href="/teachers"
              className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            >
              <h3 className="font-semibold text-gray-900">Manage Teachers</h3>
              <p className="mt-1 text-sm text-gray-600">Add, edit, or delete teachers</p>
            </Link>
            <Link
              href="/subjects"
              className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            >
              <h3 className="font-semibold text-gray-900">Manage Subjects</h3>
              <p className="mt-1 text-sm text-gray-600">Add, edit, or delete subjects</p>
            </Link>
            <Link
              href="/rooms"
              className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            >
              <h3 className="font-semibold text-gray-900">Manage Rooms</h3>
              <p className="mt-1 text-sm text-gray-600">Add, edit, or delete rooms</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  count,
  href,
  color,
}: {
  title: string;
  count: number;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{count}</p>
        </div>
        <div className={`${color} rounded-full p-3`}>
          <div className="h-6 w-6 rounded-full bg-white opacity-20"></div>
        </div>
      </div>
    </Link>
  );
}

