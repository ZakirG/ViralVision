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
  rejectedSuggestionIds?: Set<string>
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
>(({ initialContent, onContentChange, onFormatStateChange, documentId, onSuggestionClick, rejectedSuggestionIds }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const lastCleanTextRef = useRef<string>("")
  const isUpdatingContentRef = useRef(false)
  const isProcessingEnterRef = useRef(false)
  const isProcessingUserInputRef = useRef(false)
  const pendingSuggestionUpdateRef = useRef(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [textContent, setTextContent] = useState(initialContent)

  // Get clean text content from editor, stripping all HTML
  const getCleanTextContent = useCallback(() => {
    if (!editorRef.current) return ''
    
    const innerHTML = editorRef.current.innerHTML
    
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
    
    return tempDiv.textContent || ''
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
      setLoadingSuggestions(true)
      const result = await getSuggestionsByDocumentIdAction(docId, 1) // Version 1
      if (result.isSuccess && result.data) {
        // Filter out accepted and rejected suggestions
        const filteredSuggestions = result.data.filter(s => 
          !s.accepted && !(rejectedSuggestionIds && rejectedSuggestionIds.has(s.id))
        )
        setSuggestions(filteredSuggestions)
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [rejectedSuggestionIds])

  // Debounced grammar check function
  const debouncedGrammarCheck = useCallback(
    debounce(async (text: string, docId: string) => {
      try {
        setIsCheckingGrammar(true)
        await checkGrammarWithLanguageToolAction(text, docId)
        // Fetch suggestions after grammar check completes
        fetchSuggestions(docId)
      } catch (error) {
        console.error("Grammar check error:", error)
      } finally {
        setIsCheckingGrammar(false)
      }
    }, 2000), // 2 second debounce delay
    [fetchSuggestions]
  )

  const updateContent = useCallback(() => {
    if (isUpdatingContentRef.current) return

    // Get clean text for comparison and grammar checking
    const cleanText = getCleanTextContent()
    
    // Get rich HTML content for saving (preserve formatting)
    const richContent = editorRef.current?.innerHTML || ''

    if (cleanText !== textContent) {
      setTextContent(cleanText)
      // Pass rich HTML content to maintain formatting when saving
      onContentChange(richContent)
      
      // Clear existing debounce timer
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      
      // Use clean text for grammar checking
      if (documentId) {
        debounceTimeoutRef.current = setTimeout(() => {
          checkGrammarWithLanguageToolAction(cleanText, documentId)
        }, 2000)
      }
    }
  }, [textContent, onContentChange, documentId, getCleanTextContent])

  // Update innerHTML with highlighted suggestions while preserving cursor
  const updateContentWithSuggestions = useCallback((textContent: string, caller?: string) => {
    if (!editorRef.current || isUpdatingContentRef.current) {
      return
    }
    
    if (isProcessingEnterRef.current || isProcessingUserInputRef.current) {
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
  }, [saveCursorPosition, restoreCursorPosition])

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

    sortedSuggestions.forEach(suggestion => {
      if (suggestion.startOffset !== null && suggestion.endOffset !== null) {
        const beforeText = highlightedText.substring(0, suggestion.startOffset)
        const suggestionText = highlightedText.substring(suggestion.startOffset, suggestion.endOffset)
        const afterText = highlightedText.substring(suggestion.endOffset)
        
        const suggestionType = suggestion.suggestionType === 'spelling' ? 'red' : 'blue'
        const wrappedText = `<span class="suggestion-underline cursor-pointer underline decoration-${suggestionType}-500 decoration-2 decoration-wavy" data-suggestion-id="${suggestion.id}" title="${suggestion.explanation || 'Click for suggestion'}">${suggestionText}</span>`
        
        highlightedText = beforeText + wrappedText + afterText
      }
    })

    return highlightedText.replace(/\n/g, "<br>")
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

  // Update suggestions when rejected list changes
  useEffect(() => {
    if (documentId && rejectedSuggestionIds) {
      // Filter out newly rejected suggestions from current list
      setSuggestions(prevSuggestions => 
        prevSuggestions.filter(s => !rejectedSuggestionIds.has(s.id))
      )
    }
  }, [rejectedSuggestionIds, documentId])

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