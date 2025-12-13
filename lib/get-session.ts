import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();

  const role = (session.user as any)?.role;
  if (!role || role.toUpperCase() !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }

  return session;
}

