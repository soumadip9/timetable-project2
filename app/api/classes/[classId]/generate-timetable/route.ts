// app/api/classes/[classId]/generate-timetable/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth-helpers";
import Class from "@/models/Class";
import Teacher from "@/models/Teacher";
import TimetableEntry from "@/models/TimetableEntry";
import Room from "@/models/Room";
import mongoose from "mongoose";

// Ensure all models are registered
const _ensureModels = { Class, Teacher, TimetableEntry };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> | { classId: string } }
) {
  try {
    // Require admin authentication
    try {
      await requireAdmin(req);
    } catch {
      console.error("[API] POST /api/classes/[classId]/generate-timetable - Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const classId = resolvedParams.classId;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as any));
    /**
     * Expected body:
     * {
     *   subjects: string[], // ["Math","English"]
     *   subjectTeacherMap: { "Math": "teacherId1", ... }  // teacherId optional
     *   periodsPerDay?: number (default 7)
     *   days?: number[] (default [1..6])
     *   dayPeriodLimits?: { [dayOfWeek]: number } // e.g., { 1: 7, 2: 6, 3: 7 }
     *   assignmentStrategy?: "roundrobin" | "random"
     *   maxPeriodsPerDay?: number
     *   maxPeriodsPerWeek?: number
     *   avoidConsecutive?: boolean
     *   subjectFrequency?: { subject: string; maxPerWeek: number }[]
     * }
     */
    const {
      subjects = [],
      subjectTeacherMap = {},
      periodsPerDay = 7,
      days = [1, 2, 3, 4, 5, 6],
      dayPeriodLimits = {},
      assignmentStrategy = "roundrobin",
      maxPeriodsPerDay,
      maxPeriodsPerWeek,
      avoidConsecutive = false,
      subjectFrequency = [],
    } = body;

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json({ error: "subjects required" }, { status: 400 });
    }

    // Fetch class with room assignments - don't use lean() to get Mongoose document with proper Map handling
    const klass = await Class.findById(classId);
    if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Get assigned rooms from Class model
    const classRoom = klass.classRoom || '';
    
    // Get lab subject room mapping - Mixed type (plain object)
    let labSubjectRoomMap: Record<string, string> = {};
    
    if (klass.labSubjectRoomMap) {
      const mapValue = klass.labSubjectRoomMap as any;
      
      if (mapValue && typeof mapValue === 'object') {
        // Handle both plain objects and Mongoose subdocuments
        if (mapValue.toObject && typeof mapValue.toObject === 'function') {
          labSubjectRoomMap = mapValue.toObject();
        } else if (mapValue && typeof mapValue.get === 'function') {
          // If it's still a Map (legacy), convert it
          const keys = Array.from(mapValue.keys() || []);
          keys.forEach((key: string) => {
            const value = mapValue.get(key);
            if (value) {
              labSubjectRoomMap[key] = value;
            }
          });
        } else {
          // Plain object - use directly
          Object.keys(mapValue).forEach((key: string) => {
            if (mapValue[key]) {
              labSubjectRoomMap[key] = mapValue[key];
            }
          });
        }
      }
    }
    
    console.log(`[Generator] ========== ROOM ASSIGNMENT FOR CLASS: ${klass.name} ==========`);
    console.log(`[Generator] Assigned class room: "${classRoom}"`);
    console.log(`[Generator] Lab subject room assignments:`, JSON.stringify(labSubjectRoomMap, null, 2));
    console.log(`[Generator] ============================================================`);
    
    // Validate that class room is assigned - REQUIRED for timetable generation
    if (!classRoom || classRoom.trim() === '') {
      return NextResponse.json(
        { 
          error: "Class room not assigned", 
          message: `Please assign a class room for "${klass.name}" before generating the timetable. Go to Room Assignment page to assign rooms.`
        },
        { status: 400 }
      );
    }
    
    // Use the assigned class room - NO FALLBACK to random rooms
    const assignedClassRoom = classRoom.trim();

    // Fetch all teachers for availability checking (use lean for consistency)
    const allTeachers = await Teacher.find({}).lean();
    
    // Build a map subject -> assigned teacher object (or null)
    // Use lean objects for consistency
    const subjectAssignedTeacher: Record<string, any | null> = {};
    for (const subj of subjects) {
      const tid = subjectTeacherMap[subj];
      if (tid && mongoose.Types.ObjectId.isValid(tid)) {
        // Find teacher in lean array for consistency
        const teacher = allTeachers.find((t) => t._id.toString() === tid.toString());
        subjectAssignedTeacher[subj] = teacher || null;
      } else {
        subjectAssignedTeacher[subj] = null;
      }
    }
    
    // Helper function to extract base subject from lab subjects
    // e.g., "Physics Lab" -> "Physics", "Chemistry Lab" -> "Chemistry"
    const getBaseSubject = (subject: string): string => {
      const trimmed = subject.trim();
      // If it ends with "Lab" (case insensitive), remove it and return base subject
      if (trimmed.toLowerCase().endsWith('lab')) {
        return trimmed.slice(0, -3).trim(); // Remove "Lab" (3 chars) and trim
      }
      return trimmed;
    };

    // For subjects without assigned teacher, try to find teacher(s) with matching specialization
    for (const subj of subjects) {
      if (!subjectAssignedTeacher[subj]) {
        // Get base subject (e.g., "Physics" from "Physics Lab")
        const baseSubject = getBaseSubject(subj);
        
        // Find teachers matching the base subject
        const pool = allTeachers.filter((t) => {
          const teacherSubject = (t.subject || '').trim();
          return teacherSubject === baseSubject || teacherSubject === subj;
        });
        
        if (pool.length > 0) {
          subjectAssignedTeacher[subj] = pool[Math.floor(Math.random() * pool.length)];
          console.log(`[Generator] Auto-assigned teacher for "${subj}": ${subjectAssignedTeacher[subj].name} (specialization: ${subjectAssignedTeacher[subj].subject})`);
        } else {
          // final fallback: any teacher
          subjectAssignedTeacher[subj] = allTeachers[0] || null;
          console.log(`[Generator] No matching teacher found for "${subj}", using fallback: ${subjectAssignedTeacher[subj]?.name || 'none'}`);
        }
      }
    }

    // Delete old entries for this class
    const deleted = await TimetableEntry.deleteMany({ 
      classId: new mongoose.Types.ObjectId(classId) 
    });
    console.log("[Generator] deleted old entries:", deleted.deletedCount);

    // Build teacher availability cache - fetch all timetable entries for all other classes
    // teacherScheduleCache[teacherId][day] = Set(periodNumbers)
    const teacherScheduleCache: Record<string, Record<number, Set<number>>> = {};
    
    // Get all teachers that might be used
    const allTeacherIds = new Set<string>();
    Object.values(subjectAssignedTeacher).forEach((teacher) => {
      if (teacher && teacher._id) {
        allTeacherIds.add(teacher._id.toString());
      }
    });
    
    // Fetch all timetable entries for these teachers in OTHER classes
    if (allTeacherIds.size > 0) {
      const existingEntries = await TimetableEntry.find({
        teacherId: { $in: Array.from(allTeacherIds).map(id => new mongoose.Types.ObjectId(id)) },
        classId: { $ne: new mongoose.Types.ObjectId(classId) }, // Exclude current class
      }).lean();
      
      // Build cache
      for (const entry of existingEntries) {
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
      
      // Log detailed cache information
      console.log(`[Generator] Built availability cache for ${Object.keys(teacherScheduleCache).length} teachers`);
      for (const [teacherId, schedule] of Object.entries(teacherScheduleCache)) {
        const teacher = allTeachers.find((t) => t._id.toString() === teacherId);
        const teacherName = teacher?.name || teacherId;
        const totalConflicts = Object.values(schedule).reduce((sum, periods) => sum + periods.size, 0);
        if (totalConflicts > 0) {
          const scheduleStr = Object.entries(schedule)
            .map(([day, periods]) => {
              const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(day) - 1] || `Day${day}`;
              return `${dayName}: P${Array.from(periods).sort((a, b) => a - b).join(", P")}`;
            })
            .join(" | ");
          console.log(
            `[Generator] Teacher "${teacherName}" has ${totalConflicts} existing classes: ${scheduleStr}`
          );
        }
      }
    }

    // Helper function to check if teacher is available at day/period
    const isTeacherAvailable = (teacherId: string, day: number, period: number): boolean => {
      const teacherIdStr = teacherId.toString();
      if (!teacherScheduleCache[teacherIdStr]) {
        return true; // No existing schedule, teacher is available
      }
      if (!teacherScheduleCache[teacherIdStr][day]) {
        return true; // No classes on this day, teacher is available
      }
      return !teacherScheduleCache[teacherIdStr][day].has(period); // Check if period is free
    };

    // Helper function to find available teacher for subject
    const findAvailableTeacher = (
      subject: string,
      day: number,
      period: number,
      logContext?: { dayName: string; period: number }
    ): { teacher: any | null; note: string } => {
      const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day - 1] || `Day${day}`;
      const slotInfo = `${dayName} Period ${period}`;
      
      // First, try the assigned teacher if available
      const assignedTeacher = subjectAssignedTeacher[subject];
      if (assignedTeacher && assignedTeacher._id) {
        const teacherIdStr = assignedTeacher._id.toString();
        const available = isTeacherAvailable(teacherIdStr, day, period);
        
        if (available) {
          console.log(
            `[Generator] ✓ ${slotInfo} | Subject: ${subject} | Assigned teacher "${assignedTeacher.name}" is AVAILABLE`
          );
          return { teacher: assignedTeacher, note: `Assigned teacher "${assignedTeacher.name}" is available` };
        } else {
          // Check what conflict exists
          const conflicts = teacherScheduleCache[teacherIdStr]?.[day] 
            ? Array.from(teacherScheduleCache[teacherIdStr][day]).join(", ")
            : "none";
          console.log(
            `[Generator] ✗ ${slotInfo} | Subject: ${subject} | Assigned teacher "${assignedTeacher.name}" is UNAVAILABLE (already teaching at period(s): ${conflicts})`
          );
        }
      }
      
      // Helper function to extract base subject from lab subjects
      const getBaseSubjectForMatching = (subj: string): string => {
        const trimmed = subj.trim();
        if (trimmed.toLowerCase().endsWith('lab')) {
          return trimmed.slice(0, -3).trim(); // Remove "Lab" and trim
        }
        return trimmed;
      };

      // Try subject-specialist teachers
      // For lab subjects (e.g., "Physics Lab"), match with base subject teachers (e.g., "Physics")
      const baseSubject = getBaseSubjectForMatching(subject);
      const specialistTeachers = allTeachers.filter((t) => {
        const teacherSubject = (t.subject || '').trim();
        // Match if teacher's subject equals the base subject or the full subject name
        return teacherSubject === baseSubject || teacherSubject === subject;
      });
      
      for (const teacher of specialistTeachers) {
        const teacherIdStr = teacher._id.toString();
        // Skip if this is the same as assigned teacher (already checked)
        if (assignedTeacher && teacherIdStr === assignedTeacher._id.toString()) {
          continue;
        }
        
        const available = isTeacherAvailable(teacherIdStr, day, period);
        if (available) {
          console.log(
            `[Generator] ✓ ${slotInfo} | Subject: ${subject} | Fallback to specialist "${teacher.name}" (specialization: ${teacher.subject}, assigned teacher was unavailable)`
          );
          return {
            teacher,
            note: `Fallback to specialist "${teacher.name}" (specialization: ${teacher.subject}, assigned teacher was unavailable)`,
          };
        } else {
          const conflicts = teacherScheduleCache[teacherIdStr]?.[day]
            ? Array.from(teacherScheduleCache[teacherIdStr][day]).join(", ")
            : "none";
          console.log(
            `[Generator] ✗ ${slotInfo} | Subject: ${subject} | Specialist "${teacher.name}" (specialization: ${teacher.subject}) is UNAVAILABLE (already teaching at period(s): ${conflicts})`
          );
        }
      }
      
      // Fallback: any available teacher
      for (const teacher of allTeachers) {
        const teacherIdStr = teacher._id.toString();
        // Skip if already checked
        if (assignedTeacher && teacherIdStr === assignedTeacher._id.toString()) {
          continue;
        }
        if (specialistTeachers.some((t) => t._id.toString() === teacherIdStr)) {
          continue;
        }
        
        const available = isTeacherAvailable(teacherIdStr, day, period);
        if (available) {
          console.log(
            `[Generator] ✓ ${slotInfo} | Subject: ${subject} | Fallback to any available teacher "${teacher.name}" (specialists were unavailable)`
          );
          return {
            teacher,
            note: `Fallback to any available teacher "${teacher.name}" (specialists were unavailable)`,
          };
        }
      }
      
      console.error(
        `[Generator] ✗✗ ${slotInfo} | Subject: ${subject} | NO TEACHER AVAILABLE - All teachers have conflicts at this time`
      );
      return { teacher: null, note: "No teacher available - all have conflicts at this time" };
    };

    const entriesToInsert: any[] = [];
    let rrIndex = 0;
    let assignedSlots = 0;
    let skippedDueToUnavailability = 0;
    
    // Build subject frequency limit map for easy lookup
    // Normalize subject names (trim whitespace) for consistent matching
    const subjectFrequencyMap: Record<string, number> = {};
    if (Array.isArray(subjectFrequency) && subjectFrequency.length > 0) {
      for (const item of subjectFrequency) {
        // Handle both string and number types for maxPerWeek (frontend sends as number, but be safe)
        const maxPerWeekValue = typeof item.maxPerWeek === 'string' 
          ? parseInt(item.maxPerWeek, 10) 
          : (typeof item.maxPerWeek === 'number' ? item.maxPerWeek : 0);
        
        if (item.subject && maxPerWeekValue > 0) {
          const normalizedSubject = item.subject.trim();
          subjectFrequencyMap[normalizedSubject] = maxPerWeekValue;
          console.log(`[Generator] Frequency limit set: "${normalizedSubject}" = ${maxPerWeekValue} per week`);
        }
      }
      console.log(`[Generator] Subject frequency limits configured:`, JSON.stringify(subjectFrequencyMap, null, 2));
      console.log(`[Generator] Available subjects for this class:`, subjects.map(s => `"${s.trim()}"`).join(", "));
      
      // Validate: Check if all subjects with limits exist in the subjects array
      for (const [subjectName, limit] of Object.entries(subjectFrequencyMap)) {
        const exists = subjects.some(s => s.trim() === subjectName);
        if (!exists) {
          console.warn(`[Generator] ⚠ WARNING: Frequency limit set for "${subjectName}" but subject not in subjects list!`);
        }
      }
    }
    
    // Track subjects used per period across all days to prevent same-period repetition
    const subjectsUsedPerPeriod: Record<number, string[]> = {};
    for (let period = 1; period <= 7; period++) {
      subjectsUsedPerPeriod[period] = [];
    }
    
    // Track total subject counts per week (across all days) for frequency limiting
    // Use normalized (trimmed) subject names for consistency
    const subjectCountsPerWeek: Record<string, number> = {};
    subjects.forEach((s) => {
      const normalized = s.trim();
      subjectCountsPerWeek[normalized] = 0;
    });

    for (const day of days) {
      // Use day-specific period limit if provided, otherwise use default periodsPerDay
      const maxPeriodsForDay = dayPeriodLimits[day] || periodsPerDay;
      
      // Skip if maxPeriodsForDay is 0 (day off)
      if (maxPeriodsForDay === 0) {
        continue;
      }
      
      // Track subject usage for this day
      const subjectCountsToday: Record<string, number> = {};
      let lastSubjectThisDay: string | null = null; // Track last subject used in previous period on THIS day
      subjects.forEach((s) => {
        subjectCountsToday[s] = 0;
      });
      
      // Helper function to check if a subject is a lab subject (ends with "Lab")
      const isLabSubject = (subject: string): boolean => {
        return subject.trim().toLowerCase().endsWith('lab');
      };
      
      // Track scheduled labs to avoid conflicts
      const scheduledLabs: Set<number> = new Set(); // Track periods that are part of a lab (period and period+1)
      
      for (let period = 1; period <= maxPeriodsForDay; period++) {
        // Skip if this period is already part of a lab scheduled in previous period
        if (scheduledLabs.has(period)) {
          console.log(`[Generator] Skipping period ${period} - already part of a lab class`);
          continue;
        }
        let subjectForSlot: string;
        
        // Get subjects that haven't been used yet today (or have been used least)
        const minCount = Math.min(...Object.values(subjectCountsToday));
        let candidateSubjects = subjects.filter((s) => subjectCountsToday[s] === minCount);
        
        // FILTER 1: Avoid repeating the same subject in consecutive periods on the SAME day
        // BUT: Lab subjects need consecutive periods, so allow them if they weren't just scheduled
        if (lastSubjectThisDay && candidateSubjects.includes(lastSubjectThisDay)) {
          // Check if the last subject was a lab - if so, we just scheduled it for 2 periods, so skip it
          const wasLastSubjectLab = isLabSubject(lastSubjectThisDay);
          if (wasLastSubjectLab) {
            // Lab was just scheduled for 2 periods, so remove it from candidates
            candidateSubjects = candidateSubjects.filter((s) => s !== lastSubjectThisDay);
            console.log(
              `[Generator] Filtered out "${lastSubjectThisDay}" - lab was just scheduled for 2 consecutive periods`
            );
          } else {
            // Regular subject - avoid consecutive repetition
            const otherCandidates = candidateSubjects.filter((s) => s !== lastSubjectThisDay);
            if (otherCandidates.length > 0) {
              candidateSubjects = otherCandidates;
              console.log(
                `[Generator] Filtered out "${lastSubjectThisDay}" to avoid consecutive repetition on day ${day}, period ${period}`
              );
            }
          }
        }
        
        // FILTER 1.5: For lab subjects, check if next consecutive period is available
        // AND check frequency limits BEFORE considering them
        // Separate lab subjects from regular subjects
        let labCandidates = candidateSubjects.filter((s) => isLabSubject(s));
        const regularCandidates = candidateSubjects.filter((s) => !isLabSubject(s));
        
        // CRITICAL: Filter lab subjects by frequency limit BEFORE checking period availability
        if (labCandidates.length > 0 && Object.keys(subjectFrequencyMap).length > 0) {
          labCandidates = labCandidates.filter((s) => {
            const normalizedSubject = s.trim();
            const limit = subjectFrequencyMap[normalizedSubject];
            if (limit !== undefined) {
              const currentCount = subjectCountsPerWeek[normalizedSubject] || 0;
              const canUse = currentCount < limit;
              if (!canUse) {
                console.log(
                  `[Generator] Lab subject "${normalizedSubject}" filtered out due to frequency limit: ${currentCount}/${limit}`
                );
              }
              return canUse;
            }
            return true; // No limit set, allow it
          });
        }
        
        // If we have lab candidates, check if next period is available
        // Don't prefer labs - just ensure they can be scheduled if selected
        if (labCandidates.length > 0 && period < maxPeriodsForDay) {
          // Next period must not be already part of a lab
          const nextPeriodAvailable = !scheduledLabs.has(period + 1);
          if (!nextPeriodAvailable) {
            // Next period is occupied, filter out lab subjects (can't schedule them)
            candidateSubjects = regularCandidates;
            console.log(
              `[Generator] Filtered out lab subjects - next period ${period + 1} is not available`
            );
          } else {
            // Next period is available - labs CAN be scheduled, but don't prefer them
            // Mix lab and regular candidates equally for better distribution
            console.log(
              `[Generator] Next period ${period + 1} is available - ${labCandidates.length} lab subject(s) can be scheduled (will be selected randomly with regular subjects)`
            );
            // Keep both lab and regular candidates - selection will be random/balanced
            candidateSubjects = [...regularCandidates, ...labCandidates];
          }
        } else if (labCandidates.length > 0 && period >= maxPeriodsForDay) {
          // Can't schedule lab if it's the last period (no next period available)
          candidateSubjects = regularCandidates;
          console.log(
            `[Generator] Filtered out lab subjects - period ${period} is the last period, no space for 2-period lab`
          );
        } else {
          // No lab candidates or they're filtered out - use regular candidates
          candidateSubjects = regularCandidates.length > 0 ? regularCandidates : candidateSubjects;
        }
        
        // FILTER 2: Avoid repeating the same subject in the same period across different days
        const usedInThisPeriod = subjectsUsedPerPeriod[period] || [];
        if (usedInThisPeriod.length > 0) {
          const notUsedInPeriod = candidateSubjects.filter((s) => !usedInThisPeriod.includes(s));
          if (notUsedInPeriod.length > 0) {
            candidateSubjects = notUsedInPeriod;
            console.log(
              `[Generator] Filtered out subjects already used in period ${period}: ${usedInThisPeriod.join(", ")}`
            );
          } else {
            // If all candidates were used in this period, allow reuse but prefer least-used
            console.warn(
              `[Generator] All subjects already used in period ${period}, allowing reuse`
            );
          }
        }
        
        // FILTER 3: Apply subject frequency limits (maxPerWeek) - MUST be applied before fallback
        const applyFrequencyFilter = (subjectsToFilter: string[]): string[] => {
          if (Object.keys(subjectFrequencyMap).length === 0) {
            return subjectsToFilter; // No limits configured, return as-is
          }
          
          const withinLimit = subjectsToFilter.filter((s) => {
            // Normalize subject name (trim whitespace, handle case sensitivity)
            const normalizedSubject = s.trim();
            const limit = subjectFrequencyMap[normalizedSubject];
            
            if (limit === undefined) {
              // No limit specified for this subject, allow it
              return true;
            }
            
            const currentCount = subjectCountsPerWeek[normalizedSubject] || 0;
            // Strict check: if count >= limit, cannot use (prevents scheduling when at or above limit)
            const canUse = currentCount < limit;
            
            if (!canUse) {
              const isLab = isLabSubject(s);
              console.log(
                `[Generator] Subject "${normalizedSubject}" ${isLab ? '(LAB)' : ''} reached limit: ${currentCount}/${limit} - FILTERED OUT`
              );
            } else {
              // Log when subject passes frequency check (for debugging)
              const isLab = isLabSubject(s);
              if (isLab && currentCount > 0) {
                console.log(
                  `[Generator] Lab subject "${normalizedSubject}" frequency check: ${currentCount}/${limit} - ALLOWED`
                );
              }
            }
            
            return canUse;
          });
          
          // Sort by remaining capacity (prefer subjects with more remaining slots)
          if (withinLimit.length > 1) {
            withinLimit.sort((a, b) => {
              const normalizedA = a.trim();
              const normalizedB = b.trim();
              const limitA = subjectFrequencyMap[normalizedA];
              const limitB = subjectFrequencyMap[normalizedB];
              
              // If both have limits, prefer the one with more remaining capacity
              if (limitA !== undefined && limitB !== undefined) {
                const countA = subjectCountsPerWeek[normalizedA] || 0;
                const countB = subjectCountsPerWeek[normalizedB] || 0;
                const remainingA = limitA - countA;
                const remainingB = limitB - countB;
                return remainingB - remainingA; // Sort descending (more remaining first)
              }
              
              // If only one has a limit, prefer the one without limit or with more remaining
              if (limitA !== undefined && limitB === undefined) {
                const countA = subjectCountsPerWeek[normalizedA] || 0;
                const remainingA = limitA - countA;
                return remainingA > 0 ? -1 : 1; // Prefer A if it has remaining, else prefer B
              }
              
              if (limitA === undefined && limitB !== undefined) {
                const countB = subjectCountsPerWeek[normalizedB] || 0;
                const remainingB = limitB - countB;
                return remainingB > 0 ? 1 : -1; // Prefer B if it has remaining, else prefer A
              }
              
              return 0; // Both have no limits or same remaining
            });
          }
          
          return withinLimit;
        };
        
        // Apply frequency filter to current candidates
        if (Object.keys(subjectFrequencyMap).length > 0) {
          const beforeFilter = candidateSubjects.length;
          candidateSubjects = applyFrequencyFilter(candidateSubjects);
          const afterFilter = candidateSubjects.length;
          
          if (beforeFilter > afterFilter) {
            const excluded = subjects.filter((s) => 
              !candidateSubjects.includes(s) && subjectFrequencyMap[s.trim()] !== undefined
            );
            if (excluded.length > 0) {
              const excludedWithCounts = excluded.map((s) => {
                const normalized = s.trim();
                const limit = subjectFrequencyMap[normalized];
                const current = subjectCountsPerWeek[normalized] || 0;
                return `${s} (${current}/${limit})`;
              });
              console.log(
                `[Generator] Filtered out subjects that reached frequency limit: ${excludedWithCounts.join(", ")}`
              );
            }
          }
        }
        
        // If no candidates left after filtering, try fallback but STILL apply frequency filter
        if (candidateSubjects.length === 0) {
          console.warn(
            `[Generator] No candidates after filtering, trying fallback for day ${day}, period ${period}`
          );
          
          // Fallback: use all subjects, but still respect frequency limits strictly
          candidateSubjects = applyFrequencyFilter(subjects);
          
          if (candidateSubjects.length === 0) {
            console.error(
              `[Generator] ERROR: No subjects available after applying frequency limits! All subjects have reached their limits.`
            );
            console.error(
              `[Generator] Skipping this slot - cannot schedule any subject without exceeding frequency limits.`
            );
            // Skip this slot entirely rather than bypassing limits
            skippedDueToUnavailability++;
            continue;
          }
        }
        
        // Separate lab and regular candidates for selection
        // Don't prefer lab subjects - treat them equally with regular subjects for better distribution
        const labCandidatesForSelection = candidateSubjects.filter((s) => isLabSubject(s));
        const regularCandidatesForSelection = candidateSubjects.filter((s) => !isLabSubject(s));
        
        // Strategy: Randomly decide whether to consider lab or regular subjects first
        // This prevents all labs from being scheduled on the first day
        const considerLabsFirst = assignmentStrategy === "random" 
          ? Math.random() < 0.5  // 50% chance to consider labs first
          : (rrIndex % 2 === 0); // Alternate for round-robin
        
        // Check if lab can be scheduled (needs next period available)
        const canScheduleLab = labCandidatesForSelection.length > 0 
          && period < maxPeriodsForDay 
          && !scheduledLabs.has(period + 1);
        
        if (assignmentStrategy === "random") {
          // Random selection: choose between lab and regular candidates randomly
          if (canScheduleLab && considerLabsFirst) {
            // Try lab first (50% chance)
            subjectForSlot = labCandidatesForSelection[Math.floor(Math.random() * labCandidatesForSelection.length)];
          } else if (regularCandidatesForSelection.length > 0) {
            // Use regular subject
            subjectForSlot = regularCandidatesForSelection[Math.floor(Math.random() * regularCandidatesForSelection.length)];
          } else if (canScheduleLab) {
            // Fallback to lab if no regular candidates
            subjectForSlot = labCandidatesForSelection[Math.floor(Math.random() * labCandidatesForSelection.length)];
          } else {
            // Last resort: any candidate
            subjectForSlot = candidateSubjects[Math.floor(Math.random() * candidateSubjects.length)];
          }
        } else {
          // Round-robin: alternate between lab and regular candidates
          if (canScheduleLab && considerLabsFirst) {
            // Use lab candidate
            const index = rrIndex % labCandidatesForSelection.length;
            subjectForSlot = labCandidatesForSelection[index];
            rrIndex++;
          } else if (regularCandidatesForSelection.length > 0) {
            // Use regular candidate
            const index = rrIndex % regularCandidatesForSelection.length;
            subjectForSlot = regularCandidatesForSelection[index];
            rrIndex++;
          } else if (canScheduleLab) {
            // Fallback to lab if no regular candidates
            const index = rrIndex % labCandidatesForSelection.length;
            subjectForSlot = labCandidatesForSelection[index];
            rrIndex++;
          } else {
            // Last resort: any candidate
            const index = rrIndex % candidateSubjects.length;
            subjectForSlot = candidateSubjects[index];
            rrIndex++;
          }
        }
        
        const isLab = isLabSubject(subjectForSlot);

        // For lab subjects, check teacher availability for BOTH periods before scheduling
        const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day - 1] || `Day${day}`;
        
        if (isLab && period < maxPeriodsForDay) {
          // Check teacher availability for both periods
          const nextPeriod = period + 1;
          const resultPeriod1 = findAvailableTeacher(subjectForSlot, day, period, { dayName, period });
          const resultPeriod2 = findAvailableTeacher(subjectForSlot, day, nextPeriod, { dayName, period: nextPeriod });
          
          // Both periods need the same teacher to be available
          if (!resultPeriod1.teacher || !resultPeriod2.teacher || resultPeriod1.teacher._id.toString() !== resultPeriod2.teacher._id.toString()) {
            console.warn(
              `[Generator] ⚠ SKIPPED LAB: ${dayName} Periods ${period}-${nextPeriod} | Subject: ${subjectForSlot} | Reason: Teacher not available for both periods or different teachers`
            );
            skippedDueToUnavailability++;
            // Try regular subjects instead if available
            if (regularCandidatesForSelection.length > 0) {
              // Re-run selection logic for regular subjects
              let fallbackSubject: string;
              if (assignmentStrategy === "random") {
                fallbackSubject = regularCandidatesForSelection[Math.floor(Math.random() * regularCandidatesForSelection.length)];
              } else {
                const index = rrIndex % regularCandidatesForSelection.length;
                fallbackSubject = regularCandidatesForSelection[index];
                rrIndex++;
              }
              // Continue with regular subject scheduling below (using fallbackSubject)
              subjectForSlot = fallbackSubject;
            } else {
              continue; // Skip this slot entirely
            }
          } else {
            // Both periods available with same teacher - schedule lab for 2 consecutive periods
            const teacherObj = resultPeriod1.teacher;
            const normalizedSubject = subjectForSlot.trim();
            
            // Mark both periods as part of a lab
            scheduledLabs.add(period);
            scheduledLabs.add(nextPeriod);
            
            // FINAL CHECK: Verify frequency limit BEFORE incrementing for lab subjects
            // This is a critical check to prevent exceeding limits
            const currentCountBeforeIncrement = subjectCountsPerWeek[normalizedSubject] || 0;
            
            // Check if this lab subject has a frequency limit
            const limit = subjectFrequencyMap[normalizedSubject];
            if (limit !== undefined) {
              // Use strict check: if count >= limit, cannot schedule
              if (currentCountBeforeIncrement >= limit) {
                console.error(
                  `[Generator] ✗✗ FREQUENCY LIMIT EXCEEDED: Lab "${normalizedSubject}" already at ${currentCountBeforeIncrement}/${limit}, skipping slot`
                );
                skippedDueToUnavailability++;
                // Remove from scheduled labs since we're not scheduling it
                scheduledLabs.delete(period);
                scheduledLabs.delete(nextPeriod);
                continue;
              }
              // Log when lab passes the final frequency check
              console.log(
                `[Generator] ✓ Lab "${normalizedSubject}" frequency check PASSED: ${currentCountBeforeIncrement}/${limit} (will become ${currentCountBeforeIncrement + 1}/${limit})`
              );
            }
            
            // Increment counts (only once for the lab, as it's one class session spanning 2 periods)
            subjectCountsToday[subjectForSlot]++;
            subjectCountsPerWeek[normalizedSubject] = currentCountBeforeIncrement + 1;
            
            // Log frequency tracking
            if (subjectFrequencyMap[normalizedSubject]) {
              const limit = subjectFrequencyMap[normalizedSubject];
              const current = subjectCountsPerWeek[normalizedSubject];
              console.log(
                `[Generator] Frequency: "${normalizedSubject}" = ${current}/${limit}`
              );
            }
            
            // Track this subject for next period on THIS day
            lastSubjectThisDay = subjectForSlot;
            // Track this subject for both periods across all days
            if (!subjectsUsedPerPeriod[period].includes(subjectForSlot)) {
              subjectsUsedPerPeriod[period].push(subjectForSlot);
            }
            if (!subjectsUsedPerPeriod[nextPeriod].includes(subjectForSlot)) {
              subjectsUsedPerPeriod[nextPeriod].push(subjectForSlot);
            }

            // Update cache to reflect this assignment for both periods
            const teacherIdStr = teacherObj._id.toString();
            if (!teacherScheduleCache[teacherIdStr]) {
              teacherScheduleCache[teacherIdStr] = {};
            }
            if (!teacherScheduleCache[teacherIdStr][day]) {
              teacherScheduleCache[teacherIdStr][day] = new Set();
            }
            teacherScheduleCache[teacherIdStr][day].add(period);
            teacherScheduleCache[teacherIdStr][day].add(nextPeriod);

            // For lab subjects, use assigned lab room from labSubjectRoomMap
            let assignedRoom = assignedClassRoom;
            // Check if there's an assigned lab room for this lab subject
            const assignedLabRoom = labSubjectRoomMap[subjectForSlot];
            if (assignedLabRoom && assignedLabRoom.trim() !== '') {
              assignedRoom = assignedLabRoom.trim();
              console.log(`[Generator] Using assigned lab room "${assignedRoom}" for lab subject "${subjectForSlot}"`);
            } else {
              // Use class room if lab room not assigned (but log warning)
              console.warn(`[Generator] ⚠ No lab room assigned for "${subjectForSlot}", using class room: ${assignedClassRoom}`);
              console.warn(`[Generator] ⚠ Please assign a specific lab room for "${subjectForSlot}" in Room Assignment page`);
            }
            
            // Create entries for both consecutive periods
            // Ensure ObjectIds are properly handled
            const classIdObj = klass._id instanceof mongoose.Types.ObjectId 
              ? klass._id 
              : new mongoose.Types.ObjectId(klass._id);
            const teacherIdObj = teacherObj._id instanceof mongoose.Types.ObjectId 
              ? teacherObj._id 
              : new mongoose.Types.ObjectId(teacherObj._id);
            
            entriesToInsert.push({
              classId: classIdObj,
              teacherId: teacherIdObj,
              dayOfWeek: day,
              periodNumber: period,
              subject: subjectForSlot,
              room: assignedRoom,
            });
            
            entriesToInsert.push({
              classId: classIdObj,
              teacherId: teacherIdObj,
              dayOfWeek: day,
              periodNumber: nextPeriod,
              subject: subjectForSlot,
              room: assignedRoom,
            });

            console.log(
              `[Generator] ✓ ASSIGNED LAB (2 periods): ${dayName} Periods ${period}-${nextPeriod} | Subject: ${subjectForSlot} | Teacher: ${teacherObj.name} | Note: ${resultPeriod1.note}`
            );

            assignedSlots += 2; // Count as 2 slots
            continue; // Skip to next iteration (next period will be skipped automatically via scheduledLabs check)
          }
        }
        
        // Regular subject scheduling (or fallback after lab scheduling failed)
        const result = findAvailableTeacher(subjectForSlot, day, period, { dayName, period });
        const teacherObj = result.teacher;
        
        if (!teacherObj) {
          console.warn(
            `[Generator] ⚠ SKIPPED SLOT: ${dayName} Period ${period} | Subject: ${subjectForSlot} | Reason: ${result.note}`
          );
          skippedDueToUnavailability++;
          continue;
        }
        
        // FINAL CHECK: Verify frequency limit BEFORE incrementing
        // Use normalized subject name for weekly count
        const normalizedSubject = subjectForSlot.trim();
        const currentCountBeforeIncrement = subjectCountsPerWeek[normalizedSubject] || 0;
        
        // Check if this subject has a frequency limit
        if (subjectFrequencyMap[normalizedSubject]) {
          const limit = subjectFrequencyMap[normalizedSubject];
          if (currentCountBeforeIncrement >= limit) {
            console.error(
              `[Generator] ✗✗ FREQUENCY LIMIT EXCEEDED: "${normalizedSubject}" already at ${currentCountBeforeIncrement}/${limit}, skipping slot`
            );
            skippedDueToUnavailability++;
            continue;
          }
        }
        
        // Only increment counts and track subjects AFTER we successfully find a teacher and verify limits
        // Increment count for this subject (both daily and weekly)
        subjectCountsToday[subjectForSlot]++;
        subjectCountsPerWeek[normalizedSubject] = currentCountBeforeIncrement + 1;
        
        // Log frequency tracking
        if (subjectFrequencyMap[normalizedSubject]) {
          const limit = subjectFrequencyMap[normalizedSubject];
          const current = subjectCountsPerWeek[normalizedSubject];
          console.log(
            `[Generator] Frequency: "${normalizedSubject}" = ${current}/${limit}`
          );
        }
        // Track this subject for next period on THIS day
        lastSubjectThisDay = subjectForSlot;
        // Track this subject for this period across all days
        if (!subjectsUsedPerPeriod[period].includes(subjectForSlot)) {
          subjectsUsedPerPeriod[period].push(subjectForSlot);
        }
        
        // Log successful assignment with note
        console.log(
          `[Generator] ✓ ASSIGNED: ${dayName} Period ${period} | Subject: ${subjectForSlot} | Teacher: ${teacherObj.name} | Note: ${result.note}`
        );

        // Update cache to reflect this assignment (for same-day subsequent periods)
        const teacherIdStr = teacherObj._id.toString();
        if (!teacherScheduleCache[teacherIdStr]) {
          teacherScheduleCache[teacherIdStr] = {};
        }
        if (!teacherScheduleCache[teacherIdStr][day]) {
          teacherScheduleCache[teacherIdStr][day] = new Set();
        }
        teacherScheduleCache[teacherIdStr][day].add(period);

        // For normal subjects, use the assigned class room
        // (Lab subjects are handled separately above and use their assigned lab rooms)
        console.log(`[Generator] Room assignment: "${subjectForSlot}" → "${assignedClassRoom}" (assigned class room)`);
        
        // Ensure ObjectIds are properly handled
        const classIdObj = klass._id instanceof mongoose.Types.ObjectId 
          ? klass._id 
          : new mongoose.Types.ObjectId(klass._id);
        const teacherIdObj = teacherObj._id instanceof mongoose.Types.ObjectId 
          ? teacherObj._id 
          : new mongoose.Types.ObjectId(teacherObj._id);
        
        entriesToInsert.push({
          classId: classIdObj,
          teacherId: teacherIdObj,
          dayOfWeek: day,
          periodNumber: period,
          subject: subjectForSlot,
          room: assignedClassRoom,
        });

        assignedSlots++;
      }
    }

    if (entriesToInsert.length > 0) {
      try {
        // Ensure all ObjectIds are properly converted
        const entriesToSave = entriesToInsert.map((entry) => {
          // Validate required fields
          if (!entry.classId || !entry.teacherId || !entry.subject) {
            throw new Error(`Invalid entry data: missing required fields - classId: ${!!entry.classId}, teacherId: ${!!entry.teacherId}, subject: ${!!entry.subject}`);
          }
          
          return {
            classId: entry.classId instanceof mongoose.Types.ObjectId 
              ? entry.classId 
              : new mongoose.Types.ObjectId(entry.classId),
            teacherId: entry.teacherId instanceof mongoose.Types.ObjectId 
              ? entry.teacherId 
              : new mongoose.Types.ObjectId(entry.teacherId),
            dayOfWeek: entry.dayOfWeek,
            periodNumber: entry.periodNumber,
            subject: entry.subject,
            room: entry.room || undefined,
          };
        });
        
        console.log(`[Generator] Attempting to insert ${entriesToSave.length} timetable entries...`);
        const result = await TimetableEntry.insertMany(entriesToSave, { ordered: false });
        console.log(`[Generator] ✓ Successfully inserted ${result.length} timetable entries`);
      } catch (insertError: any) {
        console.error('[Generator] ✗ Error inserting timetable entries:', insertError);
        // If it's a duplicate key error, log but continue
        if (insertError.code === 11000) {
          console.warn('[Generator] Some entries already exist (duplicate key error), continuing...');
          // Try to insert remaining entries individually
          const insertedCount = insertError.writeErrors?.length || 0;
          console.log(`[Generator] ${insertedCount} entries were inserted before duplicate error`);
        } else {
          throw new Error(`Failed to insert timetable entries: ${insertError.message || insertError}`);
        }
      }
    } else {
      const errorMsg = skippedDueToUnavailability > 0
        ? `No entries created. All ${assignedSlots + skippedDueToUnavailability} slots were skipped due to teacher unavailability or other constraints.`
        : 'No entries created. Generation produced no timetable entries.';
      console.warn(`[Generator] ⚠ ${errorMsg}`);
      
      // Don't throw error, but return informative message
      return NextResponse.json({
        success: false,
        assignedSlots: 0,
        skippedDueToUnavailability,
        totalAttempted: assignedSlots + skippedDueToUnavailability,
        error: errorMsg,
      }, { status: 400 });
    }

    // Save subjects list to Class document
    klass.subjects = subjects;
    await klass.save();
    console.log(`[Generator] Saved subjects list to class: ${subjects.join(", ")}`);

    // Final summary
    console.log("\n[Generator] ========== GENERATION SUMMARY ==========");
    console.log(`[Generator] Total slots attempted: ${assignedSlots + skippedDueToUnavailability}`);
    console.log(`[Generator] Successfully assigned: ${assignedSlots}`);
    console.log(`[Generator] Skipped (no available teacher): ${skippedDueToUnavailability}`);
    if (skippedDueToUnavailability > 0) {
      console.log(
        `[Generator] ⚠ WARNING: ${skippedDueToUnavailability} slot(s) could not be filled due to teacher conflicts`
      );
    }
    console.log(`[Generator] =========================================\n`);

    return NextResponse.json({
      success: true,
      assignedSlots,
      skippedDueToUnavailability,
      totalAttempted: assignedSlots + skippedDueToUnavailability,
      message: skippedDueToUnavailability > 0
        ? `Generated ${assignedSlots} slots. ${skippedDueToUnavailability} slots skipped due to teacher unavailability.`
        : `Generated ${assignedSlots} slots for class ${classId}.`,
    });
  } catch (err: any) {
    console.error("generate-timetable error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
