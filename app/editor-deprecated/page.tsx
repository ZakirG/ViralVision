"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Menu,
  Target,
  BarChart3,
  ChevronRight,
  ChevronLeft,
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
import { SuggestionPanel } from "./components/suggestion-panel"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  getDocumentByIdAction,
  updateDocumentAction
} from "@/actions/db/documents-actions"
import { 
  getSuggestionsByDocumentIdAction, 
  dismissSuggestionAction,
  acceptSuggestionAction
} from "@/actions/db/suggestions-actions"
import { 
  logSuggestionAcceptedAction, 
  logSuggestionRejectedAction,
  logGrammarCheckAction 
} from "@/actions/analytics-actions"
import { targetedRecheckAction } from "@/actions/targeted-recheck-actions"
import type { Document, Suggestion } from "@/db/schema"
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
  const [selectedSuggestionForPanel, setSelectedSuggestionForPanel] = useState<Suggestion | null>(null)
  const [suggestionPanelOpen, setSuggestionPanelOpen] = useState(false)
  const [realSuggestions, setRealSuggestions] = useState<Suggestion[]>([])
  const [isAcceptingSuggestion, setIsAcceptingSuggestion] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn, isLoaded } = useUser()
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const documentId = searchParams.get("doc")

  const loadDocument = useCallback(async () => {
    if (!documentId) return

    try {
      setLoading(true)
      const result = await getDocumentByIdAction(documentId)

      if (result.isSuccess && result.data) {
        setDocument(result.data)
        setDocumentContent(result.data.rawText || "")
        setDocumentTitle(result.data.title || "Untitled Document")
        
        // Initialize last saved content to prevent initial unnecessary save
        lastSavedContentRef.current = {
          title: result.data.title || "Untitled Document",
          content: result.data.rawText || ""
        }
        console.log("💾 SAVE: Document loaded, initialized lastSavedContent")
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
  }, [documentId, router])

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
  }, [isLoaded, isSignedIn, documentId, router, loadDocument])

  // Track last saved content to prevent unnecessary saves
  const lastSavedContentRef = useRef<{ title: string; content: string }>({ title: "", content: "" })

  const saveDocument = useCallback(async () => {
    if (!document || !documentId || saving) return

    try {
      setSaving(true)
      console.log("💾 SAVE: Updating document in database")
      const result = await updateDocumentAction(documentId, {
        title: documentTitle,
        rawText: documentContent
      })

      if (result.isSuccess) {
        // Update last saved content on successful save
        lastSavedContentRef.current = {
          title: documentTitle,
          content: documentContent
        }
        console.log("💾 SAVE: Document saved successfully, updated lastSavedContent")
      } else {
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

  // Auto-save functionality with change detection
  useEffect(() => {
    if (!document || !documentId || saving) return

    const saveTimeout = setTimeout(() => {
      // Only save if the component is still mounted and user is still on this page
      if (document && documentId && !saving) {
        // CRITICAL FIX: Only save if content actually changed
        const lastSaved = lastSavedContentRef.current
        const hasContentChanged = documentContent !== lastSaved.content
        const hasTitleChanged = documentTitle !== lastSaved.title
        
        if (hasContentChanged || hasTitleChanged) {
          console.log("💾 SAVE: Content changed, triggering auto-save:", {
            contentChanged: hasContentChanged,
            titleChanged: hasTitleChanged,
            oldContentLength: lastSaved.content.length,
            newContentLength: documentContent.length,
            oldTitle: lastSaved.title,
            newTitle: documentTitle
          })
          saveDocument()
        } else {
          console.log("🚫 SAVE: Content unchanged, skipping auto-save (preventing unnecessary POST)")
        }
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
    // Check if content actually changed before manual save
    const lastSaved = lastSavedContentRef.current
    const hasContentChanged = documentContent !== lastSaved.content
    const hasTitleChanged = documentTitle !== lastSaved.title
    
    if (hasContentChanged || hasTitleChanged) {
      console.log("💾 SAVE: Manual save - content changed")
      saveDocument()
      toast({
        title: "Saved",
        description: "Document saved successfully"
      })
    } else {
      console.log("💾 SAVE: Manual save - no changes to save")
      toast({
        title: "No Changes",
        description: "Document is already up to date"
      })
    }
  }, [saveDocument, documentContent, documentTitle])

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

  // ALL useCallback functions must be defined before any early returns
  
  // Formatting functions
  const handleBold = useCallback(() => {
    editorRef.current?.formatText("bold")
  }, [])

  const handleItalic = useCallback(() => {
    editorRef.current?.formatText("italic")
  }, [])

  const handleUnderline = useCallback(() => {
    editorRef.current?.formatText("underline")
  }, [])

  const handleBulletList = useCallback(() => {
    editorRef.current?.toggleBulletList()
  }, [])

  const handleNumberedList = useCallback(() => {
    editorRef.current?.toggleNumberedList()
  }, [])

  // Content handling functions
  const handleContentChange = useCallback((newContent: string) => {
    setDocumentContent(newContent)
  }, [])

  const handleFormatStateChange = useCallback((newFormatState: FormatState) => {
    setFormatState(newFormatState)
  }, [])

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      setCursorPosition(range.startOffset)
    }
  }, [])

  // Suggestion handling functions
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    console.log("🎯 PARENT: Suggestion clicked:", {
      id: suggestion.id,
      text: suggestion.suggestedText,
      startOffset: suggestion.startOffset,
      endOffset: suggestion.endOffset,
      isInCurrentList: realSuggestions.some(s => s.id === suggestion.id),
      currentListCount: realSuggestions.length,
      currentListIds: realSuggestions.map(s => s.id)
    })
    
    setSelectedSuggestionForPanel(suggestion)
    setSuggestionPanelOpen(true)
  }, [realSuggestions])

  const refreshSuggestions = useCallback(async () => {
    if (!documentId) return
    
    // Prevent refreshing while accepting a suggestion to avoid race conditions
    if (isAcceptingSuggestion) {
      console.log("🔄 PARENT: Skipping refreshSuggestions - currently accepting a suggestion")
      return
    }
    
    try {
      const result = await getSuggestionsByDocumentIdAction(documentId, 1)
      if (result.isSuccess && result.data) {
        setRealSuggestions(result.data)
      }
    } catch (error) {
      console.error("🔄 PARENT: Error refreshing suggestions:", error)
    }
  }, [documentId, isAcceptingSuggestion])

    const handleSuggestionAccept = useCallback(async (suggestion: Suggestion) => {
    // Prevent concurrent suggestion acceptance
    if (isAcceptingSuggestion) {
      console.log("⚡ PARENT: Already accepting a suggestion, ignoring this request")
      return
    }

    if (suggestion.startOffset == null || suggestion.endOffset == null || !suggestion.suggestedText) {
      toast({
        title: "Error",
        description: "Unable to apply suggestion - missing required data",
        variant: "destructive"
      })
      return
    }

    console.log("⚡ PARENT: INSTANT ACCEPT - Applying changes immediately:", {
      suggestionId: suggestion.id,
      suggestionText: suggestion.suggestedText
    })

    // ⚡ INSTANT STEP 1: Apply text change in editor immediately
    if (!editorRef.current) {
      toast({
        title: "Error",
        description: "Editor not available. Please try again.",
        variant: "destructive"
      })
      return
    }

    try {
      console.log("⚡ PARENT: Applying text change instantly in editor")
      editorRef.current.acceptSuggestion(suggestion)
      
      // ⚡ INSTANT STEP 2: Remove suggestion from UI immediately
      console.log("⚡ PARENT: Removing suggestion from UI instantly")
      setRealSuggestions(prev => {
        const filtered = prev.filter(s => s.id !== suggestion.id)
        console.log(`⚡ PARENT: Instantly removed suggestion from UI: ${prev.length} -> ${filtered.length}`)
        return filtered
      })
      
      // ⚡ INSTANT STEP 3: Show immediate feedback
      toast({
        title: "Applied!",
        description: `Changed to "${suggestion.suggestedText}"`,
        duration: 2000
      })
      
      // 🔄 BACKGROUND STEP 4: Do database operations asynchronously (non-blocking)
      console.log("🔄 PARENT: Starting background database operations...")
      
      // Set a brief lock to prevent multiple rapid clicks
      setIsAcceptingSuggestion(true)
      setTimeout(() => setIsAcceptingSuggestion(false), 1000)
      
      // Fire and forget - do all database operations in background
      const backgroundOperations = async () => {
        try {
          console.log("🔄 BACKGROUND: Marking suggestion as accepted in database")
          
          // Database operation 1: Mark as accepted
          const acceptResult = await acceptSuggestionAction(suggestion.id)
          
          if (!acceptResult.isSuccess) {
            // console.error("🔄 BACKGROUND: Database accept failed (non-critical):", acceptResult.message)
            // Don't show error to user since UI change already happened
          } else {
            console.log("🔄 BACKGROUND: Database accept successful")
          }
          
          // Database operation 2: Log analytics
          if (documentId) {
            await logSuggestionAcceptedAction(
              suggestion.id,
              suggestion.suggestionType || 'unknown',
              documentId
            )
            console.log("🔄 BACKGROUND: Analytics logged")
          }
          
          // Database operation 3: Targeted recheck for grammar suggestions
          if (suggestion.suggestionType === 'grammar') {
            console.log("🔄 BACKGROUND: Starting targeted recheck for grammar suggestion")
            
            // Calculate the NEW offsets after the text replacement
            const originalStart = suggestion.startOffset || 0
            const originalEnd = suggestion.endOffset || 0
            const suggestedText = suggestion.suggestedText || ""
            
            const newStart = originalStart
            const newEnd = originalStart + suggestedText.length
            
            console.log("🔄 BACKGROUND: Calculating recheck area:", {
              originalRange: `${originalStart}-${originalEnd}`,
              newRange: `${newStart}-${newEnd}`,
              suggestedTextLength: suggestedText.length,
              originalTextLength: originalEnd - originalStart
            })
            
            if (documentId) {
              const recheckResult = await targetedRecheckAction(
                documentContent,
                documentId,
                newStart,
                newEnd
              )
              
              if (recheckResult.isSuccess) {
                console.log("🔄 BACKGROUND: Targeted recheck completed successfully")
                const totalNewSuggestions = recheckResult.data.spellingSuggestions.length + recheckResult.data.grammarSuggestions.length
                
                if (totalNewSuggestions > 0) {
                  toast({
                    title: "Area Updated",
                    description: `Found ${totalNewSuggestions} new suggestions in affected area`,
                    duration: 3000
                  })
                }
                
                // Refresh suggestions to show new ones
                setTimeout(() => refreshSuggestions(), 200)
              } else {
                console.error("🔄 BACKGROUND: Targeted recheck failed:", recheckResult.message)
                // Fallback to regular refresh
                setTimeout(() => refreshSuggestions(), 500)
              }
            }
          } else {
            // For spelling suggestions, just refresh to ensure consistency
            console.log("🔄 BACKGROUND: Doing background refresh for spelling suggestion")
            setTimeout(() => refreshSuggestions(), 500)
          }
          
        } catch (error) {
          console.error("🔄 BACKGROUND: Error in background operations (non-critical):", error)
          // Fallback: refresh suggestions to ensure consistency
          setTimeout(() => refreshSuggestions(), 1000)
        }
      }
      
      // Execute background operations without awaiting
      backgroundOperations()
      
    } catch (error) {
      console.error("⚡ PARENT: Error during instant text application:", error)
      toast({
        title: "Error",
        description: "Failed to apply suggestion. Please try again.",
        variant: "destructive"
      })
      
      // Restore suggestion to UI if text application failed
      setRealSuggestions(prev => {
        if (!prev.find(s => s.id === suggestion.id)) {
          return [...prev, suggestion]
        }
        return prev
      })
    }
  }, [documentId, refreshSuggestions, isAcceptingSuggestion, documentContent])

  const handleSuggestionReject = useCallback(async (suggestion: Suggestion) => {
    console.log("🔍 DISMISSAL DEBUG: handleSuggestionReject called for suggestion:", {
      id: suggestion.id,
      text: suggestion.suggestedText,
      startOffset: suggestion.startOffset,
      endOffset: suggestion.endOffset
    })
    
    try {
      // Mark suggestion as dismissed in database
      console.log("🔍 DISMISSAL DEBUG: Calling dismissSuggestionAction for id:", suggestion.id, "with document content")
      const result = await dismissSuggestionAction(suggestion.id, documentContent)
      
      console.log("🔍 DISMISSAL DEBUG: dismissSuggestionAction result:", result)
      
      if (result.isSuccess) {
        console.log("🔍 DISMISSAL DEBUG: Dismissal successful, removing from local state")
        // Remove the dismissed suggestion from the list immediately
        setRealSuggestions(prev => {
          const filtered = prev.filter(s => s.id !== suggestion.id)
          console.log(`🎨 PARENT: Updated realSuggestions from ${prev.length} to ${filtered.length} suggestions`)
          return filtered
        })
        
        // Log analytics event
        if (documentId) {
          await logSuggestionRejectedAction(
            suggestion.id,
            suggestion.suggestionType || 'unknown',
            documentId
          )
        }
        
        toast({
          title: "Suggestion Dismissed",
          description: "The suggestion has been permanently hidden and won't appear again."
        })
      } else {
        console.log("🔍 DISMISSAL DEBUG: Dismissal failed:", result.message)
        toast({
          title: "Error",
          description: "Failed to dismiss suggestion. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("🔍 DISMISSAL DEBUG: Failed to dismiss suggestion:", error)
      toast({
        title: "Error", 
        description: "Failed to dismiss suggestion. Please try again.",
        variant: "destructive"
      })
    }
  }, [documentId, documentContent])

  const closeSuggestionPanel = useCallback(() => {
    setSuggestionPanelOpen(false)
    setSelectedSuggestionForPanel(null)
  }, [])

  // Protected suggestion update callback that respects the acceptance lock
  const handleSuggestionsUpdated = useCallback(() => {
    if (isAcceptingSuggestion) {
      console.log("🔄 PARENT: Skipping onSuggestionsUpdated callback - currently accepting a suggestion")
    } else {
      refreshSuggestions()
    }
  }, [isAcceptingSuggestion, refreshSuggestions])

  // Fetch suggestions when document loads or rejected suggestions change
  useEffect(() => {
    if (documentId && document) {
      refreshSuggestions()
    }
  }, [documentId, document, refreshSuggestions])

  // Use real suggestions from database instead of mock data
  // CRITICAL FIX: Stabilize suggestions prop to prevent cursor jumping
  // Only create new reference when suggestion IDs actually change
  const suggestions = useMemo(() => {
    return realSuggestions
  }, [realSuggestions.map(s => s.id).sort().join(',')]) // Only change when IDs change

  // Show loading state - this early return is now AFTER all hooks
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

  const tabs = [
    { id: "correctness", label: "Correctness", color: "bg-red-500", score: 85 },
    { id: "clarity", label: "Clarity", color: "bg-blue-500", score: 72 },
    { id: "engagement", label: "Engagement", color: "bg-green-500", score: 90 },
    { id: "structure", label: "Structure", color: "bg-purple-500", score: 68 }
  ]

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
            {/* {saving ? (
              <span className="text-sm text-gray-500">Saving...</span>
            ) : (
              <span className="text-sm text-gray-400">Saved</span>
            )} */}
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
            <div className="prose w-full max-w-none" spellCheck="false">
              <EditableContent
                ref={editorRef}
                initialContent={documentContent}
                onContentChange={handleContentChange}
                onFormatStateChange={handleFormatStateChange}
                documentId={documentId || undefined}
                onSuggestionClick={handleSuggestionClick}
                suggestions={suggestions}
                onSuggestionsUpdated={handleSuggestionsUpdated}
                isAcceptingSuggestion={isAcceptingSuggestion}
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

      {/* Collapse/Expand Button */}
      <div 
        className={`fixed top-1/2 z-30 -translate-y-1/2 transition-all duration-300 ease-in-out ${
          rightPanelCollapsed ? "right-20" : "right-[324px]"
        }`} 
        id="right-panel-collapse-button"
      >
        <Button
          variant="outline"
          size="lg"
          onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          className="size-12 rounded-full border-2 border-gray-400 bg-white shadow-xl transition-all duration-200 hover:bg-gray-50 hover:shadow-2xl"
        >
          {rightPanelCollapsed ? (
            <ChevronLeft className="size-8 text-gray-700" />
          ) : (
            <ChevronRight className="size-8 text-gray-700" />
          )}
        </Button>
      </div>

      {/* Right sidebar - Collapsible */}
      <div
        className={`${rightPanelCollapsed ? "w-16" : "w-80"} min-w-${rightPanelCollapsed ? "16" : "80"} flex flex-col border-l border-gray-200 bg-white transition-all duration-300 ease-in-out`}
      >

        {rightPanelCollapsed ? (
          /* Collapsed Panel */
          <div className="flex flex-col items-center space-y-6 py-4">
            <Button 
              className="mt-4 flex size-10 items-center justify-center rounded-full bg-teal-600 p-0 text-white hover:bg-teal-700"
              title="Correct with Assistant"
            >
              <Sparkles className="size-4" />
            </Button>

            <div className="flex flex-col items-center space-y-4">
              <div className="flex flex-col items-center" title="Suggestions">
                <div className="flex size-8 items-center justify-center rounded-full bg-gray-500">
                  <span className="text-sm font-medium text-white">{suggestions.length}</span>
                </div>
              </div>

              <div className="flex flex-col items-center" title="Pro Features">
                <div className="flex size-8 items-center justify-center rounded-full bg-orange-500">
                  <span className="text-sm font-medium text-white">13</span>
                </div>
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
                        {suggestions.length}
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
                <div className="flex-1 overflow-y-auto min-h-0">
                  {suggestions.length === 0 ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="mb-2 text-gray-500">No suggestions found</div>
                        <div className="text-sm text-gray-400">Start typing to get grammar and spelling suggestions</div>
                      </div>
                    </div>
                  ) : (
                    suggestions.map(suggestion => {
                      // Handle both spelling and grammar suggestions now
                      const suggestionTypeColor = suggestion.suggestionType === 'spelling' ? 'bg-red-100' : 'bg-blue-100';
                      const suggestionDotColor = suggestion.suggestionType === 'spelling' ? 'bg-red-500' : 'bg-blue-500';
                      const suggestionLabel = suggestion.suggestionType === 'spelling' ? 'Spelling' : 'Grammar';
                      
                      return (
                        <div
                          key={suggestion.id}
                          className="border-b border-gray-100 last:border-b-0 cursor-pointer"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="p-4 hover:bg-gray-50">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${suggestionTypeColor}`}>
                                <div className={`size-2 rounded-full ${suggestionDotColor}`}></div>
                              </div>
                              <div className="min-w-0 flex-1">
                                                              <div className="mb-1 break-words text-sm font-medium text-gray-900">
                                {suggestionLabel} suggestion
                              </div>
                                {suggestion.suggestedText && (
                                  <div className="mb-1 break-words text-sm font-medium text-green-700">
                                    "{suggestion.suggestedText}"
                                  </div>
                                )}
                                <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                  <span className="break-words">
                                    {suggestion.explanation || 'Click to see details'}
                                  </span>
                                  <Info className="size-3 shrink-0" />
                                </div>
                                {suggestion.confidence && (
                                  <div className="mb-2 text-xs text-gray-500">
                                    Confidence: {Math.round(parseFloat(suggestion.confidence) * 100)}%
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSuggestionAccept(suggestion);
                                    }}
                                  >
                                    Accept
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSuggestionReject(suggestion);
                                    }}
                                  >
                                    Dismiss
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
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

      {/* Suggestion Panel */}
      <SuggestionPanel
        suggestion={selectedSuggestionForPanel}
        isOpen={suggestionPanelOpen}
        onClose={closeSuggestionPanel}
        onAccept={handleSuggestionAccept}
        onReject={handleSuggestionReject}
      />
    </div>
  )
}
