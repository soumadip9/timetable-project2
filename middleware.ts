import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log(`🔍 [Middleware] Processing path: ${path}`);

  // Allow access to public routes
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/login') ||
    path.startsWith('/api/seed') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico')
  ) {
    console.log(`✅ [Middleware] Allowing public route: ${path}`);
    return NextResponse.next();
  }

  // Get token from JWT
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    console.log(`🔑 [Middleware] Token check result:`, token ? `Found (id: ${(token as any)?.id}, role: ${(token as any)?.role})` : 'Not found');
  } catch (error) {
    console.error('❌ [Middleware] Token error:', error);
    token = null;
  }

  // Root route is the landing page - allow public access
  if (path === '/') {
    return NextResponse.next();
  }

  // Protect /admin/:path* routes
  if (path.startsWith('/admin')) {
    // If there is no token → redirect to /login/admin
    if (!token) {
      return NextResponse.redirect(new URL('/login/admin', request.url));
    }

    // If token.role !== "admin" → redirect to /
    if (token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Otherwise, allow the request to continue
    return NextResponse.next();
  }

  // Protect /teacher/** routes - only allow teacher
  if (path.startsWith('/teacher')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login/teacher', request.url));
    }

    if (token?.role !== 'teacher') {
      return NextResponse.redirect(new URL('/login/teacher?error=Forbidden', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/teacher/:path*',
  ],
};

