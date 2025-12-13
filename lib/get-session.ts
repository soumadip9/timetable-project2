import getServerSession from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions as any) as Promise<Session | null>;
}

export async function requireAuth(): Promise<Session> {
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

