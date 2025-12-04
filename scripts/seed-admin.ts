/**
 * Standalone script to seed the default admin account
 * 
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *   or
 *   npm run seed:admin (if added to package.json)
 * 
 * Environment variables:
 *   MONGODB_URI - MongoDB connection string (required)
 *   ADMIN_DEFAULT_PASSWORD - Default password for admin (optional, defaults to 'admin123')
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import User from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = 'admin@school.com';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const ADMIN_NAME = 'Administrator';

async function seedAdmin() {
  if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    console.error('   Please set it in .env.local or as an environment variable');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('ℹ️  Admin account already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Created: ${existingAdmin.createdAt}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create admin user
    console.log('👤 Creating admin account...');
    const adminUser = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      emailVerified: new Date(),
    });

    console.log('✅ Admin account created successfully!');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   ID: ${adminUser._id.toString()}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the default password after first login!');
    console.log(`   Default password: ${ADMIN_PASSWORD}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error seeding admin account:', error.message);
    
    if (error.code === 11000 || error.message?.includes('duplicate')) {
      console.error('   Admin account already exists');
    }
    
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run the script
seedAdmin();

