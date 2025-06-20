/*
<ai_context>
The root server layout for the app with Clerk auth and other integrations.
</ai_context>
*/

// Force dynamic rendering for all routes using this layout
export const dynamic = 'force-dynamic'

import { syncClerkUserAction } from "@/actions/db/users-actions"
import { syncUserProfileSettingsAction } from "@/actions/db/user-profile-settings-actions"
import { Toaster } from "@/components/ui/toaster"
import { PostHogPageview } from "@/components/utilities/posthog/posthog-pageview"
import { PostHogUserIdentify } from "@/components/utilities/posthog/posthog-user-identity"
import { Providers } from "@/components/utilities/providers"
import { TailwindIndicator } from "@/components/utilities/tailwind-indicator"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import { auth, currentUser } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ViralVision",
  description: "Create viral video scripts with AI",
}

// Development-only component to handle auth after hot reloads
function DevelopmentAuthHandler() {
  if (process.env.NODE_ENV !== 'development') return null
  
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          console.log("🔧 DevelopmentAuthHandler: Monitoring for auth recovery after hot reload");
          
          // Monitor for when Clerk becomes available after hot reload
          const checkClerkAvailable = () => {
            if (window.Clerk) {
              console.log("🔧 DevelopmentAuthHandler: Clerk is now available on client");
              window.Clerk.addListener('userChanged', (user) => {
                if (user) {
                  console.log("🔧 DevelopmentAuthHandler: User authenticated on client after hot reload");
                  // Optionally trigger a refresh or sync here if needed
                }
              });
            } else {
              // Check again in a bit
              setTimeout(checkClerkAvailable, 1000);
            }
          };
          
          setTimeout(checkClerkAvailable, 100);
        `
      }}
    />
  )
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  let userId: string | null = null
  let shouldSkipAuth = false
  
  // In development, be more resilient to middleware detection issues
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  try {
    // Try to get auth info - should work now with force-dynamic
    const authResult = await auth()
    userId = authResult.userId

    if (userId) {
      // Get user details from Clerk to sync with Supabase
      try {
        const user = await currentUser()
        console.log("👤 RootLayout: currentUser() result:", user ? "success" : "null")
        
        if (user && user.emailAddresses[0]) {
          const email = user.emailAddresses[0].emailAddress
          
          // Sync user to Supabase (creates if doesn't exist, updates last seen if exists)
          await syncClerkUserAction(userId, email)
          
          // Sync user profile settings (creates default settings if don't exist)
          await syncUserProfileSettingsAction(userId)
        }
      } catch (syncError) {
        // Don't crash the app if sync fails
      }
    } else {
    }
  } catch (error) {
    // Log the error but don't crash the app
    
    // Check if this is still a dynamic server usage issue
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as Error).message
      
      if (errorMessage.includes('Dynamic server usage')) {
        console.error("🔴 RootLayout: Dynamic server usage issue persists - this shouldn't happen with force-dynamic")
      } else if (errorMessage.includes('clerkMiddleware')) {
        
        if (isDevelopment) {
          shouldSkipAuth = true
          
          // In development, just continue without server-side auth
          // The ClerkProvider will handle authentication on the client side
        } else {
        }
      } else {
        // console.error("🔴 RootLayout: Unexpected auth error type:", errorMessage)
      }
    } else {
      // console.error("🔴 RootLayout: Unknown error type:", typeof error, error)
    }
    
    // Set userId to null to ensure clean state
    userId = null
  }

  // if (shouldSkipAuth) {
  //   console.log("🔧 RootLayout: Auth skipped due to development hot reload issue")
  // } else {
  //   console.log("🏗️  RootLayout: Rendering layout with userId:", userId ? "authenticated" : "unauthenticated")
  // }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            "bg-background mx-auto min-h-screen w-full scroll-smooth antialiased",
            inter.className
          )}
        >
          <Providers
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <PostHogUserIdentify />
            <PostHogPageview />

            {children}

            {/* <TailwindIndicator /> */}

            <Toaster />
            
            {/* Development-only auth recovery handler */}
            {shouldSkipAuth && <DevelopmentAuthHandler />}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
