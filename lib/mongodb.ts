import mongoose from "mongoose";

function getMongoDBUri(): string {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }
  return MONGODB_URI;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let cached = (global as any).mongoose as MongooseCache | undefined;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const MONGODB_URI = getMongoDBUri();
    console.log("🔌 Attempting to connect to MongoDB...");
    
    cached.promise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Increased timeout to 10s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    }).then((mongooseInstance) => {
      console.log("✅ Connected to MongoDB");
      return mongooseInstance;
    }).catch((error) => {
      console.error("❌ MongoDB connection error:", error);
      console.error("❌ Error details:", {
        message: error.message,
        code: (error as any).code,
        syscall: (error as any).syscall,
      });
      console.error("💡 Troubleshooting tips:");
      console.error("   1. Check your MONGODB_URI in .env.local");
      console.error("   2. Verify MongoDB Atlas network access (IP whitelist)");
      console.error("   3. Check your internet connection");
      console.error("   4. Ensure MongoDB Atlas cluster is running");
      // Reset promise so we can retry
      cached.promise = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export { connectDB };
