// app/api/calendar/sync/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import TimetableEntry from "@/models/TimetableEntry";
import Class from "@/models/Class";
import Teacher from "@/models/Teacher";

// Ensure models are registered
const _ensureModels = { TimetableEntry, Class, Teacher };

/**
 * POST /api/calendar/sync
 * Syncs timetable entries to Google Calendar
 * Body: { classId?: string, calendarId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const body = await request.json().catch(() => ({}));
    const { classId, calendarId } = body;

    // Note: Full Google Calendar integration requires:
    // 1. Google OAuth setup
    // 2. Calendar API credentials
    // 3. User authentication flow
    // This is a placeholder structure

    // Build query
    const query: any = {};
    if (classId) {
      query.classId = classId;
    }

    const entries = await TimetableEntry.find(query)
      .populate('classId', 'name')
      .populate('teacherId', 'name email')
      .lean();

    // Convert timetable entries to calendar events format
    const events = entries.map((entry) => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[entry.dayOfWeek] || 'Monday';
      
      // Calculate time (assuming 1 hour per period, starting at 9 AM)
      const startHour = 8 + entry.periodNumber; // 9 AM + period number
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;

      return {
        summary: `${entry.subject} - ${(entry as any).classId?.name || 'Class'}`,
        description: `Teacher: ${(entry as any).teacherId?.name || 'Unknown'}\nRoom: ${entry.room || 'TBD'}`,
        start: {
          dateTime: `2024-01-01T${startTime}:00`, // Placeholder date
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: `2024-01-01T${endTime}:00`,
          timeZone: 'Asia/Kolkata',
        },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${dayName.substring(0, 2).toUpperCase()}`],
        location: entry.room || '',
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Calendar events prepared',
      events,
      count: events.length,
      note: 'To fully sync with Google Calendar, configure OAuth and Calendar API credentials',
    });
  } catch (err: any) {
    console.error('Error syncing calendar:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calendar/sync
 * Returns calendar sync status and instructions
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    
    return NextResponse.json({
      success: true,
      message: 'Google Calendar sync endpoint',
      instructions: [
        '1. Set up Google Cloud Project',
        '2. Enable Calendar API',
        '3. Create OAuth 2.0 credentials',
        '4. Add credentials to .env.local',
        '5. Implement OAuth flow',
        '6. Use Calendar API to create events',
      ],
      envVars: [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI',
      ],
    });
  } catch (err: any) {
    console.error('Error getting calendar info:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

