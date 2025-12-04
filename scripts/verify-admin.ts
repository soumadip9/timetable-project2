// Quick script to verify admin user exists and check password
import { resolve } from 'path';
import dotenv from 'dotenv';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function verifyAdmin() {
  try {
    await connectDB();
    
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    console.log('🔍 Checking for admin user...');
    const user = await User.findOne({ email: adminEmail }).select('+password');
    
    if (!user) {
      console.log('❌ Admin user NOT found!');
      console.log('💡 Run: npm run seed');
      return;
    }
    
    console.log('✅ Admin user found!');
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   Has password:', !!user.password);
    console.log('   Password hash length:', user.password?.length || 0);
    
    if (user.password) {
      const isValid = await bcrypt.compare(adminPassword, user.password);
      console.log('   Password match:', isValid ? '✅ YES' : '❌ NO');
      
      if (!isValid) {
        console.log('\n⚠️  Password mismatch!');
        console.log('💡 The password in the database does not match "admin123"');
        console.log('💡 You may need to reset the admin password or re-run the seed script');
      }
    } else {
      console.log('❌ User has no password set!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyAdmin();

