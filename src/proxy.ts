import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// News detail pages require a signed-in user; everything else stays public.
const isProtectedRoute = createRouteMatcher(["/news/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|cur|heic|heif|mp4|mkv|mov|avi|ogv|flv|wmv|pdf|txt)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
