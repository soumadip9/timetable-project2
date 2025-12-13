import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// NextAuth v5 beta returns an object with a 'handlers' property
export const { GET, POST } = handler.handlers;

// Ensure this route is dynamic
export const dynamic = 'force-dynamic';

