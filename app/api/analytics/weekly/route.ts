// app/api/analytics/weekly/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import TimetableEntry from "@/models/TimetableEntry";
import Teacher from "@/models/Teacher";
import Class from "@/models/Class";
import User from "@/models/User";

// Ensure models are registered
const _ensureModels = { TimetableEntry, Teacher, Class };

/**
 * GET /api/analytics/weekly
 * Returns weekly analytics data for charts
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const entries = await TimetableEntry.find({}).lean();
    const teachers = await Teacher.find({}).lean();
    const classes = await Class.find({}).lean();
    
    // Fetch all users to get teacher names
    const userIds = teachers.map((t: any) => t.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    
    // Create a map of userId -> userName for quick lookup
    const userMap: Record<string, string> = {};
    users.forEach((user: any) => {
      userMap[user._id.toString()] = user.name || 'Unknown';
    });

    // 1. Classes per day
    const classesPerDay: Record<number, number> = {};
    for (let day = 1; day <= 6; day++) {
      classesPerDay[day] = 0;
    }
    entries.forEach((entry) => {
      if (entry.dayOfWeek >= 1 && entry.dayOfWeek <= 6) {
        classesPerDay[entry.dayOfWeek]++;
      }
    });

    // 2. Teacher workload (classes per teacher per week)
    const teacherWorkload: Array<{ name: string; count: number }> = [];
    const teacherCounts: Record<string, number> = {};
    
    // Count all timetable entries for each teacher (includes all periods 1-7)
    entries.forEach((entry) => {
      // Only count valid periods (1-7, period 8 removed)
      if (entry.periodNumber >= 1 && entry.periodNumber <= 7) {
        const teacherId = entry.teacherId.toString();
        teacherCounts[teacherId] = (teacherCounts[teacherId] || 0) + 1;
      }
    });
    
    // Build workload array with all teachers (including those with 0 classes)
    teachers.forEach((teacher: any) => {
      const teacherId = teacher._id.toString();
      
      // Get name from userMap using teacher's userId
      const userIdStr = teacher.userId ? (teacher.userId.toString ? teacher.userId.toString() : String(teacher.userId)) : null;
      const teacherName = userIdStr ? (userMap[userIdStr] || 'Unknown') : 'Unknown';
      
      teacherWorkload.push({
        name: teacherName,
        count: teacherCounts[teacherId] || 0,
      });
    });
    
    // Sort by count descending (highest workload first)
    teacherWorkload.sort((a, b) => b.count - a.count);
    
    console.log('[Analytics] Teacher workload calculated:', {
      totalEntries: entries.length,
      teachersWithClasses: Object.keys(teacherCounts).length,
      top5: teacherWorkload.slice(0, 5).map(t => `${t.name}: ${t.count}`),
    });

    // 3. Subject distribution
    const subjectCounts: Record<string, number> = {};
    entries.forEach((entry) => {
      const subject = entry.subject || "Unknown";
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    const subjectDistribution = Object.entries(subjectCounts)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);

    // 4. Period utilization (updated for 7 periods only, period 8 removed)
    const periodUtilization: Record<number, number> = {};
    for (let period = 1; period <= 7; period++) {
      periodUtilization[period] = 0;
    }
    entries.forEach((entry) => {
      if (entry.periodNumber >= 1 && entry.periodNumber <= 7) {
        periodUtilization[entry.periodNumber]++;
      }
    });

    // 5. Class activity
    const classActivity: Array<{ name: string; count: number }> = [];
    const classCounts: Record<string, number> = {};
    entries.forEach((entry) => {
      const classId = entry.classId.toString();
      classCounts[classId] = (classCounts[classId] || 0) + 1;
    });
    classes.forEach((cls) => {
      classActivity.push({
        name: cls.name,
        count: classCounts[cls._id.toString()] || 0,
      });
    });
    classActivity.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: {
        classesPerDay: Object.entries(classesPerDay).map(([day, count]) => ({
          day: parseInt(day),
          dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parseInt(day) - 1],
          count,
        })),
        teacherWorkload: teacherWorkload.slice(0, 10), // Top 10
        subjectDistribution: subjectDistribution.slice(0, 10), // Top 10
        periodUtilization: Object.entries(periodUtilization).map(([period, count]) => ({
          period: parseInt(period),
          count,
        })),
        classActivity: classActivity.slice(0, 10), // Top 10
        totalEntries: entries.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
      },
    });
  } catch (err: any) {
    console.error("Error fetching weekly analytics:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}


