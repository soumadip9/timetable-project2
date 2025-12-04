// Load environment variables FIRST, before any other imports
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables before importing modules that use them
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Now import modules that depend on environment variables
import { connectDB } from '../lib/mongodb';
import User from '../models/User';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'admin@example.com';
  const newPassword = 'admin123';

  console.log('[RESET] Resetting admin password for:', email);

  try {
    // Ensure DB is connected
    await connectDB();

    // Hash the new password
    const hash = await bcrypt.hash(newPassword, 10);
    console.log('[RESET] Password hashed successfully');

    // Find and update the admin user
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { password: hash },
      { new: true }
    );

    if (!user) {
      console.error('[RESET] ❌ Admin user not found with email:', email);
      console.log('[RESET] 💡 Make sure you have run: npm run seed');
      process.exit(1);
    } else {
      console.log('[RESET] ✅ Password updated for admin user:', user._id.toString());
      console.log('[RESET] ✅ Email:', user.email);
      console.log('[RESET] ✅ Role:', user.role);
      console.log('[RESET] ✅ You can now login with:');
      console.log('[RESET]    Email:', email);
      console.log('[RESET]    Password:', newPassword);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('[RESET] ❌ Error resetting admin password:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

