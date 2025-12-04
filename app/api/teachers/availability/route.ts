// app/api/teachers/availability/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import TimetableEntry from "@/models/TimetableEntry";
import mongoose from "mongoose";

// Ensure model is registered
const _ensureModel = TimetableEntry;

/**
 * GET /api/teachers/availability?dayOfWeek=1&periodNumber=1&classId=xxx
 * Returns list of teacher IDs that are unavailable at the specified day/period
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get("dayOfWeek");
    const periodNumber = searchParams.get("periodNumber");
    const classId = searchParams.get("classId"); // Current class being edited (exclude from check)

    if (!dayOfWeek || !periodNumber) {
      return NextResponse.json(
        { error: "dayOfWeek and periodNumber are required" },
        { status: 400 }
      );
    }

    const day = parseInt(dayOfWeek, 10);
    const period = parseInt(periodNumber, 10);

    if (isNaN(day) || isNaN(period) || day < 1 || day > 6 || period < 1) {
      return NextResponse.json(
        { error: "Invalid dayOfWeek (1-6) or periodNumber (>=1)" },
        { status: 400 }
      );
    }

    // Build query - find all entries at this day/period in OTHER classes
    const query: any = {
      dayOfWeek: day,
      periodNumber: period,
    };

    // Exclude current class if provided
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      query.classId = { $ne: new mongoose.Types.ObjectId(classId) };
    }

    // Fetch all timetable entries at this time slot
    const entries = await TimetableEntry.find(query).select("teacherId").lean();

    // Extract unique teacher IDs that are unavailable
    const unavailableTeacherIds = new Set(
      entries.map((entry) => entry.teacherId.toString())
    );

    return NextResponse.json({
      unavailableTeacherIds: Array.from(unavailableTeacherIds),
      count: unavailableTeacherIds.size,
    });
  } catch (err: any) {
    console.error("Error checking teacher availability:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

