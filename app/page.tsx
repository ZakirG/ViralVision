"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  User,
  Grid3X3,
  Star,
  History,
  HelpCircle,
  LogOut,
  Menu,
  X,
  CheckCircle,
  ArrowRight,
  Play,
  Pause,
  Users,
  TrendingUp,
  Zap
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useUser, SignInButton, UserButton } from "@clerk/nextjs"
import {
  getDocumentsByUserIdAction,
  createDocumentAction,
  deleteDocumentAction
} from "@/actions/db/documents-actions"
import type { Document } from "@/db/schema"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"

export default function HomePage() {
  const { isSignedIn, user, isLoaded } = useUser()
  const router = useRouter()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard")
    }
  }, [isLoaded, isSignedIn, router])

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-8 items-center justify-center rounded-full bg-primary-brand">
            <span className="text-sm font-bold text-white">V</span>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show landing page for unauthenticated users
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary-brand">
                  <span className="text-sm font-bold text-white">V</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  ViralVision
                </span>
              </div>

              {/* Navigation */}
              <nav className="hidden items-center space-x-8 md:flex">
                <a
                  href="#features"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Pricing
                </a>
                <a href="#about" className="text-gray-600 hover:text-gray-900">
                  About
                </a>
                <a
                  href="#contact"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Contact
                </a>
              </nav>

              {/* Auth buttons */}
              <div className="flex items-center gap-4">
                <SignInButton mode="modal">
                  <Button variant="ghost">Log in</Button>
                </SignInButton>
                <SignInButton mode="modal">
                  <Button className="bg-primary-brand hover:bg-primary-brand-hover">
                    Start Creating - It's free
                  </Button>
                </SignInButton>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              {/* Left side - Content */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h1 className="text-5xl font-bold leading-tight text-gray-900">
                    Create videos that
                    <br />
                    <span className="text-primary-brand">go viral</span> with
                    <br />
                    AI-powered scripts
                  </h1>
                  <p className="text-xl leading-relaxed text-gray-600">
                    Transform your short-form videos into viral sensations. Get more views, 
                    engagement, and shares with AI that writes hooks that grab attention in 
                    the first 3 seconds and scripts that keep viewers watching.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <SignInButton mode="modal">
                    <Button
                      size="lg"
                      className="bg-primary-brand px-8 py-3 text-lg hover:bg-primary-brand-hover"
                    >
                      Start Creating - It's free
                      <ArrowRight className="ml-2 size-5" />
                    </Button>
                  </SignInButton>
                  <SignInButton mode="modal">
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 py-3 text-lg"
                    >
                      <svg className="mr-2 size-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign up with Google
                    </Button>
                  </SignInButton>
                </div>

                <p className="text-sm text-gray-500">
                  By signing up, you agree to the{" "}
                  <a href="#" className="text-primary-brand hover:underline">
                    Terms and Conditions
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary-brand hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>

              {/* Right side - Demo */}
              <div className="relative">
                <Card className="border-0 bg-white shadow-2xl">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="size-2 rounded-full bg-primary-brand"></div>
                        <span>ViralVision is optimizing your script...</span>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-4">
                        <p className="leading-relaxed text-gray-800">
                          <span className="font-semibold text-primary-brand">[HOOK]</span>{" "}
                          "What if I told you that 73% of people scroll past videos in the first 3 seconds? 
                          But this one trick will make them stop dead in their tracks..."
                        </p>
                      </div>

                      <div className="rounded-lg border border-primary-brand bg-primary-brand-light p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="mt-0.5 size-5 text-primary-brand" />
                          <div>
                            <p className="font-medium text-primary-brand">
                              Viral Hook Added
                            </p>
                            <p className="text-sm text-primary-brand-light">
                              Grabs attention in first 3 seconds with curiosity gap
                            </p>
                            <button className="mt-1 text-sm font-medium text-primary-brand hover:text-primary-brand-hover">
                              Apply this change →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating ViralVision logo */}
                <div className="absolute -bottom-4 -right-4 flex size-12 items-center justify-center rounded-full bg-primary-brand shadow-lg">
                  <span className="text-lg font-bold text-white">V</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Everything you need to create viral videos
              </h2>
              <p className="mx-auto max-w-3xl text-xl text-gray-600">
                ViralVision helps short-form video creators maximize engagement, views, 
                and shares with AI-powered script optimization
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary-brand-light">
                    <Zap className="size-6 text-primary-brand" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    Viral Hooks
                  </h3>
                  <p className="text-gray-600">
                    Generate attention-grabbing hooks that stop viewers from scrolling 
                    in the first 3 seconds
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary-brand-light">
                    <Star className="size-6 text-primary-brand" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    On-Screen Text
                  </h3>
                  <p className="text-gray-600">
                    Get suggestions for compelling on-screen text that enhances your 
                    spoken script and increases engagement
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-primary-brand-light">
                    <Users className="size-6 text-primary-brand" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    Delivery Tips
                  </h3>
                  <p className="text-gray-600">
                    Receive pacing and delivery suggestions to make your script sound 
                    natural and engaging when spoken aloud
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary-brand py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mb-4 text-4xl font-bold text-white">
              Ready to create viral videos?
            </h2>
            <p className="mb-8 text-xl text-primary-brand-light">
              Join thousands of creators who use ViralVision to get more views, 
              engagement, and shares on TikTok, Instagram Reels, and YouTube Shorts
            </p>
            <SignInButton mode="modal">
              <Button
                size="lg"
                className="bg-white px-8 py-3 text-lg text-primary-brand hover:bg-gray-100"
              >
                Start creating for free
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </SignInButton>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 py-12 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary-brand">
                    <span className="text-sm font-bold text-white">V</span>
                  </div>
                  <span className="text-xl font-bold">ViralVision</span>
                </div>
                <p className="text-gray-400">
                  AI-powered scriptwriting tool that helps video content creators 
                  create viral short-form videos with maximum engagement.
                </p>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Features</h4>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <a href="#" className="hover:text-white">
                      Viral Hooks
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      On-Screen Text
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Delivery Tips
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Company</h4>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <a href="#" className="hover:text-white">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Contact
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Support
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Legal</h4>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <a href="#" className="hover:text-white">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Terms of Service
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-800 pt-8 text-center text-gray-400">
              <p>&copy; 2024 ViralVision. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // This should never be reached due to the redirect, but just in case
  return null
}
