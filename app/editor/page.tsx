"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Menu,
  Target,
  Settings,
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
  ChevronDown,
  Video
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
import { ImportTikTokModal } from "./components/import-tiktok-modal"
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
  logGrammarCheckAction,
  logFeatureUsageAction
} from "@/actions/analytics-actions"
import { targetedRecheckAction } from "@/actions/targeted-recheck-actions"
import { rewriteContentWithCritiqueAction } from "@/actions/openai-rewrite-actions"
import type { Document, Suggestion } from "@/db/schema"
import { toast } from "@/hooks/use-toast"
import type { ViralCritique } from "@/actions/openai-critique-actions"
import Image from "next/image"

// AI Quick Action Prompts
const QUICK_ACTION_PROMPTS = {
  shortenScript: `Rewrite this script to be under 30 seconds when spoken aloud, which should be under about 9 sentences when spoken casually. Keep the core message and key points, but make it much more concise and punchy. Focus on the most important information and remove any filler words or redundant phrases. The goal is to maintain impact while dramatically reducing length.`,
  
  addViralHook: `Add a compelling viral hook at the beginning of this script. The hook should grab attention within the first 3 seconds and make viewers want to keep watching. Use techniques like:
- Start with a surprising fact or statistic
- Ask a provocative question
- Create curiosity or mystery
- Use strong emotional language
- Make a bold claim or promise
Keep the rest of the script intact, just add the hook at the beginning.`,
  
  rewriteConversational: `Rewrite this script to sound more natural and conversational when spoken aloud. Make it feel like you're talking to a friend rather than reading from a script. Use:
- Contractions (don't, can't, won't, etc.)
- Natural speech patterns and flow
- Conversational transitions
- Relatable language and examples
- Questions and direct address to the viewer
Maintain the same core message but make it much more engaging and natural to speak.`,
  
  addOnscreenText: `Add suggestions for onscreen text that would enhance the video and stop a user dead in their tracks, make them curious to watch the video more. We only need to add onscreen text for the hook (first few sentences of the script) and then the call to action. Do not alter the paragraph breaks in the script. Your hook text should be a different phrasing of the hook and offer different information than the script. A good hook: Grabs attention in the first 3 seconds. The general topic of the video should be immediately clear from the onscreen text hook. If the audience is niche, the hook should include a specific audience call-out so that audiences know whether the video is for them and they stop scrolling. The hook should contain a moment of emotional tension, expectation, suspense, or confusion that makes the user stop scrolling to resolve the tension. An example of a good hook: 'SCIENTISTS ARE PUTTING LIVING BRAIN CELLS INTO COMPUTERS'. Notice how the onscreen text hook is SPECIFIC, INTERESTING, UNIQUE, and summarizes the video topic.
The onscreen text should be in square brackets, interspersed into the script. Format as: [Onscreen text: "suggested text"] at appropriate points in the script.`,
  
  addDeliveryTips: `Add delivery tips and performance notes in 3-4 places in this script to help with verbal delivery of specific lines or phrases in the script.
- Pacing and timing
- Emphasis on key words
- Tone and emotion
- Gestures or body language
- Pauses and breaks
- Voice inflection
Something to consider: hooks should generally be delivered with punchy, staccato inflection and at a generally fast pace.
Format as: [Delivery tip: "tip"] at appropriate points in the script.
Examples: [Delivery tip: Read this line with a staccato, punchy rhythm to emphasize how important this is.] [Delivery tip: Whisper the last few words of this line to make the idea seem like a secret.] [Delivery tip: Start the line out fast and then slow down towards then end to make the idea seem very dramatic.]`
}

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
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false)
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
  const [viralCritique, setViralCritique] = useState<ViralCritique | null>(null)
  const [isViralCritiqueLoading, setIsViralCritiqueLoading] = useState(false)
  const [applyingViralCritiqueKey, setApplyingViralCritiqueKey] = useState<string | null>(null)
  const [isViralCritiqueUpdating, setIsViralCritiqueUpdating] = useState(false)
  const [appliedViralCritiques, setAppliedViralCritiques] = useState<Set<string>>(new Set())
  const [aiResponse, setAiResponse] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn, isLoaded } = useUser()
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const documentId = searchParams.get("doc")

  // Function to calculate and format speaking time
  const calculateSpeakingTime = useCallback((content: string): string => {
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    const totalSeconds = Math.max(1, Math.ceil(wordCount * 0.3))
    
    if (totalSeconds < 60) {
      return `${totalSeconds} sec`
    } else {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      if (seconds === 0) {
        return `${minutes} min`
      } else {
        return `${minutes} min ${seconds} sec`
      }
    }
  }, [])

  // Simple hash function for viral critique content
  const hashViralCritiqueContent = useCallback((key: string, value: string): string => {
    // Create a simple hash based on the key and the first 100 characters of the value
    const content = `${key}:${value.substring(0, 100)}`
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `${key}-${Math.abs(hash).toString(36)}`
  }, [])

  // Load dismissed viral critiques from localStorage on mount
  useEffect(() => {
    if (documentId) {
      const storageKey = `dismissed-viral-critiques-${documentId}`
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const dismissedCritiques = JSON.parse(stored)
          setAppliedViralCritiques(new Set(dismissedCritiques))
        }
      } catch (error) {
        console.error("🚀 VIRAL CRITIQUE: Error loading dismissed critiques from localStorage:", error)
      }
    }
  }, [documentId])

  // Save dismissed viral critiques to localStorage whenever they change
  useEffect(() => {
    if (documentId && appliedViralCritiques.size > 0) {
      const storageKey = `dismissed-viral-critiques-${documentId}`
      try {
        const dismissedArray = Array.from(appliedViralCritiques)
        localStorage.setItem(storageKey, JSON.stringify(dismissedArray))
      } catch (error) {
        console.error("🚀 VIRAL CRITIQUE: Error saving dismissed critiques to localStorage:", error)
      }
    }
  }, [documentId, appliedViralCritiques])

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
          saveDocument()
          toast({
            title: "Saved",
            description: "Document saved successfully"
          })
        } else {
          toast({
            title: "No Changes",
            description: "Document is already up to date"
          })
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
    // Always update the document content, even during viral critique updates
    // The editor is now updated directly, so we just need to sync the parent state
    setDocumentContent(newContent)
  }, [documentContent])

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
    setSelectedSuggestionForPanel(suggestion)
    setSuggestionPanelOpen(true)
  }, [realSuggestions])

  const refreshSuggestions = useCallback(async () => {
    if (!documentId) return
    
    // Prevent refreshing while accepting a suggestion to avoid race conditions
    if (isAcceptingSuggestion) {
      
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
      editorRef.current.acceptSuggestion(suggestion)
      
      // ⚡ INSTANT STEP 2: Remove suggestion from UI immediately
      setRealSuggestions(prev => {
        const filtered = prev.filter(s => s.id !== suggestion.id)
        return filtered
      })
      
      // ⚡ INSTANT STEP 3: Show immediate feedback
      toast({
        title: "Applied!",
        description: `Changed to "${suggestion.suggestedText}"`,
        duration: 2000
      })
      
      // 🔄 BACKGROUND STEP 4: Do database operations asynchronously (non-blocking)
      
      // Set a brief lock to prevent multiple rapid clicks
      setIsAcceptingSuggestion(true)
      setTimeout(() => setIsAcceptingSuggestion(false), 1000)
      
      // Fire and forget - do all database operations in background
      const backgroundOperations = async () => {
        try {
          // Database operation 1: Mark as accepted
          const acceptResult = await acceptSuggestionAction(suggestion.id)
          
          if (!acceptResult.isSuccess) {
            // console.error("🔄 BACKGROUND: Database accept failed (non-critical):", acceptResult.message)
            // Don't show error to user since UI change already happened
          }
          
          // Database operation 2: Log analytics
          if (documentId) {
            await logSuggestionAcceptedAction(
              suggestion.id,
              suggestion.suggestionType || 'unknown',
              documentId
            )
          }
          
          // Database operation 3: Targeted recheck for grammar suggestions
          if (suggestion.suggestionType === 'grammar') {
            // Calculate the NEW offsets after the text replacement
            const originalStart = suggestion.startOffset || 0
            const originalEnd = suggestion.endOffset || 0
            const suggestedText = suggestion.suggestedText || ""
            
            const newStart = originalStart
            const newEnd = originalStart + suggestedText.length
            
            if (documentId) {
              const recheckResult = await targetedRecheckAction(
                documentContent,
                documentId,
                newStart,
                newEnd
              )
              
              if (recheckResult.isSuccess) {
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
    try {
      // Mark suggestion as dismissed in database
      const result = await dismissSuggestionAction(suggestion.id, documentContent)
      
      if (result.isSuccess) {
        // Remove the dismissed suggestion from the list immediately
        setRealSuggestions(prev => {
          const filtered = prev.filter(s => s.id !== suggestion.id)
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
      // Skip refresh while accepting a suggestion
      // console.log("🔄 PARENT: Skipping refresh due to suggestion acceptance in progress")
    } else {
      // console.log("🔄 PARENT: Calling refreshSuggestions")
      refreshSuggestions()
    }
  }, [isAcceptingSuggestion, refreshSuggestions])

  // Viral critique update callback
  const handleViralCritiqueUpdate = useCallback((critique: ViralCritique | null, isLoading: boolean) => {
    setViralCritique(critique)
    setIsViralCritiqueLoading(isLoading)
  }, [appliedViralCritiques])

  const handleViralCritiqueApply = useCallback(async (critiqueKey: string, critiqueValue: string) => {
    if (applyingViralCritiqueKey || !documentContent.trim()) {
      return
    }

    try {
      setApplyingViralCritiqueKey(critiqueKey)
      setIsViralCritiqueUpdating(true)

      // Call the rewrite action
      const result = await rewriteContentWithCritiqueAction(documentContent, critiqueValue)

      if (result.isSuccess && result.data) {
        // Replace the content in the editor using the editor's replaceContent method
        if (editorRef.current) {
          editorRef.current.replaceContent(result.data)
          
          // Apply italic formatting to text wrapped in square brackets
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.applyItalicToBrackets()
            }
          }, 100) // Small delay to ensure content is fully loaded
        } else {
          console.error("🚀 VIRAL CRITIQUE: Editor ref is null!")
        }
        
        // Mark this viral critique as applied
        const contentHash = hashViralCritiqueContent(critiqueKey, critiqueValue)
        setAppliedViralCritiques(prev => new Set([...prev, contentHash]))
        
        // Note: setDocumentContent will be called by the editor's onContentChange callback
        
        // Log analytics for viral critique usage
        if (documentId) {
          await logFeatureUsageAction(
            'viral_critique_applied',
            documentId,
            {
              critiqueType: critiqueKey,
              originalContentLength: documentContent.length,
              newContentLength: result.data.length
            }
          )
        }
        
        // Show success message
        toast({
          title: "Content Rewritten!",
          description: `Applied ${critiqueKey.replace(/_/g, ' ')} suggestion`,
          duration: 3000
        })
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to apply suggestion",
          variant: "destructive"
        })
        console.error("🚀 VIRAL CRITIQUE: Failed to apply suggestion:", result.message)
      }
    } catch (error) {
      console.error("🚀 VIRAL CRITIQUE: Error applying suggestion:", error)
      toast({
        title: "Error",
        description: "Failed to apply suggestion. Please try again.",
        variant: "destructive"
      })
    } finally {
      setApplyingViralCritiqueKey(null)
      // Delay clearing the update flag to prevent immediate reversion
      setTimeout(() => {
        setIsViralCritiqueUpdating(false)
      }, 1000)
    }
  }, [documentContent, applyingViralCritiqueKey, documentId])

  const handleTikTokContentImport = useCallback((importedContent: string) => {
    // Use the editor's insertContent method to append the content
    if (editorRef.current) {
      editorRef.current.insertContent(importedContent)
      
      // Apply italic formatting to text wrapped in square brackets
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.applyItalicToBrackets()
        }
      }, 100) // Small delay to ensure content is fully loaded
      
      // Trigger viral critique check after content import
      // Add a delay to ensure the content has been fully inserted
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.triggerViralCritique()
        }
      }, 1000) // 1 second delay to ensure content is fully inserted
    }
  }, [])

  const handleAiMessageSend = useCallback(async () => {
    if (!aiChatInput.trim() || isAiLoading) return

    try {
      setIsAiLoading(true)
      setAiResponse("")

      // Call OpenAI API
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: aiChatInput,
          systemPrompt: "You are ViralVision, an AI assistant that helps create viral video scripts. Write engaging, conversational scripts that are optimized for social media platforms like TikTok, Instagram Reels, and YouTube Shorts. Focus on creating hooks that grab attention, maintaining viewer engagement, and including calls to action."
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      const aiGeneratedScript = data.response

      // Set the AI response to display
      setAiResponse(aiGeneratedScript)

      // Append the AI response to the editor content
      if (editorRef.current) {
        const currentContent = documentContent
        const newContent = currentContent + '\n\n' + aiGeneratedScript
        editorRef.current.replaceContent(newContent)
        
        // Apply italic formatting to text wrapped in square brackets
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.applyItalicToBrackets()
          }
        }, 100)
      }

      // Clear the input
      setAiChatInput("")

      // Show success message
      toast({
        title: "Script Generated!",
        description: "AI script has been added to your editor",
        duration: 3000
      })

    } catch (error) {
      console.error('Error calling OpenAI:', error)
      toast({
        title: "Error",
        description: "Failed to generate script. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsAiLoading(false)
    }
  }, [aiChatInput, isAiLoading, documentContent])

  // Handle quick actions with AI rewriting
  const handleQuickAction = useCallback(async (actionType: keyof typeof QUICK_ACTION_PROMPTS) => {
    if (!documentContent.trim()) {
      toast({
        title: "No Content",
        description: "Please add some content to the editor first.",
        variant: "destructive"
      })
      return
    }

    if (applyingViralCritiqueKey) {
      toast({
        title: "Action in Progress",
        description: "Please wait for the current action to complete.",
        variant: "destructive"
      })
      return
    }

    try {
      setApplyingViralCritiqueKey(actionType)
      setIsViralCritiqueUpdating(true)
      
      const prompt = QUICK_ACTION_PROMPTS[actionType]
      const fullPrompt = `${prompt}\n\nScript:\n${documentContent}`
      
      // Call the rewrite action with the specific prompt
      const result = await rewriteContentWithCritiqueAction(documentContent, fullPrompt)

      if (result.isSuccess && result.data) {
        // Replace the content in the editor
        if (editorRef.current) {
          editorRef.current.replaceContent(result.data)
          
          // Apply italic formatting to text wrapped in square brackets
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.applyItalicToBrackets()
            }
          }, 100) // Small delay to ensure content is fully loaded
        } else {
          console.error("Quick Action: Editor ref is null!")
        }
        
        // Log analytics for quick action usage
        if (documentId) {
          await logFeatureUsageAction(
            'quick_action_applied',
            documentId,
            {
              actionType: actionType,
              originalContentLength: documentContent.length,
              newContentLength: result.data.length
            }
          )
        }
        
        // Show success message
        const actionNames = {
          shortenScript: "Shortened script",
          addViralHook: "Added viral hook",
          rewriteConversational: "Made conversational",
          addOnscreenText: "Added onscreen text",
          addDeliveryTips: "Added delivery tips"
        }
        
        toast({
          title: "Content Updated!",
          description: `${actionNames[actionType]} successfully`,
          duration: 3000
        })
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to apply quick action",
          variant: "destructive"
        })
        console.error("Quick Action: Failed to apply:", result.message)
      }
    } catch (error) {
      console.error("Quick Action: Error applying action:", error)
      toast({
        title: "Error",
        description: "Failed to apply quick action. Please try again.",
        variant: "destructive"
      })
    } finally {
      setApplyingViralCritiqueKey(null)
      // Delay clearing the update flag to prevent immediate reversion
      setTimeout(() => {
        setIsViralCritiqueUpdating(false)
      }, 1000)
    }
  }, [documentContent, applyingViralCritiqueKey, documentId])

  // Helper function to get colors and labels for different critique types
  const getCritiqueTypeStyle = useCallback((key: string) => {
    // Define available color schemes
    const colorSchemes = [
      { bg: 'bg-green-200', dot: 'bg-green-500' },
    ]
    
    // Create a simple hash from the key to consistently assign colors
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Use the hash to select a color scheme
    const colorIndex = Math.abs(hash) % colorSchemes.length
    const selectedColor = colorSchemes[colorIndex]
    
    // Generate a human-readable label from the key
    const label = `${key.charAt(0).toUpperCase() + key.slice(1).replace(/[_]/g, ' ')} suggestion`
    
    return {
      bg: selectedColor.bg,
      dot: selectedColor.dot,
      label: label
    }
  }, [])

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
          <div className="mx-auto flex size-20 animate-pulse items-center justify-center">
            <img 
              src="/logo.png" 
              alt="ViralVision Logo" 
              className="logo-standard"
            />
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
                className="flex cursor-pointer items-center justify-center transition-colors hover:opacity-80"
              >
                <img
                  src="/logo.png"
                  alt="ViralVision Logo"
                  className="logo-standard"
                />
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hidden"
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
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setTiktokModalOpen(true)}
            >
              <Video className="size-4" />
              Import script from TikTok
            </Button>
          </div>

          <div></div>
        </div>

        {/* Editor content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Text editor */}
          <div className="flex-1 overflow-auto p-8" style={{ paddingBottom: "100px" }}>
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
                onViralCritiqueUpdate={handleViralCritiqueUpdate}
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
                      ~{calculateSpeakingTime(documentContent)} speaking time
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
                      {calculateSpeakingTime(documentContent)} speaking time
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
          size="sm"
          onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          className="size-8 rounded-[4px] border bg-white shadow-xl transition-all duration-200 hover:bg-gray-50 hover:shadow-2xl"
        >
          {rightPanelCollapsed ? (
            <ChevronLeft className="size-6 text-gray-700" />
          ) : (
            <ChevronRight className="size-6 text-gray-700" />
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
              <div className="grid grid-cols-3">
                <button
                  onClick={() => setActiveMainTab("review")}
                  className={`border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "review"
                      ? "border-primary-brand bg-primary-brand-light text-primary-brand"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <div className="size-2 rounded-full bg-primary-brand"></div>
                    <span className="text-center leading-tight">Smart Review</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("smart-revise")}
                  className={`border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "smart-revise"
                      ? "border-primary-brand bg-primary-brand-light text-primary-brand"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="size-3" />
                    <span className="text-center leading-tight">
                      Quick Actions
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("ai-write")}
                  className={`border-b-2 px-2 py-3 text-xs font-medium ${
                    activeMainTab === "ai-write"
                      ? "border-primary-brand bg-primary-brand-light text-primary-brand"
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

            {/* Tab content */}
                        {activeMainTab === "review" && (
              <div className="flex flex-1 flex-col overflow-y-scroll" id='wrapper-suggestions'>
                {/* Script Critique Loading Indicator */}
                {isViralCritiqueLoading && (!viralCritique || Object.keys(viralCritique).length === 0) && (
                  <div className="border-b border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-4 w-4 border border-purple-400 border-t-transparent rounded-full"></div>
                      <span className="text-sm text-gray-600">Script critique loading...</span>
                    </div>
                  </div>
                )}

                {/* Viral Critique Applying Indicator */}
                {applyingViralCritiqueKey && (
                  <div className="border-b border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-4 w-4 border border-teal-400 border-t-transparent rounded-full"></div>
                      <span className="text-sm text-gray-600">Applying suggestion...</span>
                    </div>
                  </div>
                )}

                {/* Viral Critique Suggestions */}
                {viralCritique && Object.keys(viralCritique).length > 0 && (
                  <div className="space-y-0 border-b border-gray-200">
                    {(() => {
                      const allEntries = Object.entries(viralCritique)
                      const filteredEntries = allEntries.filter(([key, value]) => {
                        const contentHash = hashViralCritiqueContent(key, value)
                        const isDismissed = appliedViralCritiques.has(contentHash)
                        return !isDismissed
                      })
                      
                      return filteredEntries.map(([key, value]) => {
                        const style = getCritiqueTypeStyle(key)
                        const contentHash = hashViralCritiqueContent(key, value)
                        return (
                          <div key={key} className="border-b border-gray-100 last:border-b-0">
                            <div className="p-4 hover:bg-gray-50">
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                                  <div className={`size-2 rounded-full ${style.dot}`}></div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 break-words text-sm font-medium text-gray-900">
                                    {style.label}
                                  </div>
                                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                    <span 
                                      className="break-words"
                                      dangerouslySetInnerHTML={{ __html: value }}
                                    />
                                    <Info className="size-3 shrink-0" />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-teal-600 hover:bg-teal-700"
                                      onClick={() => handleViralCritiqueApply(key, value)}
                                      disabled={applyingViralCritiqueKey !== null}
                                    >
                                      {applyingViralCritiqueKey === key ? "Applying..." : "Apply"}
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        const contentHash = hashViralCritiqueContent(key, value)
                                        // Add the content hash to appliedViralCritiques to prevent this specific suggestion from appearing again
                                        setAppliedViralCritiques(prev => new Set([...prev, contentHash]))
                                        toast({
                                          title: "Suggestion Dismissed",
                                          description: "This specific suggestion has been dismissed and won't appear again.",
                                          duration: 3000
                                        })
                                      }}
                                      disabled={applyingViralCritiqueKey !== null}
                                    >
                                      Dismiss
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {/* Grammar & Spelling Suggestions */}
                <div className="flex-1 min-h-0 spelling-and-grammar-suggestions">
                  {suggestions.length === 0 ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="mb-2 text-gray-500">No spelling or grammar suggestions found</div>
                        <div className="text-sm text-gray-400">Start typing to get spelling and grammar suggestions</div>
                      </div>
                    </div>
                  ) : (
                    suggestions.map(suggestion => {
                      // Handle both spelling and grammar suggestions now
                      const suggestionTypeColor = suggestion.suggestionType === 'spelling' ? 'bg-red-100' : 'bg-yellow-100';
                      const suggestionDotColor = suggestion.suggestionType === 'spelling' ? 'bg-red-500' : 'bg-yellow-500';
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
                                  <span 
                                    className="break-words"
                                    dangerouslySetInnerHTML={{ __html: suggestion.explanation || 'Click to see details' }}
                                  />
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
                                    Apply
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
                  {/* Quick Action Loading Indicator */}
                  {applyingViralCritiqueKey && (
                    <div className="rounded-lg bg-blue-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin h-4 w-4 border border-blue-400 border-t-transparent rounded-full"></div>
                        <span className="text-sm text-blue-700">
                          {applyingViralCritiqueKey === 'shortenScript' && "Shortening script..."}
                          {applyingViralCritiqueKey === 'addViralHook' && "Adding viral hook..."}
                          {applyingViralCritiqueKey === 'rewriteConversational' && "Making conversational..."}
                          {applyingViralCritiqueKey === 'addOnscreenText' && "Adding onscreen text..."}
                          {applyingViralCritiqueKey === 'addDeliveryTips' && "Adding delivery tips..."}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="mb-2 font-medium text-gray-900">
                      Quick Actions
                    </h3>
                    <p className="break-words text-sm text-gray-500">
                      Revise your script with AI to maximize
                      views, comments, shares, and virality.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => handleQuickAction('addViralHook')}
                      disabled={applyingViralCritiqueKey !== null}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">⚓ Add a viral hook</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => handleQuickAction('addOnscreenText')}
                      disabled={applyingViralCritiqueKey !== null}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                        📖 Add suggestions for onscreen text
                        </span>
                      </div>
                    </Button>


                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => handleQuickAction('shortenScript')}
                      disabled={applyingViralCritiqueKey !== null}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          ⏱️ Shorten script to under 30 seconds
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => handleQuickAction('addDeliveryTips')}
                      disabled={applyingViralCritiqueKey !== null}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          🎤 Add tips for verbal delivery
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => handleQuickAction('rewriteConversational')}
                      disabled={applyingViralCritiqueKey !== null}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          💬 Rewrite to be more conversational
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeMainTab === "ai-write" && (
              <div className="flex flex-1 flex-col overflow-y-scroll">
                {/* Chat messages area */}
                <div className="flex-1 overflow-y-auto p-4">
                  {aiResponse ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-gray-100 p-3">
                        <div className="text-sm font-medium text-gray-900 mb-2">Your request:</div>
                        <div className="text-sm text-gray-700">{aiChatInput}</div>
                      </div>
                      <div className="rounded-lg bg-teal-50 p-3">
                        <div className="text-sm font-medium text-teal-900 mb-2">AI Generated Script:</div>
                        <div className="text-sm text-teal-800 whitespace-pre-wrap">{aiResponse}</div>
                      </div>
                    </div>
                  ) : isAiLoading ? (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      <div className="max-w-full px-4 text-center">
                        <div className="animate-spin h-8 w-8 border border-teal-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-sm text-gray-600">Generating your viral script...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">
                      <div className="max-w-full px-4 text-center">
                        <Sparkles className="mx-auto mb-4 size-12 text-gray-300" />
                        <h3 className="mb-2 font-medium text-gray-900">
                          What video topic would you like ViralVision to write a script for?
                        </h3>
                        <p className="break-words text-sm text-gray-500">
                          Describe your video idea and we'll generate a viral script for you
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input area */}
                <div className="shrink-0 border-t border-gray-200 p-4">
                  <div className="flex gap-2">
                    <textarea
                      value={aiChatInput}
                      onChange={e => setAiChatInput(e.target.value)}
                      placeholder="What's your video about?"
                      className="min-w-0 flex-1 resize-none rounded-lg border border-gray-200 p-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      rows={3}
                      disabled={isAiLoading}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleAiMessageSend()
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!aiChatInput.trim() || isAiLoading}
                      className="shrink-0 self-end bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300"
                      onClick={handleAiMessageSend}
                    >
                      {isAiLoading ? (
                        <div className="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"></div>
                      ) : (
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
                      )}
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
      <ImportTikTokModal
        open={tiktokModalOpen}
        onOpenChange={setTiktokModalOpen}
        onContentImport={handleTikTokContentImport}
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
