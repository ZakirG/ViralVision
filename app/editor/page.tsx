"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Menu,
  Target,
  BarChart3,
  ChevronRight,
  Sparkles,
  Info,
  MoreHorizontal,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  Type,
  ChevronDown
} from "lucide-react"
import {
  EditableContent,
  type EditableContentRef
} from "./components/editable-content"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { ContentGoalsModal } from "./components/content-goals-modal"
import { PerformanceModal } from "./components/performance-modal"
import { FloatingSidebar } from "./components/floating-sidebar"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  getDocumentByIdAction,
  updateDocumentAction
} from "@/actions/db/documents-actions"
import type { Document } from "@/db/schema"
import { toast } from "@/hooks/use-toast"

interface FormatState {
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  isBulletList: boolean
  isNumberedList: boolean
}

export default function GrammarlyEditor() {
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null
  )
  const [activeMainTab, setActiveMainTab] = useState("review")
  const [documentContent, setDocumentContent] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const editorRef = useRef<EditableContentRef>(null)
  const [aiChatInput, setAiChatInput] = useState("")
  const [documentTitle, setDocumentTitle] = useState("Untitled Document")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formatState, setFormatState] = useState<FormatState>({
    isBold: false,
    isItalic: false,
    isUnderlined: false,
    isBulletList: false,
    isNumberedList: false
  })
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn, isLoaded } = useUser()
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const documentId = searchParams.get("doc")

  // Load document on mount
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/")
      return
    }

    if (isSignedIn && documentId) {
      loadDocument()
    } else if (isSignedIn && !documentId) {
      router.push("/dashboard")
    }
  }, [isLoaded, isSignedIn, documentId, router])

  const loadDocument = async () => {
    if (!documentId) return

    try {
      setLoading(true)
      const result = await getDocumentByIdAction(documentId)

      if (result.isSuccess && result.data) {
        setDocument(result.data)
        setDocumentContent(result.data.rawText || "")
        setDocumentTitle(result.data.title || "Untitled Document")
      } else {
        toast({
          title: "Error",
          description: result.message || "Document not found",
          variant: "destructive"
        })
        router.push("/dashboard")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive"
      })
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const saveDocument = useCallback(async () => {
    if (!document || !documentId || saving) return

    try {
      setSaving(true)
      const result = await updateDocumentAction(documentId, {
        title: documentTitle,
        rawText: documentContent
      })

      if (!result.isSuccess) {
        console.error("Save failed:", result.message)
        // Only show toast if component is still mounted
        if (document && documentId) {
          toast({
            title: "Error",
            description: "Failed to save document",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error("Save error:", error)
      // Only show toast if component is still mounted
      if (document && documentId) {
        toast({
          title: "Error",
          description: "Failed to save document",
          variant: "destructive"
        })
      }
    } finally {
      setSaving(false)
    }
  }, [document, documentId, saving, documentTitle, documentContent])

  // Auto-save functionality
  useEffect(() => {
    if (!document || !documentId || saving) return

    const saveTimeout = setTimeout(() => {
      // Only save if the component is still mounted and user is still on this page
      if (document && documentId && !saving) {
        saveDocument()
      }
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(saveTimeout)
  }, [
    documentContent,
    documentTitle,
    document,
    documentId,
    saving,
    saveDocument
  ])

  // Manual save function
  const handleSave = useCallback(() => {
    saveDocument()
    toast({
      title: "Saved",
      description: "Document saved successfully"
    })
  }, [saveDocument])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }

    window.document.addEventListener("keydown", handleKeyDown)
    return () => window.document.removeEventListener("keydown", handleKeyDown)
  }, [handleSave])

  // Show loading state
  if (loading || !isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-8 animate-pulse items-center justify-center rounded-full bg-teal-600">
            <span className="text-sm font-bold text-white">W</span>
          </div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  // Redirect if not signed in
  if (!isSignedIn) {
    return null
  }

  const suggestions = [
    {
      id: 1,
      type: "correctness",
      title: "Capitalize the word",
      word: "hi",
      description: "Correctness • Change the capitalization",
      preview: "hi I'm I'm over here chillin...",
      isPro: false
    },
    {
      id: 2,
      type: "correctness",
      title: "Correct your spelling",
      word: "chillin",
      description: "Spelling error",
      preview: "chilling",
      isPro: false
    },
    {
      id: 3,
      type: "correctness",
      title: "Capitalize the word",
      word: "you",
      description: "Capitalization",
      preview: "You",
      isPro: false
    },
    {
      id: 4,
      type: "correctness",
      title: "Correct your spelling",
      word: "dooooo",
      description: "Spelling error",
      preview: "do",
      isPro: false
    }
  ]

  const tabs = [
    { id: "correctness", label: "Correctness", color: "bg-red-500", score: 85 },
    { id: "clarity", label: "Clarity", color: "bg-blue-500", score: 72 },
    { id: "engagement", label: "Engagement", color: "bg-green-500", score: 90 },
    { id: "structure", label: "Structure", color: "bg-purple-500", score: 68 }
  ]

  // Formatting functions
  const handleBold = () => {
    editorRef.current?.formatText("bold")
  }

  const handleItalic = () => {
    editorRef.current?.formatText("italic")
  }

  const handleUnderline = () => {
    editorRef.current?.formatText("underline")
  }

  const handleBulletList = () => {
    editorRef.current?.toggleBulletList()
  }

  const handleNumberedList = () => {
    editorRef.current?.toggleNumberedList()
  }

  // Add this function to handle text changes
  const handleContentChange = (newContent: string) => {
    setDocumentContent(newContent)
  }

  // Add this function to handle format state changes
  const handleFormatStateChange = (newFormatState: FormatState) => {
    setFormatState(newFormatState)
  }

  // Add this function to handle cursor position
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      setCursorPosition(range.startOffset)
    }
  }

  // Add this style tag before the return statement
  const editorStyles = `
  .prose [contenteditable]:focus {
    caret-color: #374151;
  }
  
  .prose [contenteditable] {
    caret-color: #374151;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .blinking-cursor::after {
    content: '|';
    animation: blink 1s infinite;
    color: #374151;
  }
`

  return (
    <div className="flex h-screen overflow-x-hidden bg-white">
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />

      {/* Floating Sidebar */}
      <FloatingSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main editor area */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-teal-600 transition-colors hover:bg-teal-700"
              >
                <span className="text-xs font-bold text-white">W</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                value={documentTitle}
                onChange={e => setDocumentTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    setIsEditingTitle(false)
                  }
                }}
                className="max-w-xs border-none bg-transparent font-medium text-gray-900 outline-none focus:outline-none"
                autoFocus
                onFocus={e => e.target.select()}
              />
            ) : (
              <span
                className="max-w-xs cursor-pointer truncate text-gray-600 transition-colors hover:text-gray-900"
                onClick={() => setIsEditingTitle(true)}
              >
                {documentTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {saving ? (
              <span className="text-sm text-gray-500">Saving...</span>
            ) : (
              <span className="text-sm text-gray-400">Saved</span>
            )}
            <Button variant="outline" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setGoalsModalOpen(true)}
            >
              <Target className="size-4" />
              Content Goals
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setPerformanceModalOpen(true)}
            >
              <BarChart3 className="size-4" />
              Overall score
            </Button>
          </div>

          <div></div>
        </div>

        {/* Editor content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Text editor */}
          <div className="flex-1 overflow-auto p-8">
            <div className="prose w-full max-w-none">
              <EditableContent
                ref={editorRef}
                initialContent={documentContent}
                onContentChange={handleContentChange}
                onFormatStateChange={handleFormatStateChange}
              />
            </div>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div
          className={`fixed inset-x-0 bottom-0 ${rightPanelCollapsed ? "lg:right-16" : "lg:right-80"} border-t border-gray-200 bg-white p-4`}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBold}
                className={formatState.isBold ? "bg-gray-200" : ""}
              >
                <Bold className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleItalic}
                className={formatState.isItalic ? "bg-gray-200" : ""}
              >
                <Italic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUnderline}
                className={formatState.isUnderlined ? "bg-gray-200" : ""}
              >
                <Underline className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="sm" className="gap-1">
                H1 <ChevronDown className="size-3" />
              </Button>
              <Button variant="ghost" size="sm" className="gap-1">
                H2 <ChevronDown className="size-3" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="icon">
                <Link className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBulletList}
                className={formatState.isBulletList ? "bg-gray-200" : ""}
              >
                <List className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNumberedList}
                className={formatState.isNumberedList ? "bg-gray-200" : ""}
              >
                <ListOrdered className="size-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Type className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <span>
                      {
                        documentContent
                          .split(/\s+/)
                          .filter(word => word.length > 0).length
                      }{" "}
                      words
                    </span>
                    <ChevronDown className="size-4 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-3">
                    <div className="rounded-md bg-gray-100 px-3 py-2">
                      <span className="font-medium text-gray-900">
                        {
                          documentContent
                            .split(/\s+/)
                            .filter(word => word.length > 0).length
                        }{" "}
                        words
                      </span>
                    </div>

                    <div className="text-sm text-gray-700">
                      {documentContent.length} characters
                    </div>

                    <div className="text-sm text-gray-700">
                      {Math.max(
                        1,
                        Math.ceil(
                          documentContent
                            .split(/\s+/)
                            .filter(word => word.length > 0).length / 200
                        )
                      )}{" "}
                      sec reading time
                    </div>

                    <div className="text-sm text-gray-700">
                      {Math.max(
                        1,
                        Math.ceil(
                          documentContent
                            .split(/\s+/)
                            .filter(word => word.length > 0).length / 150
                        )
                      )}{" "}
                      sec speaking time
                    </div>

                    <div className="text-sm text-gray-700">
                      Readability score —{" "}
                      {documentContent
                        .split(/\s+/)
                        .filter(word => word.length > 0).length < 10
                        ? "not enough text"
                        : "good"}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Collapsible */}
      <div
        className={`${rightPanelCollapsed ? "w-16" : "w-80"} min-w-${rightPanelCollapsed ? "16" : "80"} flex flex-col border-l border-gray-200 bg-white transition-all duration-300 ease-in-out`}
      >
        {/* Collapse/Expand Button */}
        <div className="absolute -left-12 top-1/2 z-30 -translate-y-1/2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="size-12 rounded-full border-2 border-gray-400 bg-white shadow-xl transition-all duration-200 hover:bg-gray-50 hover:shadow-2xl"
          >
            {rightPanelCollapsed ? (
              <ChevronRight className="size-8 text-gray-700" />
            ) : (
              <svg
                className="size-8 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            )}
          </Button>
        </div>

        {rightPanelCollapsed ? (
          /* Collapsed Panel */
          <div className="flex flex-col items-center space-y-4 py-4">
            <Button className="mt-8 h-auto w-32 origin-center -rotate-90 whitespace-nowrap bg-teal-600 px-2 py-1 text-xs text-white hover:bg-teal-700">
              CORRECT WITH ASSISTANT
            </Button>

            <div className="mt-8 flex flex-col items-center space-y-3">
              <div className="flex flex-col items-center">
                <div className="mb-1 flex size-6 items-center justify-center rounded-full bg-gray-500">
                  <span className="text-xs font-medium text-white">11</span>
                </div>
                <span className="w-16 origin-center -rotate-90 text-center text-xs leading-tight text-gray-600">
                  SUGGESTIONS
                </span>
              </div>

              <div className="mt-6 flex flex-col items-center">
                <div className="mb-1 flex size-6 items-center justify-center rounded-full bg-orange-500">
                  <span className="text-xs font-medium text-white">13</span>
                </div>
                <span className="w-16 origin-center -rotate-90 text-center text-xs leading-tight text-gray-600">
                  PRO
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded Panel */
          <>
            {/* Main tabs */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveMainTab("review")}
                  className={`flex-1 border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "review"
                      ? "border-teal-500 bg-teal-50 text-teal-600"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <div className="size-2 rounded-full bg-teal-600"></div>
                    <span className="text-center leading-tight">Review</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("smart-revise")}
                  className={`flex-1 border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "smart-revise"
                      ? "border-teal-500 bg-teal-50 text-teal-600"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="size-3" />
                    <span className="text-center leading-tight">
                      Smart Revise
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("ai-write")}
                  className={`flex-1 border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "ai-write"
                      ? "border-teal-500 bg-teal-50 text-teal-600"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="size-3" />
                    <span className="text-center leading-tight">AI Write</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Tab content - keep all existing tab content exactly the same */}
            {activeMainTab === "review" && (
              <div className="flex flex-1 flex-col">
                {/* Review suggestions header */}
                <div className="shrink-0 border-b border-gray-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">
                      Review suggestions
                    </h2>
                    <div className="flex size-6 items-center justify-center rounded-full bg-gray-100">
                      <span className="text-xs font-medium text-gray-600">
                        6
                      </span>
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="grid grid-cols-4 gap-2">
                    {tabs.map(tab => (
                      <div key={tab.id} className="text-center">
                        <div className="mb-2 h-2 rounded-full bg-gray-200">
                          <div
                            className={`h-full ${tab.color} rounded-full`}
                            style={{ width: `${tab.score}%` }}
                          ></div>
                        </div>
                        <span className="break-words text-xs text-gray-600">
                          {tab.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggestions list */}
                <div className="flex-1 overflow-y-auto">
                  {suggestions.map(suggestion => (
                    <div
                      key={suggestion.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <div className="p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-red-100">
                            <div className="size-2 rounded-full bg-red-500"></div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 break-words text-sm font-medium text-gray-900">
                              {suggestion.title}
                            </div>
                            <div className="mb-1 break-words text-sm font-medium text-gray-700">
                              {suggestion.word}
                            </div>
                            {suggestion.id === 1 && (
                              <div className="mb-3">
                                <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                  <span className="break-words">
                                    {suggestion.description}
                                  </span>
                                  <Info className="size-3 shrink-0" />
                                </div>
                                <div className="mb-3 break-words text-sm text-gray-700">
                                  {suggestion.preview}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-700"
                                  >
                                    Accept
                                  </Button>
                                  <Button size="sm" variant="outline">
                                    Dismiss
                                  </Button>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeMainTab === "smart-revise" && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="mb-2 font-medium text-gray-900">
                      Smart Revise
                    </h3>
                    <p className="break-words text-sm text-gray-500">
                      Revise your script with our smart actions to maximize
                      views, comments, shares, and virality.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => console.log("Shorten script")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          Shorten script to under 30 seconds
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => console.log("Write viral hook")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Write a viral hook</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => console.log("Rewrite conversational")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          Rewrite to be more conversational
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => console.log("Add onscreen text")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          Add suggestions for onscreen text
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => console.log("Add delivery tips")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          Add tips for verbal delivery
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeMainTab === "ai-write" && (
              <div className="flex flex-1 flex-col">
                {/* Chat messages area */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex h-full items-center justify-center text-gray-500">
                    <div className="max-w-full px-4 text-center">
                      <Sparkles className="mx-auto mb-4 size-12 text-gray-300" />
                      <h3 className="mb-2 font-medium text-gray-900">
                        What do you want to do?
                      </h3>
                      <p className="break-words text-sm text-gray-500">
                        Start a conversation to get AI assistance with your
                        writing
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat input area */}
                <div className="shrink-0 border-t border-gray-200 p-4">
                  <div className="flex gap-2">
                    <textarea
                      value={aiChatInput}
                      onChange={e => setAiChatInput(e.target.value)}
                      placeholder="Ask for any revision"
                      className="min-w-0 flex-1 resize-none rounded-lg border border-gray-200 p-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      rows={3}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          if (aiChatInput.trim()) {
                            // Handle send message here
                            console.log("Send message:", aiChatInput)
                            setAiChatInput("")
                          }
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!aiChatInput.trim()}
                      className="shrink-0 self-end bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300"
                      onClick={() => {
                        if (aiChatInput.trim()) {
                          // Handle send message here
                          console.log("Send message:", aiChatInput)
                          setAiChatInput("")
                        }
                      }}
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Modals */}
      <ContentGoalsModal
        open={goalsModalOpen}
        onOpenChange={setGoalsModalOpen}
      />
      <PerformanceModal
        open={performanceModalOpen}
        onOpenChange={setPerformanceModalOpen}
        documentContent={documentContent}
      />
    </div>
  )
}
