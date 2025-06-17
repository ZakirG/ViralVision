"use client"

import type React from "react"
import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback
} from "react"
import { checkGrammarWithLanguageToolAction } from "@/actions/languagetool-actions"
import { getSuggestionsByDocumentIdAction } from "@/actions/db/suggestions-actions"
import type { Suggestion } from "@/db/schema"

// Simple debounce function
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }) as T
}

interface EditableContentProps {
  initialContent: string
  onContentChange: (content: string) => void
  onFormatStateChange?: (formatState: FormatState) => void
  documentId?: string
  onSuggestionClick?: (suggestion: Suggestion) => void
  onSuggestionsUpdated?: () => void
}

interface FormatState {
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  isBulletList: boolean
  isNumberedList: boolean
}

export interface EditableContentRef {
  formatText: (command: string) => void
  toggleBulletList: () => void
  toggleNumberedList: () => void
  focus: () => void
}

export const EditableContent = forwardRef<
  EditableContentRef,
  EditableContentProps
>(({ initialContent, onContentChange, onFormatStateChange, documentId, onSuggestionClick, onSuggestionsUpdated }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)


  // Debug suggestions state changes
  useEffect(() => {
    // console.log("🔄 Suggestions state changed to:", suggestions.length, "suggestions")
    // suggestions.forEach((s, i) => {
    //   console.log(`🔄 Suggestion ${i}: ${s.suggestionType} "${s.suggestedText}" at ${s.startOffset}-${s.endOffset}`)
    // })
  }, [suggestions])
  const lastCleanTextRef = useRef<string>("")
  const isUpdatingContentRef = useRef(false)
  const isProcessingEnterRef = useRef(false)
  const isProcessingUserInputRef = useRef(false)
  const pendingSuggestionUpdateRef = useRef(false)
  const [textContent, setTextContent] = useState(initialContent)



  // Get clean text content from editor, stripping all HTML
  const getCleanTextContent = useCallback(() => {
    // console.log("🧹 CLIENT: getCleanTextContent called")
    
    if (!editorRef.current) {
      // console.log("🧹 CLIENT: getCleanTextContent - no editorRef.current, returning empty string")
      return ''
    }
    
    const innerHTML = editorRef.current.innerHTML
    // console.log("🧹 CLIENT: getCleanTextContent - innerHTML:", innerHTML)
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = innerHTML
    
    // Remove all suggestion span elements
    const suggestionSpans = tempDiv.querySelectorAll('.suggestion-underline, .suggestion-selected')
    suggestionSpans.forEach(span => {
      const parent = span.parentNode
      if (parent) {
        // Replace the span with its text content
        const textNode = document.createTextNode(span.textContent || '')
        parent.replaceChild(textNode, span)
      }
    })
    
    // Convert <br> tags to newlines
    const brTags = tempDiv.querySelectorAll('br')
    brTags.forEach(br => {
      br.replaceWith('\n')
    })
    
    // Handle block-level elements (div, p, etc.) by adding newlines
    const blockElements = tempDiv.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6')
    blockElements.forEach(element => {
      // Add newline before the element if it's not the first child
      if (element.previousSibling) {
        element.insertAdjacentText('beforebegin', '\n')
      }
      // Replace the element with its text content
      element.replaceWith(element.textContent || '')
    })
    
    const cleanText = tempDiv.textContent || ''
    // console.log("🧹 CLIENT: getCleanTextContent - cleanText:", cleanText)
    return cleanText
  }, [])

  // Save cursor position based on text content (not DOM structure)
  const saveCursorPosition = useCallback(() => {
    if (!editorRef.current) {
      return 0
    }
    
    try {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        return 0
      }
      
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(editorRef.current)
      preCaretRange.setEnd(range.startContainer, range.startOffset)
      
      // Get text position without HTML tags
      const tempDiv = document.createElement('div')
      tempDiv.appendChild(preCaretRange.cloneContents())
      
      // Clean up suggestion spans in the range
      const suggestionSpans = tempDiv.querySelectorAll('.suggestion-underline')
      suggestionSpans.forEach(span => {
        const textNode = document.createTextNode(span.textContent || '')
        span.parentNode?.replaceChild(textNode, span)
      })
      
      const position = (tempDiv.textContent || "").length
      return position
    } catch (error) {
      console.error("saveCursorPosition: Failed to save cursor position:", error)
      return 0
    }
  }, [])

  // Restore cursor position based on text content
  const restoreCursorPosition = useCallback((position: number) => {
    if (!editorRef.current) {
      return
    }

    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )

    let charCount = 0
    let node = walker.nextNode()

    while (node) {
      const nodeLength = node.textContent?.length || 0
      
      if (charCount + nodeLength >= position) {
        const range = document.createRange()
        const selection = window.getSelection()
        
        const offset = Math.min(position - charCount, nodeLength)
        range.setStart(node, Math.max(0, offset))
        range.collapse(true)
        
        selection?.removeAllRanges()
        selection?.addRange(range)
        break
      }
      
      charCount += nodeLength
      node = walker.nextNode()
    }
  }, [])

  // Fetch suggestions for the document
  const fetchSuggestions = useCallback(async (docId: string) => {
    try {
      // console.log("📡 fetchSuggestions starting for docId:", docId)
      setLoadingSuggestions(true)
      const result = await getSuggestionsByDocumentIdAction(docId, 1) // Version 1
      // console.log("📡 getSuggestionsByDocumentIdAction result:", result)
      
              if (result.isSuccess && result.data) {
          console.log("🔍 DISMISSAL DEBUG: Raw suggestions from DB:", result.data.length, "suggestions")
          result.data.forEach((s, i) => {
            console.log(`🔍 DISMISSAL DEBUG: Suggestion ${i}:`, {
              id: s.id,
              accepted: s.accepted,
              dismissed: s.dismissed, // Add dismissed field debug
              text: s.suggestedText,
              startOffset: s.startOffset,
              endOffset: s.endOffset,
              type: s.suggestionType
            })
          })
        
        // Database already filters out dismissed and accepted suggestions
        // console.log("📡 Raw suggestions from DB:", result.data.length, "suggestions")
        result.data.forEach((s, i) => {
          console.log(`📡 Suggestion ${i}:`, {
            id: s.id,
            accepted: s.accepted,
            text: s.suggestedText,
            startOffset: s.startOffset,
            endOffset: s.endOffset,
            type: s.suggestionType
          })
        })
        // console.log("📡 Setting suggestions state to:", result.data.length, "suggestions")
        setSuggestions(result.data)
      } else {
        // console.log("📡 No suggestions or error:", result.message)
      }
    } catch (error) {
      // console.error("❌ Error fetching suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
      // console.log("📡 fetchSuggestions finished")
    }
  }, [])



  // Debounced grammar check function
  const debouncedGrammarCheck = useCallback(
    debounce(async (text: string, docId: string) => {
      try {
        // console.log("🚀 CLIENT: debouncedGrammarCheck starting for docId:", docId, "text length:", text.length)
        setIsCheckingGrammar(true)
        
        const result = await checkGrammarWithLanguageToolAction(text, docId)
        // console.log("✅ CLIENT: Grammar check completed, suggestions returned:", result.isSuccess ? result.data?.length || 0 : 0)
        
        if (result.isSuccess && result.data && Array.isArray(result.data)) {
          // Store the text that was used for this grammar check.
          lastCleanTextRef.current = text; 

          const newSuggestions = result.data as Suggestion[]
          // console.log("📥 CLIENT: Processing", newSuggestions.length, "new suggestions from grammar check")
          
          // **CRITICAL FIX**: After grammar check, re-fetch suggestions from database
          // to ensure dismissed suggestions don't reappear. The database is the source of truth.
          console.log("🔍 DISMISSAL DEBUG: Grammar check returned", newSuggestions.length, "suggestions, now re-fetching from DB")
          console.log("🔍 DISMISSAL DEBUG: New suggestions from grammar API:", newSuggestions.map(s => ({id: s.id, text: s.suggestedText})))
          
          // Re-sync with database to ensure dismissed suggestions are properly filtered
          if (documentId) {
            console.log("🔍 DISMISSAL DEBUG: Calling fetchSuggestions to get filtered results from database")
            await fetchSuggestions(documentId)
          }
          
          // Notify parent component that suggestions have been updated
          if (onSuggestionsUpdated) {
            // console.log("📥 CLIENT: Notifying parent of suggestion updates")
            onSuggestionsUpdated()
          }
        } else {
          // console.log("❌ CLIENT: No valid suggestions in grammar check result:", result.message)
          setSuggestions([])
        }
      } catch (error) {
        // console.error("❌ CLIENT: Grammar check error:", error)
        setSuggestions([])
      } finally {
        setIsCheckingGrammar(false)
        console.log("🏁 CLIENT: Grammar check finished")
      }
    }, 1000), // 1 second debounce delay for faster feedback
    [fetchSuggestions, documentId, onSuggestionsUpdated] // Updated dependencies
  )

  const updateContent = useCallback(() => {
    // console.log("🔵 CLIENT: updateContent called")
    
    if (isUpdatingContentRef.current) {
      console.log("🟡 CLIENT: updateContent skipped - isUpdatingContentRef is true")
      return
    }

    // Get clean text for comparison and grammar checking
    const cleanText = getCleanTextContent()
    
    // Get rich HTML content for saving (preserve formatting)
    const richContent = editorRef.current?.innerHTML || ''

    console.log("🟢 CLIENT: updateContent - cleanText:", cleanText.substring(0, 50) + "...")
    console.log("🟢 CLIENT: updateContent - textContent:", textContent.substring(0, 50) + "...")
    console.log("🟢 CLIENT: updateContent - documentId:", documentId)
    console.log("🟢 CLIENT: updateContent - cleanText.trim().length:", cleanText.trim().length)

    if (cleanText !== textContent) {
      console.log("🟢 CLIENT: Content changed! Setting new text content")
      setTextContent(cleanText)
      // Pass rich HTML content to maintain formatting when saving
      onContentChange(richContent)
      
      // Use the debounced grammar check function
      if (documentId && cleanText.trim()) {
        console.log("🟢 CLIENT: Triggering debouncedGrammarCheck with documentId:", documentId, "text:", cleanText)
        debouncedGrammarCheck(cleanText, documentId)
      } else {
        console.log("🔴 CLIENT: NOT triggering grammar check - documentId:", documentId, "cleanText length:", cleanText.trim().length)
      }
    } else {
      console.log("🟡 CLIENT: Content unchanged, skipping grammar check")
    }
  }, [textContent, onContentChange, documentId, getCleanTextContent, debouncedGrammarCheck])

  // Update innerHTML with highlighted suggestions while preserving cursor
  const updateContentWithSuggestions = useCallback((textContent: string, caller?: string) => {
    console.log("🎭 updateContentWithSuggestions called by:", caller, "text length:", textContent.length)
    
    if (!editorRef.current || isUpdatingContentRef.current) {
      console.log("🎭 Skipping - editorRef.current:", !!editorRef.current, "isUpdatingContentRef.current:", isUpdatingContentRef.current)
      return
    }
    
    if (isProcessingEnterRef.current || isProcessingUserInputRef.current) {
      console.log("🎭 Fast update without cursor preservation")
      // Still update the content but without cursor preservation
      isUpdatingContentRef.current = true
      const highlightedHTML = highlightSuggestions(textContent)
      editorRef.current.innerHTML = highlightedHTML
      isUpdatingContentRef.current = false
      return
    }
    
    isUpdatingContentRef.current = true
    const cursorPosition = saveCursorPosition()
    
    // Generate highlighted HTML
    const highlightedHTML = highlightSuggestions(textContent)
    editorRef.current.innerHTML = highlightedHTML
    
    // Restore cursor position after a brief delay
    setTimeout(() => {
      restoreCursorPosition(cursorPosition)
      isUpdatingContentRef.current = false
    }, 0)
  }, [saveCursorPosition, restoreCursorPosition, suggestions])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const inputType = (e.nativeEvent as InputEvent).inputType
    
    // Track that we're processing user input
    isProcessingUserInputRef.current = true
    
    updateContent()
    
    // Clear the flag after a brief delay to allow all effects to complete
    setTimeout(() => {
      isProcessingUserInputRef.current = false
      
      // Process any pending suggestion updates
      if (pendingSuggestionUpdateRef.current) {
        pendingSuggestionUpdateRef.current = false
        const currentContent = getCleanTextContent()
        updateContentWithSuggestions(currentContent, "handleInput")
      }
    }, 100)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let Enter key handle naturally, then clean up content
    if (e.key === 'Enter') {
      isProcessingEnterRef.current = true
      pendingSuggestionUpdateRef.current = false
      
      // Clear the flag after Enter has been processed naturally - extended timeout
      setTimeout(() => {
        isProcessingEnterRef.current = false
        updateContent()
        
        // Process any pending suggestion updates
        if (pendingSuggestionUpdateRef.current) {
          pendingSuggestionUpdateRef.current = false
          setTimeout(() => {
            if (editorRef.current) {
              const currentContent = getCleanTextContent()
              updateContentWithSuggestions(currentContent, "handleKeyDown")
            }
          }, 50) // Small additional delay to ensure DOM is ready
        }
      }, 100) // Increased delay to allow DOM to fully update
    }
  }, [updateContent, getCleanTextContent, updateContentWithSuggestions])

  useImperativeHandle(ref, () => ({
    formatText: (command: string) => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand(command, false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    toggleBulletList: () => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand("insertUnorderedList", false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    toggleNumberedList: () => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand("insertOrderedList", false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    focus: () => {
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }
  }))

  const updateFormatState = () => {
    if (!onFormatStateChange) return

    const formatState: FormatState = {
      isBold: document.queryCommandState("bold"),
      isItalic: document.queryCommandState("italic"),
      isUnderlined: document.queryCommandState("underline"),
      isBulletList: document.queryCommandState("insertUnorderedList"),
      isNumberedList: document.queryCommandState("insertOrderedList")
    }

    onFormatStateChange(formatState)
  }

  const handleSelectionChange = () => {
    updateFormatState()
  }

  const highlightSuggestions = (text: string) => {
    if (!suggestions.length) {
      return text.replace(/\n/g, "<br>")
    }

    let highlightedText = text
    
    // Sort suggestions by start offset in descending order to avoid offset conflicts
    const sortedSuggestions = [...suggestions].sort((a, b) => 
      (b.startOffset || 0) - (a.startOffset || 0)
    )


    sortedSuggestions.forEach((suggestion, index) => {
      if (suggestion.startOffset !== null && suggestion.endOffset !== null) {
        const beforeText = highlightedText.substring(0, suggestion.startOffset)
        const suggestionText = highlightedText.substring(suggestion.startOffset, suggestion.endOffset)
        const afterText = highlightedText.substring(suggestion.endOffset)
        
        console.log(`🖍️ Highlighting suggestion ${index}:`, {
          startOffset: suggestion.startOffset,
          endOffset: suggestion.endOffset,
          originalText: suggestionText,
          suggestionType: suggestion.suggestionType
        })
        
        const suggestionType = suggestion.suggestionType === 'spelling' ? 'red' : 'blue'
        const wrappedText = `<span class="suggestion-underline cursor-pointer underline decoration-${suggestionType}-500 decoration-2 decoration-wavy" data-suggestion-id="${suggestion.id}" title="${suggestion.explanation || 'Click for suggestion'}">${suggestionText}</span>`
        
        highlightedText = beforeText + wrappedText + afterText
      } else {
        console.log(`🖍️ Skipping suggestion ${index} - invalid offsets:`, suggestion.startOffset, suggestion.endOffset)
      }
    })

    const result = highlightedText.replace(/\n/g, "<br>")
    return result
  }

  // Helper function to extract clean text from HTML content
  const extractCleanTextFromHTML = useCallback((htmlContent: string) => {
    // If it's already plain text (no HTML tags), return as-is
    if (!htmlContent.includes('<') && !htmlContent.includes('>')) {
      return htmlContent
    }
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    
    // Remove suggestion spans
    const suggestionSpans = tempDiv.querySelectorAll('.suggestion-underline, .suggestion-selected')
    suggestionSpans.forEach(span => {
      const parent = span.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span)
      }
    })
    
    // Convert <br> tags to newlines
    const brTags = tempDiv.querySelectorAll('br')
    brTags.forEach(br => {
      br.replaceWith('\n')
    })
    
    // Handle block-level elements
    const blockElements = tempDiv.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6')
    blockElements.forEach(element => {
      if (element.previousSibling) {
        element.insertAdjacentText('beforebegin', '\n')
      }
      element.replaceWith(element.textContent || '')
    })
    
    return tempDiv.textContent || ''
  }, [])

  // Fetch suggestions when component mounts or documentId changes
  useEffect(() => {
    if (documentId) {
      fetchSuggestions(documentId)
    }
      }, [documentId, fetchSuggestions])



  // Store suggestions in ref to avoid dependency issues
  const suggestionsRef = useRef<Suggestion[]>([])
  
  // Update suggestions ref when suggestions change
  useEffect(() => {
    suggestionsRef.current = suggestions
  }, [suggestions])



  // Update content when suggestions change
  useEffect(() => {
    
    if (editorRef.current && isInitialized) {
      // Skip if any user input is being processed to avoid using stale content
      if (isProcessingEnterRef.current || isProcessingUserInputRef.current) {
        pendingSuggestionUpdateRef.current = true
        return
      }
      
      // Use getCleanTextContent() to get actual current content, not stale textContent
      const currentContent = getCleanTextContent()
      updateContentWithSuggestions(currentContent, "useEffect[suggestions]")
    } else {
      // console.log("🎨 Skipping suggestion update - editorRef.current:", !!editorRef.current, "isInitialized:", isInitialized)
    }
  }, [suggestions, isInitialized, updateContentWithSuggestions, getCleanTextContent])

  // Update editor when initialContent changes (e.g., when suggestion is accepted)
  useEffect(() => {
    if (editorRef.current && isInitialized && initialContent !== editorRef.current.textContent) {
      // Skip if any user input is being processed to avoid cursor jumping
      if (isProcessingEnterRef.current || isProcessingUserInputRef.current) {
        return
      }
      
      // For suggestion updates, use clean text to ensure proper positioning
      const cleanInitialContent = extractCleanTextFromHTML(initialContent)
      updateContentWithSuggestions(cleanInitialContent, "useEffect[initialContent]")
    }
  }, [initialContent, isInitialized, suggestions, updateContentWithSuggestions, extractCleanTextFromHTML])

  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      // Check if initialContent is rich HTML or plain text
      const isRichHTML = initialContent.includes('<') && initialContent.includes('>')
      
      if (isRichHTML) {
        // If rich HTML, set the HTML directly but extract clean text for comparison
        editorRef.current.innerHTML = initialContent
        const cleanText = extractCleanTextFromHTML(initialContent)
        setTextContent(cleanText)
      } else {
        // If plain text, apply suggestion highlighting
        editorRef.current.innerHTML = highlightSuggestions(initialContent)
        setTextContent(initialContent)
      }

      // Focus the editor on mount
      editorRef.current.focus()

      // Set cursor to end of content
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)

      setIsInitialized(true)
    }
  }, [initialContent, isInitialized, suggestions, extractCleanTextFromHTML])

  useEffect(() => {
    const handleSelectionChangeGlobal = () => {
      if (document.activeElement === editorRef.current) {
        updateFormatState()
      }
    }

    const handleSuggestionClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('suggestion-underline')) {
        e.preventDefault()
        e.stopPropagation()
        
        const suggestionId = target.dataset.suggestionId
        if (suggestionId && onSuggestionClick) {
          const suggestion = suggestions.find(s => s.id === suggestionId)
          if (suggestion) {
            onSuggestionClick(suggestion)
          }
        }
      }
    }

    document.addEventListener("selectionchange", handleSelectionChangeGlobal)
    if (editorRef.current) {
      editorRef.current.addEventListener("click", handleSuggestionClick)
    }

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChangeGlobal)
      if (editorRef.current) {
        editorRef.current.removeEventListener("click", handleSuggestionClick)
      }
    }
  }, [suggestions, onSuggestionClick])

  return (
    <>
      <style jsx>{`
        .editor-content {
          caret-color: #374151;
        }

        .editor-content:focus {
          outline: none;
        }

        .editor-content::selection {
          background-color: #dbeafe;
        }

        .editor-content::-moz-selection {
          background-color: #dbeafe;
        }

        .editor-content b,
        .editor-content strong {
          font-weight: bold;
        }

        .editor-content i,
        .editor-content em {
          font-style: italic;
        }

        .editor-content u {
          text-decoration: underline;
        }

        .editor-content .error-highlight {
          text-decoration: underline;
          text-decoration-color: #ef4444;
          text-decoration-style: wavy;
          text-decoration-thickness: 2px;
        }

        /* Suggestion underline styles */
        .editor-content .suggestion-underline {
          cursor: pointer;
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-decoration-style: wavy;
        }

        /* Blue underline for grammar suggestions */
        .editor-content .suggestion-underline.decoration-blue-500 {
          text-decoration-color: #3b82f6;
        }

        /* Red underline for spelling suggestions */
        .editor-content .suggestion-underline.decoration-red-500 {
          text-decoration-color: #ef4444;
        }

        .editor-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .editor-content ul {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .editor-content ol li {
          margin: 0.5rem 0;
          list-style-type: decimal;
        }

        .editor-content ul li {
          margin: 0.5rem 0;
          list-style-type: disc;
        }

        .editor-content li {
          padding-left: 0.5rem;
        }

        .editor-content:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning={true}
        className="editor-content min-h-[400px] text-lg leading-relaxed outline-none focus:outline-none"
        style={{
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          lineHeight: "1.6"
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        data-placeholder="Start writing..."
      />
    </>
  )
})

EditableContent.displayName = "EditableContent"