/*
<ai_context>
The root server layout for the app with Clerk auth and other integrations.
</ai_context>
*/

import { syncClerkUserAction } from "@/actions/db/users-actions"
import { Toaster } from "@/components/ui/toaster"
import { PostHogPageview } from "@/components/utilities/posthog/posthog-pageview"
import { PostHogUserIdentify } from "@/components/utilities/posthog/posthog-user-identity"
import { Providers } from "@/components/utilities/providers"
import { TailwindIndicator } from "@/components/utilities/tailwind-indicator"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import { auth, currentUser } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WordWise",
  description: "A smart writing assistant built with Next.js"
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  try {
    const { userId } = await auth()

    if (userId) {
      // Get user details from Clerk to sync with Supabase
      const user = await currentUser()
      if (user && user.emailAddresses[0]) {
        const email = user.emailAddresses[0].emailAddress
        // Sync user to Supabase (creates if doesn't exist, updates last seen if exists)
        await syncClerkUserAction(userId, email)
      }
    }
  } catch (error) {
    // Log the error but don't crash the app
    console.error("Auth error in layout:", error)
  }

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
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
