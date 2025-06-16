"use client"

import { useState } from "react"
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
} from "lucide-react"
import { useRouter } from "next/navigation"

export default function GrammarlyDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const documents = [
    {
      id: 1,
      title: "hi i'm over here chillin",
      preview: "hi i'm over here chillin bro bro",
      date: "16 Jun",
      errors: 5,
    },
    {
      id: 2,
      title: "Demo document",
      preview: "The basics\nMispellings and grammatical errors can effect your...",
      date: "16 Jun",
      errors: 23,
    },
  ]

  const handleDocumentClick = (docId: number) => {
    router.push(`/editor?doc=${docId}`)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-40 w-64 h-full bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-semibold text-gray-900">WordWise</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            Free
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-3 bg-gray-100">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            Documents
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <History className="w-4 h-4" />
            Version history
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Trash2 className="w-4 h-4" />
            Trash
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <User className="w-4 h-4" />
            Account
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 relative">
            <Grid3X3 className="w-4 h-4" />
            Apps
            <Badge className="absolute -top-1 -right-1 w-5 h-5 text-xs bg-teal-600">4</Badge>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Star className="w-4 h-4" />
            Get Pro
          </Button>
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-3">
            <HelpCircle className="w-4 h-4" />
            Support
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
          <div className="text-xs text-gray-500 truncate">user@wordwise.com</div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Main header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Documents</h1>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
              <Plus className="w-4 h-4" />
              New document
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload file
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
        </div>

        {/* Documents grid */}
        <div className="flex-1 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900">Today</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleDocumentClick(doc.id)}
              >
                <CardHeader className="pb-3">
                  <div className="text-sm text-gray-500 mb-1">{doc.date}</div>
                  <CardTitle className="text-base font-medium line-clamp-2">{doc.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">{doc.preview}</p>

                  {/* Footer with actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xs font-medium">{doc.errors}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
