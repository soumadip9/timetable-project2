// scripts/reset-teacher-password.ts

import "dotenv/config";

import { connectDB } from "@/lib/mongodb";

import User from "@/models/User";

import bcrypt from "bcryptjs";



async function main() {

  const email = process.argv[2];

  const newPassword = process.argv[3] || "teacher123";



  if (!email) {

    console.error("Usage: npm run reset:teacher <email> [newPassword]");

    process.exit(1);

  }



  console.log("[RESET] Connecting to MongoDB...");

  await connectDB();



  console.log("[RESET] Resetting teacher password for:", email);

  const hash = await bcrypt.hash(newPassword, 10);



  // IMPORTANT: match by email ONLY, no role filter

  const teacher = await User.findOneAndUpdate(

    { email: email.toLowerCase().trim() },

    { password: hash },

    { new: true }

  );



  if (!teacher) {

    console.error("[RESET] No user found with email:", email);

  } else {

    console.log("[RESET] Password updated for user:", teacher.email, "role:", teacher.role);

  }



  process.exit(0);

}



main().catch((err) => {

  console.error("[RESET] Error resetting teacher password:", err);

  process.exit(1);

});
