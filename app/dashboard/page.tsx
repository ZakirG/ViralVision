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
  Menu,
  X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useUser, UserButton } from "@clerk/nextjs"
import {
  getDocumentsByUserIdAction,
  deleteDocumentAction
} from "@/actions/db/documents-actions"
import type { Document } from "@/db/schema"
import { toast } from "@/hooks/use-toast"
import { NewDocumentModal } from "@/components/new-document-modal"

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { isSignedIn, user, isLoaded } = useUser()

  // Load documents when user is signed in
  useEffect(() => {
    if (isSignedIn) {
      loadDocuments()
    }
  }, [isSignedIn])

  // Redirect to home if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/")
    }
  }, [isLoaded, isSignedIn, router])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const result = await getDocumentsByUserIdAction()
      if (result.isSuccess && result.data) {
        setDocuments(result.data)
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentCreated = (documentId: string) => {
    router.push(`/editor?doc=${documentId}`)
    loadDocuments() // Refresh the documents list
  }

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const result = await deleteDocumentAction(docId)
      if (result.isSuccess) {
        toast({
          title: "Success",
          description: "Document deleted successfully"
        })
        loadDocuments() // Reload documents
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive"
      })
    }
  }

  const handleDocumentClick = (docId: string) => {
    router.push(`/editor?doc=${docId}`)
  }

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

  // Don't render anything if not signed in (redirect will handle it)
  if (!isSignedIn) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed z-40 h-full w-64 border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out md:relative md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-200 p-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-teal-600">
            <span className="text-sm font-bold text-white">W</span>
          </div>
          <span className="font-semibold text-gray-900">WordWise</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            Free
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 bg-gray-100"
          >
            <div className="size-4 rounded bg-gray-400"></div>
            Documents
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <History className="size-4" />
            Version history
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Trash2 className="size-4" />
            Trash
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <User className="size-4" />
            Account
          </Button>
          <Button
            variant="ghost"
            className="relative w-full justify-start gap-3"
          >
            <Grid3X3 className="size-4" />
            Apps
            <Badge className="absolute -right-1 -top-1 size-5 bg-teal-600 text-xs">
              4
            </Badge>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Star className="size-4" />
            Get Pro
          </Button>
        </nav>

        {/* Bottom section */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 border-t border-gray-200 p-4">
          <Button variant="ghost" className="w-full justify-start gap-3">
            <HelpCircle className="size-4" />
            Support
          </Button>
          <div className="flex items-center gap-3 p-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8"
                }
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">
                {user && user.fullName}
              </div>
              <div className="truncate text-xs text-gray-500">
                {user &&
                  user.primaryEmailAddress &&
                  user.primaryEmailAddress.emailAddress}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Main header */}
        <div className="border-b border-gray-200 bg-white p-6">
          <h1 className="mb-6 text-2xl font-semibold text-gray-900">
            Documents
          </h1>

          {/* Action buttons */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <NewDocumentModal onDocumentCreated={handleDocumentCreated} />
            <Button variant="outline" className="gap-2">
              <Upload className="size-4" />
              Upload file
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
        </div>

        {/* Documents grid */}
        <div className="flex-1 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900">Today</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-8 animate-pulse items-center justify-center rounded-full bg-teal-600">
                  <span className="text-sm font-bold text-white">W</span>
                </div>
                <p className="text-gray-600">Loading documents...</p>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="mb-4 text-gray-600">No documents yet</p>
                <NewDocumentModal onDocumentCreated={handleDocumentCreated} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map(doc => (
                <Card
                  key={doc.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => handleDocumentClick(doc.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="mb-1 text-sm text-gray-500">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </div>
                    <CardTitle className="line-clamp-2 text-base font-medium">
                      {doc.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="mb-4 line-clamp-3 text-sm text-gray-600">
                      {doc.rawText && doc.rawText.length > 100
                        ? doc.rawText.substring(0, 100) + "..."
                        : doc.rawText || "No content yet"}
                    </p>

                    {/* Footer with actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {doc.status}
                        </Badge>
                        {doc.contentType && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.contentType}
                          </Badge>
                        )}
                        {doc.audienceLevel && (
                          <Badge variant="secondary" className="text-xs">
                            {doc.audienceLevel}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="size-8">
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={e => handleDeleteDocument(doc.id, e)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
