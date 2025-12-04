import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth-helpers';
import TimetableEntry from '@/models/TimetableEntry';
import TimetableNew from '@/models/TimetableNew';

// DELETE all period 8 timetable entries
export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication
    try {
      await requireAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Delete from TimetableEntry model (uses periodNumber field)
    const deletedEntries = await TimetableEntry.deleteMany({ periodNumber: 8 });
    console.log(`[Cleanup] Deleted ${deletedEntries.deletedCount} entries from TimetableEntry with periodNumber = 8`);

    // Delete from TimetableNew model (uses timeSlot field)
    // Period 8 might be stored as "16:00-17:00" (old schedule) or "8" or similar
    // Check common timeSlot formats for period 8
    const period8TimeSlots = [
      '16:00-17:00',  // Old period 8 time slot
      '8',            // Just the number
      'Period 8',     // With "Period" prefix
      'period 8',     // Lowercase
      'Period8',      // No space
    ];

    let deletedNew = 0;
    for (const timeSlot of period8TimeSlots) {
      const result = await TimetableNew.deleteMany({ timeSlot });
      deletedNew += result.deletedCount;
      if (result.deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${result.deletedCount} entries from TimetableNew with timeSlot = "${timeSlot}"`);
      }
    }
    
    // Also check if any timeSlot starts with "16:00" or contains "period.*8" (case insensitive)
    const period8Patterns = await TimetableNew.find({
      $or: [
        { timeSlot: /^16:00/i },
        { timeSlot: /period.*8/i },
      ]
    });
    
    if (period8Patterns.length > 0) {
      console.log(`[Cleanup] Found ${period8Patterns.length} additional entries with period 8 patterns`);
      const patternResult = await TimetableNew.deleteMany({
        $or: [
          { timeSlot: /^16:00/i },
          { timeSlot: /period.*8/i },
        ]
      });
      deletedNew += patternResult.deletedCount;
      if (patternResult.deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${patternResult.deletedCount} additional entries matching period 8 patterns`);
      }
    }

    const totalDeleted = deletedEntries.deletedCount + deletedNew;

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} period 8 entries`,
      details: {
        timetableEntry: deletedEntries.deletedCount,
        timetableNew: deletedNew,
        total: totalDeleted,
      },
    });
  } catch (error: any) {
    console.error('[Cleanup] Error deleting period 8 entries:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete period 8 entries' },
      { status: 500 }
    );
  }
}

