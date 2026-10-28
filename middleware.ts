import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/home(.*)',
  '/role-selection(.*)',
  '/student-registration(.*)',
  '/profile(.*)',
  '/records(.*)',
  '/physical-attendance(.*)',
  '/virtual-class(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth.protect({ unauthenticatedUrl: new URL('/', req.url).toString() });
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
