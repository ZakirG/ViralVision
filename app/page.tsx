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
  Pause
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
          <div className="mx-auto mb-4 flex size-8 items-center justify-center rounded-full bg-teal-600">
            <span className="text-sm font-bold text-white">W</span>
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
                <div className="flex size-8 items-center justify-center rounded-full bg-teal-600">
                  <span className="text-sm font-bold text-white">W</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  WordWise
                </span>
              </div>

              {/* Navigation */}
              <nav className="hidden items-center space-x-8 md:flex">
                <a
                  href="#features"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Product
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
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    Get WordWise - It's free
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
                    Intelligent AI that
                    <br />
                    elevates your writing
                    <br />
                    and enhances clarity
                  </h1>
                  <p className="text-xl leading-relaxed text-gray-600">
                    Work with an AI writing partner that helps you find the
                    perfect words—to craft that important email, make your point
                    clear, and keep your ideas flowing.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <SignInButton mode="modal">
                    <Button
                      size="lg"
                      className="bg-teal-600 px-8 py-3 text-lg hover:bg-teal-700"
                    >
                      Sign up - It's free
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
                  <a href="#" className="text-teal-600 hover:underline">
                    Terms and Conditions
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-teal-600 hover:underline">
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
                        <div className="size-2 rounded-full bg-teal-600"></div>
                        <span>WordWise is reviewing your text...</span>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-4">
                        <p className="leading-relaxed text-gray-800">
                          We're ready to move forward with the project plan once
                          you take a look at the draft.{" "}
                          <span className="rounded bg-blue-100 px-1 text-blue-800">
                            Can you review the plan by Friday?
                          </span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="mt-0.5 size-5 text-teal-600" />
                          <div>
                            <p className="font-medium text-teal-900">
                              Specify a deadline
                            </p>
                            <p className="text-sm text-teal-700">
                              to review the plan.
                            </p>
                            <button className="mt-1 text-sm font-medium text-teal-600 hover:text-teal-800">
                              Show this change →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating WordWise logo */}
                <div className="absolute -bottom-4 -right-4 flex size-12 items-center justify-center rounded-full bg-teal-600 shadow-lg">
                  <span className="text-lg font-bold text-white">W</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <p className="mb-12 text-gray-600">
              Trusted by professionals and teams worldwide
            </p>
            <div className="grid grid-cols-2 items-center gap-8 opacity-60 md:grid-cols-4 lg:grid-cols-6">
              {/* Placeholder company logos */}
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div
                  key={i}
                  className="flex h-12 items-center justify-center rounded bg-gray-300"
                >
                  <span className="font-medium text-gray-500">Company {i}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-gray-900">
                Write with confidence
              </h2>
              <p className="mx-auto max-w-3xl text-xl text-gray-600">
                WordWise helps you communicate clearly and effectively with
                AI-powered writing assistance
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-teal-100">
                    <CheckCircle className="size-6 text-teal-600" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    Grammar & Spelling
                  </h3>
                  <p className="text-gray-600">
                    Catch errors and improve your writing with advanced grammar
                    and spell checking
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-100">
                    <Star className="size-6 text-blue-600" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    Style & Clarity
                  </h3>
                  <p className="text-gray-600">
                    Enhance your writing style and make your message clear and
                    engaging
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-purple-100">
                    <User className="size-6 text-purple-600" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">
                    Personal Assistant
                  </h3>
                  <p className="text-gray-600">
                    Get personalized suggestions that match your writing style
                    and goals
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-teal-600 py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mb-4 text-4xl font-bold text-white">
              Ready to improve your writing?
            </h2>
            <p className="mb-8 text-xl text-teal-100">
              Join thousands of writers who trust WordWise to help them
              communicate better
            </p>
            <SignInButton mode="modal">
              <Button
                size="lg"
                className="bg-white px-8 py-3 text-lg text-teal-600 hover:bg-gray-100"
              >
                Get started for free
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
                  <div className="flex size-8 items-center justify-center rounded-full bg-teal-600">
                    <span className="text-sm font-bold text-white">W</span>
                  </div>
                  <span className="text-xl font-bold">WordWise</span>
                </div>
                <p className="text-gray-400">
                  AI-powered writing assistant that helps you write better,
                  faster, and with confidence.
                </p>
              </div>

              <div>
                <h4 className="mb-4 font-semibold">Product</h4>
                <ul className="space-y-2 text-gray-400">
                  <li>
                    <a href="#" className="hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Enterprise
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
              <p>&copy; 2024 WordWise. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // This should never be reached due to the redirect, but just in case
  return null
}
