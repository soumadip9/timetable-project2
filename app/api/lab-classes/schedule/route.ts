// app/api/lab-classes/schedule/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import Class from "@/models/Class";
import Teacher from "@/models/Teacher";
import TimetableEntry from "@/models/TimetableEntry";
import mongoose from "mongoose";

// Ensure all models are registered
const _ensureModels = { Class, Teacher, TimetableEntry };

/**
 * POST /api/lab-classes/schedule
 * Schedule lab classes for Physics, Chemistry, and Computer Science
 * Each lab class takes 2 consecutive periods
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin authentication
    try {
      await requireAdmin(req);
    } catch {
      console.error("[API] POST /api/lab-classes/schedule - Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json().catch(() => ({} as any));
    const {
      classId, // Optional: specific class to schedule labs for
      days = [1, 2, 3, 4, 5, 6], // Days to schedule (1=Monday, 6=Saturday)
      preferredPeriods = [6, 7], // Preferred consecutive periods (e.g., [6,7] or [7,8])
      subjects = ["Physics", "Chemistry", "Computer Science"], // Lab subjects
    } = body;

    // Lab subjects mapping
    const labSubjects = subjects || ["Physics", "Chemistry", "Computer Science"];

    // Get all classes if classId not specified
    let classes;
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
      }
      const klass = await Class.findById(classId);
      if (!klass) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }
      classes = [klass];
    } else {
      classes = await Class.find({});
    }

    if (classes.length === 0) {
      return NextResponse.json({ error: "No classes found" }, { status: 404 });
    }

    // Fetch all teachers
    const allTeachers = await Teacher.find({}).populate("userId", "name email").lean();

    // Build teacher availability cache for all classes
    const teacherScheduleCache: Record<string, Record<number, Set<number>>> = {};

    // Get all timetable entries for availability checking
    const allEntries = await TimetableEntry.find({}).lean();

    for (const entry of allEntries) {
      const teacherIdStr = entry.teacherId.toString();
      const day = entry.dayOfWeek;
      const period = entry.periodNumber;

      if (!teacherScheduleCache[teacherIdStr]) {
        teacherScheduleCache[teacherIdStr] = {};
      }
      if (!teacherScheduleCache[teacherIdStr][day]) {
        teacherScheduleCache[teacherIdStr][day] = new Set();
      }
      teacherScheduleCache[teacherIdStr][day].add(period);
    }

    // Helper to check if teacher is available for consecutive periods
    const isTeacherAvailableForPeriods = (
      teacherId: string,
      day: number,
      periods: number[]
    ): boolean => {
      const teacherIdStr = teacherId.toString();
      if (!teacherScheduleCache[teacherIdStr]) {
        return true; // No schedule, teacher is available
      }
      if (!teacherScheduleCache[teacherIdStr][day]) {
        return true; // No classes on this day, teacher is available
      }
      const occupiedPeriods = teacherScheduleCache[teacherIdStr][day];
      // Check if any of the required periods are already occupied
      return periods.every((period) => !occupiedPeriods.has(period));
    };

    // Helper to find available teacher for a lab subject
    const findAvailableLabTeacher = (
      subject: string,
      day: number,
      periods: number[]
    ): { teacher: any | null; note: string } => {
      // First, try to find teachers with matching specialization
      const matchingTeachers = allTeachers.filter((t) => 
        t.subject && t.subject.toLowerCase().trim() === subject.toLowerCase().trim()
      );

      // Try matching teachers first
      for (const teacher of matchingTeachers) {
        const teacherIdStr = teacher._id.toString();
        if (isTeacherAvailableForPeriods(teacherIdStr, day, periods)) {
          const teacherName = (teacher.userId as any)?.name || teacher._id.toString();
          return {
            teacher,
            note: `Lab teacher "${teacherName}" (${teacher.subject}) is available`,
          };
        }
      }

      // If no matching teacher is available, try any available teacher
      for (const teacher of allTeachers) {
        const teacherIdStr = teacher._id.toString();
        if (isTeacherAvailableForPeriods(teacherIdStr, day, periods)) {
          const teacherName = (teacher.userId as any)?.name || teacher._id.toString();
          return {
            teacher,
            note: `Fallback teacher "${teacherName}" (${teacher.subject}) is available`,
          };
        }
      }

      return {
        teacher: null,
        note: `No teacher available for ${subject} lab on day ${day}, periods ${periods.join(", ")}`,
      };
    };

    const results = {
      scheduled: [] as Array<{
        classId: string;
        className: string;
        subject: string;
        day: number;
        periods: number[];
        teacherId: string;
        teacherName: string;
      }>,
      skipped: [] as Array<{
        classId: string;
        className: string;
        subject: string;
        day: number;
        periods: number[];
        reason: string;
      }>,
    };

    // Schedule lab classes for each class
    for (const klass of classes) {
      const classIdStr = klass._id.toString();
      const labSubjectsToAdd = new Set<string>(); // Track which lab subjects were successfully scheduled

      // Schedule each lab subject once per week (one day)
      for (const labSubject of labSubjects) {
        let scheduled = false;

        // Try each day
        for (const day of days) {
          if (scheduled) break;

          // Try preferred periods first, then try all possible consecutive pairs
          const periodPairs = preferredPeriods.length === 2 && preferredPeriods[1] === preferredPeriods[0] + 1
            ? [preferredPeriods]
            : [
                ...(preferredPeriods.length === 2 && preferredPeriods[1] === preferredPeriods[0] + 1 
                  ? [preferredPeriods] 
                  : []),
                [6, 7], [7, 8], [5, 6], [4, 5], [3, 4], [2, 3], [1, 2], // Try different consecutive pairs
              ];

          for (const periods of periodPairs) {
            // Check if periods are consecutive
            if (periods.length !== 2 || periods[1] !== periods[0] + 1) {
              continue;
            }

            // Check if lab entries already exist for this class/subject/day
            const existingLab = await TimetableEntry.findOne({
              classId: new mongoose.Types.ObjectId(classIdStr),
              dayOfWeek: day,
              periodNumber: periods[0],
              subject: { $regex: new RegExp(`^${labSubject}`, "i") },
            });

            if (existingLab) {
              console.log(
                `[Lab] Lab for ${labSubject} already exists for class ${klass.name} on day ${day}, period ${periods[0]}`
              );
              continue; // Skip if already scheduled
            }

            // Find available teacher
            const teacherResult = findAvailableLabTeacher(labSubject, day, periods);

            if (!teacherResult.teacher) {
              console.warn(
                `[Lab] Could not find available teacher for ${labSubject} lab for class ${klass.name} on day ${day}, periods ${periods.join("-")}`
              );
              continue;
            }

            const teacher = teacherResult.teacher;
            const teacherIdStr = teacher._id.toString();
            const teacherName = (teacher.userId as any)?.name || teacher._id.toString();

            // Create entries for both consecutive periods
            const entriesToInsert = periods.map((period: number) => ({
              classId: new mongoose.Types.ObjectId(classIdStr),
              teacherId: new mongoose.Types.ObjectId(teacherIdStr),
              dayOfWeek: day,
              periodNumber: period,
              subject: `${labSubject} Lab`,
              room: (teacher as any).room || `Lab Room`,
            }));

            try {
              // Delete any existing entries for these periods (cleanup)
              await TimetableEntry.deleteMany({
                classId: new mongoose.Types.ObjectId(classIdStr),
                dayOfWeek: day,
                periodNumber: { $in: periods },
              });

              // Insert new lab entries
              await TimetableEntry.insertMany(entriesToInsert);

              // Update teacher schedule cache
              if (!teacherScheduleCache[teacherIdStr]) {
                teacherScheduleCache[teacherIdStr] = {};
              }
              if (!teacherScheduleCache[teacherIdStr][day]) {
                teacherScheduleCache[teacherIdStr][day] = new Set();
              }
              periods.forEach((period: number) => {
                teacherScheduleCache[teacherIdStr][day].add(period);
              });

              results.scheduled.push({
                classId: classIdStr,
                className: klass.name,
                subject: labSubject,
                day,
                periods,
                teacherId: teacherIdStr,
                teacherName: teacherName,
              });

              console.log(
                `[Lab] ✓ Scheduled ${labSubject} Lab for class ${klass.name} on day ${day}, periods ${periods.join("-")}, teacher: ${teacherName}`
              );

              // Track that this lab subject was scheduled
              labSubjectsToAdd.add(`${labSubject} Lab`);
              
              scheduled = true;
              break; // Move to next subject
            } catch (error: any) {
              console.error(
                `[Lab] Error scheduling ${labSubject} lab for class ${klass.name}:`,
                error
              );
              results.skipped.push({
                classId: classIdStr,
                className: klass.name,
                subject: labSubject,
                day,
                periods,
                reason: error.message || "Database error",
              });
            }
          }
        }

        if (!scheduled) {
          results.skipped.push({
            classId: classIdStr,
            className: klass.name,
            subject: labSubject,
            day: 0,
            periods: [],
            reason: "Could not find available time slot or teacher",
          });
        }
      }

      // Update the class's subjects list to include the scheduled lab subjects
      if (labSubjectsToAdd.size > 0) {
        try {
          // klass is already a Mongoose document (not lean), so we can update it directly
          const currentSubjects = klass.subjects || [];
          const updatedSubjects = [...currentSubjects];
          
          // Add lab subjects that aren't already in the list
          labSubjectsToAdd.forEach((labSubject: string) => {
            if (!updatedSubjects.includes(labSubject)) {
              updatedSubjects.push(labSubject);
            }
          });
          
          klass.subjects = updatedSubjects;
          await klass.save();
          
          console.log(
            `[Lab] ✓ Updated subjects list for class ${klass.name}: Added ${Array.from(labSubjectsToAdd).join(", ")}`
          );
        } catch (error: any) {
          console.error(
            `[Lab] Error updating subjects list for class ${klass.name}:`,
            error
          );
          // Don't fail the entire operation if subject list update fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scheduled ${results.scheduled.length} lab classes, skipped ${results.skipped.length}`,
      results,
    });
  } catch (err: any) {
    console.error("lab-classes/schedule error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

