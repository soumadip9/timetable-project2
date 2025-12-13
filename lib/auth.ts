import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Teacher from '@/models/Teacher';

const providers: any[] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Please enter email and password');
      }

      // Type guard: ensure credentials.email and credentials.password are strings
      if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
        throw new Error('Invalid credentials format');
      }

      await connectDB();

      const user = await User.findOne({ email: credentials.email }).select(
        '+password'
      );

      if (!user || !user.password) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await user.comparePassword(
        credentials.password
      );

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // If user is a teacher, find their Teacher document to get teacherId
      // User model stores roles as uppercase: 'TEACHER' or 'ADMIN'
      let teacherId: string | null = null;
      if (user.role && user.role.toUpperCase() === 'TEACHER') {
        const teacher = await Teacher.findOne({ userId: user._id });
        if (teacher) {
          teacherId = teacher._id.toString();
        }
      }

      // Normalize role to lowercase for NextAuth User type
      const normalizedRole = user.role?.toLowerCase() === 'admin' ? 'admin' : 'teacher';

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: normalizedRole,
        image: user.image,
        teacherId: teacherId || null,
      };
    },
  }),
];

// Add Google provider if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  console.warn('⚠️  NEXTAUTH_SECRET is not set. Please add it to .env.local');
}

export const authOptions: NextAuthConfig = {
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await connectDB();

        const existingUser = await User.findOne({ email: user.email });

        if (!existingUser) {
          // Create new user from Google account
          const newUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: new Date(),
            role: 'TEACHER', // Default role for new Google users (uppercase for User model)
          });
          
          // Try to find or create corresponding Teacher document
          let teacher = await Teacher.findOne({ userId: newUser._id });
          if (!teacher) {
            teacher = await Teacher.create({
              userId: newUser._id,
              subject: 'General', // Default subject
            });
          }
          // Set teacherId for new users
          if (teacher) {
            (user as any).teacherId = teacher._id.toString();
          }
        } else {
          // Update user info if needed
          if (!existingUser.image && user.image) {
            existingUser.image = user.image;
            await existingUser.save();
          }
          
          // Fetch teacherId if user is a teacher
          // User model stores roles as uppercase: 'TEACHER' or 'ADMIN'
          if (existingUser.role && existingUser.role.toUpperCase() === 'TEACHER') {
            const teacher = await Teacher.findOne({ userId: existingUser._id });
            if (teacher) {
              (user as any).teacherId = teacher._id.toString();
            }
          }
        }
      }
      
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as any).role;
        token.teacherId = (user as any).teacherId || null;
        return token;
      }

      // Return existing token if no email
      if (!token.email) {
        return token;
      }

      // Fetch fresh user data from database (only if we have email)
      try {
        await connectDB();
        const dbUser = await User.findOne({ email: token.email });
        if (dbUser) {
          token.id = dbUser._id.toString();
          // Normalize role to lowercase for JWT token
          token.role = dbUser.role?.toLowerCase() === 'admin' ? 'admin' : 'teacher';
          
          // If teacher, fetch teacherId (check both uppercase and lowercase)
          if (dbUser.role && dbUser.role.toUpperCase() === 'TEACHER') {
            const teacher = await Teacher.findOne({ userId: dbUser._id });
            if (teacher) {
              token.teacherId = teacher._id.toString();
            } else {
              token.teacherId = null;
            }
          } else {
            token.teacherId = null;
          }
        }
      } catch (error) {
        console.error('Error in JWT callback:', error);
        // Return token even if DB fetch fails
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      try {
        if (session.user && token) {
          session.user.id = (token.id as string) || '';
          // Normalize role to uppercase for Session (Session uses uppercase)
          const role = (token.role as string) || 'teacher';
          (session.user as any).role = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'TEACHER';
          (session.user as any).teacherId = token.teacherId || null;
        }
      } catch (error) {
        console.error('Error in session callback:', error);
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Handle role-based redirects after sign in
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

