import getServerSession from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSession(): Promise<Session | null> {
  const result = await getServerSession(authOptions as any);
  return result as unknown as Session | null;
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();

  if (!session || !("user" in session)) {
    throw new Error("Unauthorized");
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

