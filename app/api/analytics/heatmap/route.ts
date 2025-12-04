// app/api/analytics/heatmap/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import TimetableEntry from "@/models/TimetableEntry";
import Teacher from "@/models/Teacher";
import Class from "@/models/Class";

// Ensure models are registered
const _ensureModels = { TimetableEntry, Teacher, Class };

/**
 * GET /api/analytics/heatmap?type=teacher|class|room
 * Returns heatmap data showing busy/free times
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "teacher"; // teacher, class, or room

    // Get all timetable entries
    const entries = await TimetableEntry.find({}).lean();

    // Initialize heatmap data structure
    // days: 1-6 (Mon-Sat), periods: 1-8
    const heatmapData: Record<number, Record<number, number>> = {};
    for (let day = 1; day <= 6; day++) {
      heatmapData[day] = {};
      for (let period = 1; period <= 8; period++) {
        heatmapData[day][period] = 0;
      }
    }

    // Count entries per time slot
    for (const entry of entries) {
      const day = entry.dayOfWeek;
      const period = entry.periodNumber;
      if (day >= 1 && day <= 6 && period >= 1 && period <= 8) {
        heatmapData[day][period]++;
      }
    }

    // Convert to array format for frontend
    const heatmapArray: Array<{ day: number; dayName: string; period: number; count: number; percentage: number }> = [];
    const maxCount = Math.max(...Object.values(heatmapData).flatMap(d => Object.values(d)));

    for (let day = 1; day <= 6; day++) {
      const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (let period = 1; period <= 8; period++) {
        const count = heatmapData[day][period];
        heatmapArray.push({
          day,
          dayName: dayNames[day - 1],
          period,
          count,
          percentage: maxCount > 0 ? (count / maxCount) * 100 : 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: heatmapArray,
      maxCount,
      type,
    });
  } catch (err: any) {
    console.error("Error fetching heatmap data:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

