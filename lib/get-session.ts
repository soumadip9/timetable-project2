// This file is deprecated. Use @/lib/auth-helpers instead.
// Re-exporting from auth-helpers for backwards compatibility

export { getAuthToken, requireAdmin, requireTeacher } from '@/lib/auth-helpers';

// Legacy exports for backwards compatibility
import { getAuthToken } from '@/lib/auth-helpers';

export async function getSession(request?: any) {
  return await getAuthToken(request);
}

export async function requireAuth(request?: any) {
  const token = await getAuthToken(request);
  
  if (!token) {
    throw new Error('Unauthorized');
  }

  // Convert token to session-like format for backwards compatibility
  return {
    user: {
      id: token.sub || '',
      email: token.email || '',
      name: token.name || '',
      role: token.role || '',
    },
  };
}

