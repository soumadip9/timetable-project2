import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';

export async function getAuthToken(request?: NextRequest) {
  if (request) {
    return await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } else {
    // For server components, use headers()
    const headersList = await headers();
    const cookieHeader = headersList.get('cookie') || '';
    
    // Create a minimal request-like object
    const req = {
      headers: {
        cookie: cookieHeader,
      },
    } as any;
    
    return await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
  }
}

export async function requireAdmin(request?: NextRequest) {
  const token = await getAuthToken(request);
  
  if (!token || token.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return token;
}

export async function requireTeacher(request?: NextRequest) {
  const token = await getAuthToken(request);
  
  if (!token || token.role !== 'teacher') {
    throw new Error('Unauthorized: Teacher access required');
  }
  
  return token;
}

