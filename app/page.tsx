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
                  
                  {/* Platform Logos */}
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                      <span className="text-sm font-medium">TikTok</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span className="text-sm font-medium">Instagram Reels</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="text-sm font-medium">YouTube Shorts</span>
                    </div>
                  </div>
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
