import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    // Normalize email (lowercase and trim) to match NextAuth logic
    const adminEmail = (email || "admin@example.com").toLowerCase().trim();
    const adminPassword = password || "admin123";

    // Check if admin already exists (using uppercase role)
    const existing = await User.findOne({ email: adminEmail, role: "ADMIN" });
    if (existing) {
      // Update password if admin exists
      existing.password = adminPassword; // Plain password - pre-save hook will hash it
      await existing.save();
      return NextResponse.json(
        { 
          exists: true, 
          updated: true,
          email: adminEmail,
          message: "Admin user already exists. Password has been updated."
        },
        { status: 200 }
      );
    }

    // Create admin with plain password - User model's pre-save hook will hash it automatically
    await User.create({
      email: adminEmail,
      password: adminPassword, // Plain password - will be hashed by pre-save hook
      role: "ADMIN", // Use uppercase to match User model enum
      name: "Default Admin",
    });

    return NextResponse.json(
      { 
        created: true, 
        email: adminEmail,
        message: "Admin user created successfully"
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/seed/admin error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to seed admin" },
      { status: 500 }
    );
  }
}

