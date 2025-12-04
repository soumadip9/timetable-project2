// Load environment variables FIRST, before any other imports
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables before importing modules that use them
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Now import modules that depend on environment variables
import { connectDB } from '../lib/mongodb';
import User from '../models/User';
import Teacher from '../models/Teacher';
import Class from '../models/Class';
import TimetableEntry from '../models/TimetableEntry';
import Room from '../models/Room';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Starting seed...');
    await connectDB();

    // Drop old indexes that might conflict (from previous schema versions)
    try {
      const indexes = await Teacher.collection.indexes();
      const emailIndex = indexes.find((idx: any) => idx.name === 'email_1' || (idx.key && idx.key.email));
      if (emailIndex) {
        await Teacher.collection.dropIndex('email_1');
        console.log('✅ Dropped old email index from teachers collection');
      }
    } catch (error: any) {
      // Index doesn't exist or already dropped - that's fine
      if (error.code !== 27 && error.codeName !== 'IndexNotFound') {
        console.log('ℹ️  Could not drop index (may not exist):', error.message);
      }
    }

    // Clear existing data (optional - comment out if you want to keep existing data)
    // Uncomment these lines to clear all data before seeding
    // await User.deleteMany({});
    // await Teacher.deleteMany({});
    // await Class.deleteMany({});
    // await TimetableEntry.deleteMany({});

    // Create admin user
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      // Pass plain password - the pre-save hook will hash it automatically
      adminUser = await User.create({
        name: 'Admin User',
        email: adminEmail,
        password: adminPassword, // Plain password - will be hashed by pre-save hook
        role: 'ADMIN',
      });
      console.log('✅ Created admin user:', adminEmail);
    } else {
      console.log('ℹ️  Admin user already exists:', adminEmail);
      // Update password if user exists (will be hashed by pre-save hook)
      adminUser.password = adminPassword;
      await adminUser.save();
      console.log('✅ Updated admin user password');
    }

    // Create teacher users
    const teachers = [
      // Mathematics teachers
      { name: 'John Smith', email: 'john@example.com', password: 'teacher123', subject: 'Mathematics' },
      { name: 'Mark Thompson', email: 'mark@example.com', password: 'teacher123', subject: 'Mathematics' },
      { name: 'Rachel Green', email: 'rachel@example.com', password: 'teacher123', subject: 'Mathematics' },
      { name: 'Daniel Kim', email: 'daniel@example.com', password: 'teacher123', subject: 'Mathematics' },
      
      // Science teachers
      { name: 'Jane Doe', email: 'jane@example.com', password: 'teacher123', subject: 'Science' },
      { name: 'Patricia Moore', email: 'patricia@example.com', password: 'teacher123', subject: 'Science' },
      { name: 'Kevin Zhang', email: 'kevin@example.com', password: 'teacher123', subject: 'Science' },
      
      // English teachers
      { name: 'Bob Johnson', email: 'bob@example.com', password: 'teacher123', subject: 'English' },
      { name: 'Susan Miller', email: 'susan@example.com', password: 'teacher123', subject: 'English' },
      { name: 'Thomas Wright', email: 'thomas@example.com', password: 'teacher123', subject: 'English' },
      { name: 'Laura Adams', email: 'laura@example.com', password: 'teacher123', subject: 'English' },
      
      // History teachers
      { name: 'Alice Williams', email: 'alice@example.com', password: 'teacher123', subject: 'History' },
      { name: 'Richard Jackson', email: 'richard@example.com', password: 'teacher123', subject: 'History' },
      
      // Physics teachers
      { name: 'Michael Brown', email: 'michael@example.com', password: 'teacher123', subject: 'Physics' },
      { name: 'Nancy Scott', email: 'nancy@example.com', password: 'teacher123', subject: 'Physics' },
      
      // Chemistry teachers
      { name: 'Sarah Davis', email: 'sarah@example.com', password: 'teacher123', subject: 'Chemistry' },
      { name: 'Paul Rodriguez', email: 'paul@example.com', password: 'teacher123', subject: 'Chemistry' },
      
      // Biology teachers
      { name: 'David Wilson', email: 'david@example.com', password: 'teacher123', subject: 'Biology' },
      { name: 'Karen Lewis', email: 'karen@example.com', password: 'teacher123', subject: 'Biology' },
      
      // Geography teachers
      { name: 'Emily Martinez', email: 'emily@example.com', password: 'teacher123', subject: 'Geography' },
      { name: 'Brian Walker', email: 'brian@example.com', password: 'teacher123', subject: 'Geography' },
      
      // Computer Science teachers
      { name: 'James Anderson', email: 'james@example.com', password: 'teacher123', subject: 'Computer Science' },
      { name: 'Michelle Young', email: 'michelle@example.com', password: 'teacher123', subject: 'Computer Science' },
      
      // Art teachers
      { name: 'Lisa Taylor', email: 'lisa@example.com', password: 'teacher123', subject: 'Art' },
      { name: 'Steven King', email: 'steven@example.com', password: 'teacher123', subject: 'Art' },
      
      // Music teachers
      { name: 'Robert Thomas', email: 'robert@example.com', password: 'teacher123', subject: 'Music' },
      { name: 'Angela Baker', email: 'angela@example.com', password: 'teacher123', subject: 'Music' },
      
      // Physical Education teachers
      { name: 'Jennifer Garcia', email: 'jennifer@example.com', password: 'teacher123', subject: 'Physical Education' },
      { name: 'Ryan Hall', email: 'ryan@example.com', password: 'teacher123', subject: 'Physical Education' },
      
      // Economics teachers
      { name: 'William Lee', email: 'william@example.com', password: 'teacher123', subject: 'Economics' },
      { name: 'Cynthia Allen', email: 'cynthia@example.com', password: 'teacher123', subject: 'Economics' },
      
      // Psychology teachers
      { name: 'Amanda White', email: 'amanda@example.com', password: 'teacher123', subject: 'Psychology' },
      { name: 'Jason Nelson', email: 'jason@example.com', password: 'teacher123', subject: 'Psychology' },
      
      // French teachers
      { name: 'Christopher Harris', email: 'christopher@example.com', password: 'teacher123', subject: 'French' },
      { name: 'Sophie Martin', email: 'sophie@example.com', password: 'teacher123', subject: 'French' },
      
      // Spanish teachers
      { name: 'Jessica Clark', email: 'jessica@example.com', password: 'teacher123', subject: 'Spanish' },
      { name: 'Carlos Rivera', email: 'carlos@example.com', password: 'teacher123', subject: 'Spanish' },
    ];

    const createdTeachers = [];
    for (const teacherData of teachers) {
      let user = await User.findOne({ email: teacherData.email });
      if (!user) {
        // Pass plain password - the pre-save hook will hash it automatically
        user = await User.create({
          name: teacherData.name,
          email: teacherData.email,
          password: teacherData.password, // Plain password - will be hashed by pre-save hook
          role: 'TEACHER',
        });

        const teacher = await Teacher.create({
          userId: user._id,
          subject: teacherData.subject,
          phone: `+1-555-${Math.floor(Math.random() * 10000)}`,
        });
        createdTeachers.push(teacher);
        console.log('✅ Created teacher:', teacherData.name);
      } else {
        // User exists - update password to ensure it's correctly hashed
        console.log('ℹ️  Teacher user already exists:', teacherData.name);
        user.password = teacherData.password; // Plain password - pre-save hook will hash it
        await user.save();
        console.log('✅ Updated teacher password for:', teacherData.name);
        
        // Find existing teacher or create one if user exists but teacher doesn't
        let teacher = await Teacher.findOne({ userId: user._id });
        if (!teacher) {
          // User exists but teacher profile doesn't - create it
          teacher = await Teacher.create({
            userId: user._id,
            subject: teacherData.subject,
            phone: `+1-555-${Math.floor(Math.random() * 10000)}`,
          });
          console.log('✅ Created teacher profile for existing user:', teacherData.name);
        } else {
          console.log('ℹ️  Teacher profile already exists:', teacherData.name);
        }
        createdTeachers.push(teacher);
      }
    }

    // Create rooms
    const rooms = [
      { name: 'Room 101', capacity: 30, building: 'Main Building' },
      { name: 'Room 102', capacity: 35, building: 'Main Building' },
      { name: 'Room 103', capacity: 25, building: 'Main Building' },
      { name: 'Room 201', capacity: 40, building: 'Main Building' },
      { name: 'Room 202', capacity: 30, building: 'Main Building' },
      { name: 'Room 203', capacity: 35, building: 'Main Building' },
      { name: 'Room 301', capacity: 30, building: 'Main Building' },
      { name: 'Room 302', capacity: 25, building: 'Main Building' },
      { name: 'Lab 101', capacity: 20, building: 'Science Block' },
      { name: 'Lab 102', capacity: 20, building: 'Science Block' },
      { name: 'Lab 201', capacity: 25, building: 'Science Block' },
      { name: 'Computer Lab 1', capacity: 30, building: 'Tech Building' },
      { name: 'Computer Lab 2', capacity: 30, building: 'Tech Building' },
      { name: 'Art Studio', capacity: 20, building: 'Arts Building' },
      { name: 'Music Room', capacity: 25, building: 'Arts Building' },
      { name: 'Gymnasium', capacity: 100, building: 'Sports Complex' },
      { name: 'Library', capacity: 50, building: 'Main Building' },
      { name: 'Auditorium', capacity: 200, building: 'Main Building' },
      { name: 'Room 401', capacity: 30, building: 'Main Building' },
      { name: 'Room 402', capacity: 35, building: 'Main Building' },
    ];

    const createdRooms = [];
    for (const roomData of rooms) {
      let room = await Room.findOne({ name: roomData.name });
      if (!room) {
        room = await Room.create(roomData);
        createdRooms.push(room);
        console.log('✅ Created room:', roomData.name);
      } else {
        createdRooms.push(room);
        console.log('ℹ️  Room already exists:', roomData.name);
      }
    }

    // Create classes
    const classNames = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
    const createdClasses = [];
    for (const className of classNames) {
      let classDoc = await Class.findOne({ name: className });
      if (!classDoc) {
        classDoc = await Class.create({ name: className });
        createdClasses.push(classDoc);
        console.log('✅ Created class:', className);
      } else {
        createdClasses.push(classDoc);
        console.log('ℹ️  Class already exists:', className);
      }
    }

    // CRITICAL: Ensure ALL teacher users have corresponding Teacher documents
    // This is essential for the teacher timetable API to work correctly
    console.log('\n🔗 Verifying ALL Teacher-User relationships...');
    const allTeacherUsers = await User.find({ role: 'TEACHER' });
    console.log(`   Found ${allTeacherUsers.length} users with role TEACHER`);
    
    for (const user of allTeacherUsers) {
      const existingTeacher = await Teacher.findOne({ userId: user._id });
      if (!existingTeacher) {
        console.log(`   ⚠️  User ${user.email} (${user._id}) has role TEACHER but no Teacher document. Creating...`);
        const newTeacher = await Teacher.create({
          userId: user._id,
          subject: 'General', // Default subject
          phone: `+1-555-${Math.floor(Math.random() * 10000)}`,
        });
        createdTeachers.push(newTeacher);
        console.log(`   ✅ Created Teacher document for ${user.email} (Teacher._id: ${newTeacher._id})`);
      } else {
        // Ensure this teacher is in createdTeachers array
        const alreadyInArray = createdTeachers.find(t => t._id.toString() === existingTeacher._id.toString());
        if (!alreadyInArray) {
          createdTeachers.push(existingTeacher);
          console.log(`   ✅ Found existing Teacher document for ${user.email} (Teacher._id: ${existingTeacher._id})`);
        }
      }
    }
    console.log(`✅ Verified ${createdTeachers.length} Teacher documents exist (one per TEACHER user)`);
    
    // Final verification: ensure every TEACHER user has a Teacher document
    const teacherUserCount = await User.countDocuments({ role: 'TEACHER' });
    const teacherDocCount = await Teacher.countDocuments({});
    if (teacherUserCount !== teacherDocCount) {
      console.error(`❌ MISMATCH: ${teacherUserCount} TEACHER users but ${teacherDocCount} Teacher documents!`);
      console.error('   This will cause teacher timetable API to fail. Fixing...');
      
      // Find users without Teacher documents and create them
      const usersWithoutTeachers = await User.find({ role: 'TEACHER' });
      for (const user of usersWithoutTeachers) {
        const hasTeacher = await Teacher.findOne({ userId: user._id });
        if (!hasTeacher) {
          const newTeacher = await Teacher.create({
            userId: user._id,
            subject: 'General',
            phone: `+1-555-${Math.floor(Math.random() * 10000)}`,
          });
          createdTeachers.push(newTeacher);
          console.log(`   ✅ Created missing Teacher document for ${user.email}`);
        }
      }
    } else {
      console.log(`✅ Perfect match: ${teacherUserCount} TEACHER users = ${teacherDocCount} Teacher documents`);
    }

    // Create sample timetable entries
    // IMPORTANT: Ensure we have teachers in createdTeachers array
    // If teachers already existed, fetch them all to ensure createdTeachers is populated
    if (createdTeachers.length === 0) {
      console.log('⚠️  No teachers in createdTeachers array, fetching all teachers...');
      const allTeachers = await Teacher.find({}).populate('userId', 'email');
      createdTeachers.push(...allTeachers);
      console.log(`✅ Found ${allTeachers.length} existing teachers`);
    }

    if (createdTeachers.length > 0 && createdClasses.length > 0) {
      console.log(`\n📅 Creating timetable entries for ${createdTeachers.length} teachers and ${createdClasses.length} classes...`);
      
      // Clear existing entries for seeded classes
      const deletedCount = await TimetableEntry.deleteMany({
        classId: { $in: createdClasses.map((c) => c._id) },
      });
      console.log(`🗑️  Cleared ${deletedCount.deletedCount} existing timetable entries`);

      const subjects = ['Math', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry'];
      const days = [1, 2, 3, 4, 5]; // Monday to Friday
      const periods = [1, 2, 3, 4, 5, 6]; // 6 periods per day

      let entryCount = 0;
      const teacherEntryCounts: Record<string, number> = {}; // Track entries per teacher

      for (const classDoc of createdClasses.slice(0, 3)) {
        // Create entries for first 3 classes
        for (const day of days) {
          for (const period of periods) {
            // Randomly assign a teacher and subject
            const teacher = createdTeachers[Math.floor(Math.random() * createdTeachers.length)];
            const subject = subjects[Math.floor(Math.random() * subjects.length)];

            // Verify teacher has _id
            if (!teacher || !teacher._id) {
              console.error('⚠️  Invalid teacher object:', teacher);
              continue;
            }

            try {
              const entry = await TimetableEntry.create({
                classId: classDoc._id,
                teacherId: teacher._id, // This is the Teacher document's _id
                dayOfWeek: day,
                periodNumber: period,
                subject: subject,
                room: `Room ${Math.floor(Math.random() * 20) + 1}`,
              });
              
              // Track entries per teacher
              const teacherIdStr = teacher._id.toString();
              teacherEntryCounts[teacherIdStr] = (teacherEntryCounts[teacherIdStr] || 0) + 1;
              entryCount++;
            } catch (error: any) {
              // Skip if duplicate (same class, day, period)
              if (error.code !== 11000) {
                console.error('❌ Error creating timetable entry:', error.message);
              }
            }
          }
        }
      }
      
      console.log(`✅ Created ${entryCount} timetable entries`);
      
      // Show distribution of entries per teacher
      console.log('\n📊 Timetable entries per teacher:');
      for (const teacher of createdTeachers) {
        const teacherIdStr = teacher._id.toString();
        const count = teacherEntryCounts[teacherIdStr] || 0;
        const user = await User.findById(teacher.userId);
        console.log(`   ${user?.name || 'Unknown'}: ${count} entries`);
      }
      
      // Verify the relationship chain for ALL teachers
      console.log('\n🔍 Verifying data relationships for ALL teachers...');
      const allTeachers = await Teacher.find({}).populate('userId', 'name email');
      for (const teacher of allTeachers) {
        const user = teacher.userId as any;
        const entryCount = await TimetableEntry.countDocuments({ teacherId: teacher._id });
        console.log(`   ${user?.name || 'Unknown'}: User._id=${user?._id}, Teacher._id=${teacher._id}, Entries=${entryCount}`);
        
        // Warn if teacher has no entries (might be expected, but good to know)
        if (entryCount === 0) {
          console.log(`      ⚠️  No timetable entries for this teacher`);
        }
      }
      
      // Final verification: ensure all TimetableEntry documents reference valid Teacher._id
      console.log('\n🔍 Verifying TimetableEntry → Teacher relationships...');
      const allEntries = await TimetableEntry.find({}).lean();
      let invalidEntries = 0;
      for (const entry of allEntries) {
        const teacherExists = await Teacher.findById(entry.teacherId);
        if (!teacherExists) {
          console.error(`   ❌ TimetableEntry ${entry._id} references invalid Teacher._id: ${entry.teacherId}`);
          invalidEntries++;
        }
      }
      if (invalidEntries === 0) {
        console.log(`   ✅ All ${allEntries.length} TimetableEntry documents reference valid Teacher documents`);
      } else {
        console.error(`   ❌ Found ${invalidEntries} TimetableEntry documents with invalid Teacher references!`);
      }
    } else {
      console.log('⚠️  Skipping timetable entry creation: need at least 1 teacher and 1 class');
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('Admin:');
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);
    console.log('\nTeachers:');
    teachers.forEach((t) => {
      console.log(`  ${t.name}: ${t.email} / ${t.password}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();

