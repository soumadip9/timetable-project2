'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
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
      loadData();
    }
  }, [status, session, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [heatmapRes, analyticsRes] = await Promise.all([
        fetch('/api/analytics/heatmap?type=teacher'),
        fetch('/api/analytics/weekly'),
      ]);

      if (heatmapRes.ok) {
        const heatmap = await heatmapRes.json();
        setHeatmapData(heatmap.data || []);
      }

      if (analyticsRes.ok) {
        const analytics = await analyticsRes.json();
        setAnalyticsData(analytics.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading analytics...</div>
      </div>
    );
  }

  // Prepare heatmap data for visualization
  const heatmapMatrix: Record<number, Record<number, number>> = {};
  heatmapData.forEach((item) => {
    if (!heatmapMatrix[item.day]) {
      heatmapMatrix[item.day] = {};
    }
    heatmapMatrix[item.day][item.period] = item.count;
  });

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxCount = Math.max(...heatmapData.map((d) => d.count), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <Link href="/admin/dashboard" className="text-base font-semibold text-gray-700 hover:text-gray-900">
                Classes
              </Link>
              <Link href="/admin/teachers" className="text-base font-semibold text-gray-700 hover:text-gray-900">
                Teachers
              </Link>
              <Link href="/admin/analytics" className="text-base font-semibold text-indigo-600 hover:text-indigo-800">
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block text-lg font-semibold">
              ← Back to Classes
            </Link>
            <h2 className="text-4xl font-bold text-gray-900">Analytics & Visualizations</h2>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Summary Cards */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm font-medium text-gray-600">Total Classes</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.totalEntries}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm font-medium text-gray-600">Total Teachers</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.totalTeachers}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm font-medium text-gray-600">Total Classes (Groups)</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{analyticsData.totalClasses}</div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Schedule Heatmap - Busy/Free Times</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Period</th>
                  {dayNames.map((day) => (
                    <th key={day} className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map((period) => (
                  <tr key={period}>
                    <td className="px-4 py-2 font-semibold text-gray-800">Period {period}</td>
                    {[1, 2, 3, 4, 5, 6].map((day) => {
                      const count = heatmapMatrix[day]?.[period] || 0;
                      const intensity = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const bgColor = intensity > 0 
                        ? `rgba(59, 130, 246, ${Math.max(0.2, intensity / 100)})` 
                        : '#f3f4f6';
                      return (
                        <td
                          key={day}
                          className="px-4 py-3 text-center border border-gray-200"
                          style={{ backgroundColor: bgColor }}
                        >
                          <div className="font-semibold text-gray-900">{count}</div>
                          <div className="text-xs text-gray-600">{intensity.toFixed(0)}%</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>Free (0 classes)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span>Low (1-2 classes)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-400 rounded"></div>
              <span>Medium (3-5 classes)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span>High (6+ classes)</span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Classes per Day */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Classes per Day</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.classesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Period Utilization */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Period Utilization</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.periodUtilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Teachers by Workload */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Top Teachers by Workload</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.teacherWorkload}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Subject Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.subjectDistribution}
                    dataKey="count"
                    nameKey="subject"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {analyticsData.subjectDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Google Calendar Sync Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Google Calendar Sync</h3>
          <p className="text-gray-600 mb-4">
            Sync your timetable entries to Google Calendar for easy access and reminders.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Create a Google Cloud Project</li>
              <li>Enable Google Calendar API</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Add credentials to .env.local:
                <ul className="list-disc list-inside ml-6 mt-1">
                  <li>GOOGLE_CLIENT_ID</li>
                  <li>GOOGLE_CLIENT_SECRET</li>
                  <li>GOOGLE_REDIRECT_URI</li>
                </ul>
              </li>
              <li>Implement OAuth authentication flow</li>
            </ol>
          </div>

          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/calendar/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                });
                const data = await response.json();
                if (response.ok) {
                  alert(`Prepared ${data.count} calendar events. Full sync requires OAuth setup.`);
                } else {
                  alert('Error: ' + (data.error || 'Unknown error'));
                }
              } catch (error) {
                console.error('Calendar sync error:', error);
                alert('Failed to sync calendar. Check console for details.');
              }
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors"
          >
            Prepare Calendar Events
          </button>
        </div>
      </div>
    </div>
  );
}

