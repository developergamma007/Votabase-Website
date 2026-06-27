import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/privacy', '/~offline'];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/downloads') ||
    pathname === '/manifest.webmanifest';

  // If accessing a protected route without a token, redirect to login
  if (!isPublicRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|downloads|sw.js|manifest.webmanifest|icons).*)',
  ],
};
