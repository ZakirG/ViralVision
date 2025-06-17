/*
<ai_context>
Contains middleware for protecting routes, checking user authentication, and redirecting as needed.
</ai_context>
*/

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/editor(.*)", "/todo(.*)"])

export default clerkMiddleware(async (auth, req) => {
  try {
    const { userId, redirectToSignIn } = await auth()

    // If the user isn't signed in and the route is private, redirect to sign-in
    if (!userId && isProtectedRoute(req)) {
      return redirectToSignIn({ returnBackUrl: req.url })
    }

    // If the user is logged in and the route is protected, let them view.
    if (userId && isProtectedRoute(req)) {
      return NextResponse.next()
    }

    // For all other routes, continue
    return NextResponse.next()
  } catch (error) {
    console.error("Middleware: Error occurred:", error)
    
    // For development: allow requests to continue if there's a middleware error
    // This prevents infinite loops during hot reloads
    return NextResponse.next()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Explicitly include all app routes
    '/',
    '/dashboard/:path*',
    '/editor/:path*'
  ],
}
