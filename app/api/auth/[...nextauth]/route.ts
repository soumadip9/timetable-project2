import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTH] Login attempt:", credentials?.email);

        // Validate input
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing credentials");
          return null;
        }

        await connectDB();

        // Normalize email
        const email = (credentials.email as string).trim().toLowerCase();

        // Find user with password field
        const user = await User.findOne({ email }).select("+password");
        console.log("[AUTH] User found?", !!user);

        if (!user) {
          console.log("[AUTH] No user found with email:", email);
          return null;
        }

        // Check if user has password
        if (!user.password) {
          console.log("[AUTH] User has no password set:", email);
          return null;
        }

        // Check password using bcryptjs
        const isMatch = await bcrypt.compare(credentials.password as string, user.password);
        console.log("[AUTH] Password match:", isMatch);

        if (!isMatch) {
          console.log("[AUTH] Wrong password for:", email);
          return null;
        }

        // Everything OK
        console.log("[AUTH] Login successful:", email);
        console.log("[AUTH] User data from DB:", {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          name: user.name,
        });
        
        const userData = {
          id: user._id.toString(),
          email: user.email,
          role: (user.role || "TEACHER").toLowerCase() as "admin" | "teacher", // Convert to lowercase for NextAuth User type
          name: user.name || "",
        };
        
        console.log("[AUTH] Returning user data for JWT:", userData);
        return userData;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      try {
        if (user) {
          token.id = (user as any).id;
          // Keep role as uppercase (ADMIN or TEACHER) to match User model
          token.role = (user as any).role || "TEACHER";
          token.email = (user as any).email;
          console.log("[AUTH] JWT callback - User data:", {
            id: (user as any).id,
            role: (user as any).role,
            email: (user as any).email,
            name: (user as any).name,
          });
        }
        // Ensure token always has required fields
        if (!token.id) {
          console.warn("[AUTH] JWT callback - Token.id is missing, setting to empty string");
          token.id = "";
        }
        if (!token.role) {
          console.warn("[AUTH] JWT callback - Token.role is missing, defaulting to TEACHER");
          token.role = "TEACHER";
        }
        console.log("[AUTH] JWT callback - Final token:", {
          id: token.id,
          role: token.role,
          email: token.email,
        });
      } catch (error) {
        console.error("JWT callback error:", error);
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (session && token) {
          if (session.user) {
            (session.user as any).id = (token.id as string) || "";
            // Ensure role is uppercase (ADMIN or TEACHER) to match User model
            const role = (token.role as string) || "TEACHER";
            (session.user as any).role = role.toUpperCase() === "ADMIN" ? "ADMIN" : "TEACHER";
            console.log("[AUTH] Session callback - Token role:", token.role, "→ Session role:", (session.user as any).role);
          }
        }
        // Always return a valid session object
        return session || {
          user: {
            id: "",
            email: "",
            name: "",
            role: "TEACHER",
          },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (error) {
        console.error("Session callback error:", error);
        // Return a minimal valid session on error
        return {
          user: {
            id: "",
            email: "",
            name: "",
            role: "TEACHER",
          },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allow same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Validate NEXTAUTH_SECRET before creating handler
if (!process.env.NEXTAUTH_SECRET) {
  console.error('⚠️ NEXTAUTH_SECRET is missing!');
}

// For NextAuth v5 beta, extract GET and POST from handler.handlers
const handler = NextAuth(authOptions);

// NextAuth v5 beta returns an object with a 'handlers' property
// Extract GET and POST from handler.handlers
export const { GET, POST } = handler.handlers;

// Ensure this route is dynamic
export const dynamic = 'force-dynamic';
