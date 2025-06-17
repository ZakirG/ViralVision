"use client"

import type React from "react"
import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo
} from "react"
import { checkGrammarWithLanguageToolAction } from "@/actions/languagetool-actions"
import { checkSpellingWithLanguageToolAction, checkGrammarOnlyWithLanguageToolAction } from "@/actions/languagetool-actions"
import { checkGrammarWithOpenRouterAction } from "@/actions/openrouter-grammar-actions"
import { getSuggestionsByDocumentIdAction } from "@/actions/db/suggestions-actions"
import type { Suggestion } from "@/db/schema"
import { createEditor, Descendant, Editor, Text, Range, Node, BaseEditor, Element, Transforms } from "slate"
import { Slate, Editable, withReact, ReactEditor } from "slate-react"
import { withHistory, HistoryEditor } from "slate-history"

// Define custom types for Slate
type CustomElement = {
  type: 'paragraph'
  children: CustomText[]
}

type CustomText = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

type CustomRange = {
  anchor: { path: number[]; offset: number }
  focus: { path: number[]; offset: number }
  suggestion?: boolean
  suggestionId?: string
  title?: string
}

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor
    Element: CustomElement
    Text: CustomText
    Range: CustomRange
  }
}

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
  suggestions?: Suggestion[] // Add suggestions as props
  isAcceptingSuggestion?: boolean // Add lock state to prevent concurrent operations
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
  acceptSuggestion: (suggestion: Suggestion) => void
}

// Custom leaf component for rendering suggestions
const Leaf = ({ attributes, children, leaf }: any) => {
  if (leaf.suggestion) {
    return (
      <span
        {...attributes}
        className="suggestion-highlight cursor-pointer"
        data-suggestion-id={leaf.suggestionId}
        title={leaf.title || 'Click for suggestion'}
        style={{
          backgroundColor: '#fce7f3',
          borderRadius: '2px',
          padding: '1px 2px',
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#fbb6ce'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fce7f3'
        }}
      >
        {children}
      </span>
    )
  }

  let styledChildren = children

  if (leaf.bold) {
    styledChildren = <strong>{styledChildren}</strong>
  }

  if (leaf.italic) {
    styledChildren = <em>{styledChildren}</em>
  }

  if (leaf.underline) {
    styledChildren = <u>{styledChildren}</u>
  }

  return <span {...attributes}>{styledChildren}</span>
}

// Convert HTML/rich text to Slate nodes
const htmlToSlate = (html: string): Descendant[] => {
  // For now, convert to plain text and create simple paragraph nodes
  // This can be enhanced later to handle more complex HTML
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  
  if (!text.trim()) {
    return [{ type: 'paragraph', children: [{ text: '' }] }]
  }

  const lines = text.split('\n')
  return lines.map(line => ({
    type: 'paragraph',
    children: [{ text: line }]
  }))
}

// Convert Slate nodes to plain text (must match offset calculation logic)
const slateToText = (nodes: Descendant[]): string => {
  const parts: string[] = []
  
  nodes.forEach((node, index) => {
    const text = Node.string(node)
    parts.push(text)
    
    // Add newline between paragraphs (except after the last one)
    if (index < nodes.length - 1) {
      parts.push('\n')
    }
  })
  
  return parts.join('')
}

// Convert Slate nodes to HTML (preserving formatting)
const slateToHtml = (nodes: Descendant[]): string => {
  return nodes
    .map(node => {
      const text = Node.string(node)
      if (!text.trim()) return '<br>'
      return text
    })
    .join('\n')
    .replace(/\n/g, '<br>')
}

export const EditableContent = forwardRef<
  EditableContentRef,
  EditableContentProps
>(({ initialContent, onContentChange, onFormatStateChange, documentId, onSuggestionClick, onSuggestionsUpdated, suggestions: propSuggestions = [], isAcceptingSuggestion = false }, ref) => {
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isGrammarCheckInProgress, setIsGrammarCheckInProgress] = useState(false)

  // Use suggestions from props instead of internal state
  const suggestions = propSuggestions

  // Debug prop suggestions
  useEffect(() => {
    console.log(`🎨 PROPS: Received ${suggestions.length} suggestions from parent:`, 
      suggestions.map(s => ({ id: s.id, text: s.suggestedText, dismissed: s.dismissed }))
    )
  }, [suggestions])

  // Create Slate editor with plugins
  const editor = useMemo(
    () => withHistory(withReact(createEditor())),
    []
  )

  // Initialize Slate value from initial content
  const [value, setValue] = useState<Descendant[]>(() => {
    return htmlToSlate(initialContent)
  })

  // Force Slate to re-render decorations when suggestions change
  useEffect(() => {
    // Only force re-render if we have content and suggestions
    if (value.length > 0 && (suggestions.length > 0 || loadingSuggestions)) {
      console.log(`🎨 SLATE: Forcing editor re-render due to suggestions change (${suggestions.length} suggestions)`)
      
      // Use a more targeted approach - just trigger onChange to refresh decorations
      try {
        const currentSelection = editor.selection
        editor.onChange()
        
        // Restore selection if it existed and is still valid
        if (currentSelection && Range.isRange(currentSelection)) {
          try {
            Transforms.select(editor, currentSelection)
          } catch (e) {
            // Selection might be invalid after content changes, ignore
            console.log('🎨 SLATE: Could not restore selection, continuing...')
          }
        }
      } catch (error) {
        console.error('🎨 SLATE: Error forcing editor re-render:', error)
      }
    }
  }, [suggestions, editor, value, loadingSuggestions])

  // Update editor when initialContent changes (e.g., when suggestion is accepted)
  useEffect(() => {
    if (initialContent) {
      const newValue = htmlToSlate(initialContent)
      setValue(newValue)
    }
  }, [initialContent])

  // Separate debounced functions for spell and grammar checking
  const debouncedSpellCheck = useCallback(
    debounce(async (text: string, docId: string, wordStart?: number, wordEnd?: number) => {
      try {
        console.log("🔤 SLATE: Running spell check...")
        
        const result = await checkSpellingWithLanguageToolAction(text, docId, wordStart, wordEnd)
        
        if (result.isSuccess && result.data && Array.isArray(result.data)) {
          console.log("🔤 SLATE: Spell check returned", result.data.length, "spelling suggestions")
          
          // Re-sync with database to get updated suggestions
          if (onSuggestionsUpdated) {
            onSuggestionsUpdated()
          }
        }
      } catch (error) {
        console.error("❌ SLATE: Spell check error:", error)
      }
    }, 100), // Very short delay for spell checking - almost immediate
    [onSuggestionsUpdated]
  )

  const debouncedSpellingCheckOnEdit = useCallback(
    debounce(async (text: string, docId: string) => {
      try {
        setIsCheckingGrammar(true) // Keep this state name for now
        console.log("🔤 SLATE: Running spell check on content change...")
        
        // Use the corrected spelling function
        const result = await checkSpellingWithLanguageToolAction(text, docId)
        
        if (result.isSuccess && result.data && Array.isArray(result.data)) {
          console.log("🔤 SLATE: Spell check returned", result.data.length, "spelling suggestions")
          
          // Re-sync with database to ensure dismissed suggestions are properly filtered
          if (onSuggestionsUpdated) {
            onSuggestionsUpdated()
          }
        }
      } catch (error) {
        console.error("❌ SLATE: Spell check error:", error)
      } finally {
        setIsCheckingGrammar(false)
      }
    }, 500), // Faster for spelling checks
    [onSuggestionsUpdated]
  )

  // New OpenRouter-based grammar checking with faster delay
  const debouncedGrammarCheckWithAI = useCallback(
    debounce(async (text: string, docId: string) => {
      // Skip if already checking grammar to prevent overlapping requests
      if (isGrammarCheckInProgress) {
        console.log("🤖 SLATE: Grammar check already in progress, skipping...")
        return
      }

      try {
        setIsGrammarCheckInProgress(true)
        setIsCheckingGrammar(true)
        console.log("🤖🤖🤖 SLATE: CALLING OPENROUTER AI GRAMMAR CHECK (debounced) 🤖🤖🤖")
        console.log("🤖 SLATE: Text being sent to OpenRouter:", text)
        console.log("🤖 SLATE: Document ID:", docId)
        
        // Use OpenRouter for grammar analysis
        const result = await checkGrammarWithOpenRouterAction(text, docId)
        
        if (result.isSuccess && result.data && Array.isArray(result.data)) {
          console.log("🤖 SLATE: AI grammar check returned", result.data.length, "grammar suggestions")
          
          // Re-sync with database to get all suggestions (spelling + grammar)
          if (onSuggestionsUpdated) {
            onSuggestionsUpdated()
          }
        }
      } catch (error) {
        console.error("❌ SLATE: AI grammar check error:", error)
      } finally {
        setIsCheckingGrammar(false)
        setIsGrammarCheckInProgress(false)
      }
    }, 1000), // Faster delay for AI grammar checks (1 second)
    [onSuggestionsUpdated, isGrammarCheckInProgress]
  )

  // Immediate grammar check for punctuation triggers (period, newline)
  const immediateGrammarCheck = useCallback(async (text: string, docId: string, trigger: string) => {
    // Skip if already checking grammar to prevent overlapping requests
    if (isGrammarCheckInProgress) {
      console.log(`🤖 SLATE: Grammar check already in progress, skipping ${trigger} trigger...`)
      return
    }

    try {
      setIsGrammarCheckInProgress(true)
      setIsCheckingGrammar(true)
      console.log(`🤖🤖🤖 SLATE: IMMEDIATE GRAMMAR CHECK (${trigger} trigger) 🤖🤖🤖`)
      console.log("🤖 SLATE: Text being sent to OpenRouter:", text)
      console.log("🤖 SLATE: Document ID:", docId)
      
      // Use OpenRouter for grammar analysis
      const result = await checkGrammarWithOpenRouterAction(text, docId)
      
      if (result.isSuccess && result.data && Array.isArray(result.data)) {
        console.log("🤖 SLATE: AI grammar check returned", result.data.length, "grammar suggestions")
        
        // Re-sync with database to get all suggestions (spelling + grammar)
        if (onSuggestionsUpdated) {
          onSuggestionsUpdated()
        }
      }
    } catch (error) {
      console.error("❌ SLATE: AI grammar check error:", error)
    } finally {
      setIsCheckingGrammar(false)
      setIsGrammarCheckInProgress(false)
    }
  }, [onSuggestionsUpdated, isGrammarCheckInProgress])

  // Handle content changes
  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue)
    
    // Convert to text for checking
    const plainText = slateToText(newValue)
    
    // Convert to HTML for saving (preserve formatting)
    const htmlContent = slateToHtml(newValue)
    
    onContentChange(htmlContent)
    
    // Skip all checks if accepting a suggestion to avoid race conditions
    if (isAcceptingSuggestion) {
      console.log("🔄 SLATE: Skipping all checks - currently accepting a suggestion")
      return
    }
    
    // Trigger both spelling and grammar checks on content changes
    if (documentId && plainText.trim()) {
      // Immediate spell check (500ms delay)
      debouncedSpellingCheckOnEdit(plainText, documentId)
      
      // AI grammar check with faster delay (1000ms) - also triggered by period/newline
      debouncedGrammarCheckWithAI(plainText, documentId)
    }
  }, [onContentChange, documentId, debouncedSpellingCheckOnEdit, debouncedGrammarCheckWithAI, isAcceptingSuggestion])

  // Create decorations for suggestions
  const decorate = useCallback(([node, path]: [Node, number[]]) => {
    const ranges: Range[] = []
    
    if (!Text.isText(node) || !suggestions.length) {
      return ranges
    }

    const nodeText = node.text
    const fullText = slateToText(value)
    
    // Find the start offset of this text node in the full document
    let textOffset = 0
    for (const [n, p] of Node.nodes(editor)) {
      if (path.length > 0 && p[0] < path[0]) {
        if (Text.isText(n)) {
          textOffset += n.text.length
        }
        // Add 1 for paragraph breaks (newlines)
        if (p.length === 1) {
          textOffset += 1
        }
      } else if (path.length > 1 && p[0] === path[0] && p[1] < path[1]) {
        if (Text.isText(n)) {
          textOffset += n.text.length
        }
      } else if (p.length === path.length && p.every((val, i) => val === path[i])) {
        break
      }
    }

         suggestions.forEach((suggestion) => {
       if (suggestion.startOffset == null || suggestion.endOffset == null) {
         return
       }

       const suggestionStart = suggestion.startOffset
       const suggestionEnd = suggestion.endOffset
       
       // SAFETY CHECK: Verify the suggestion offsets are still valid for current text
       if (suggestionStart >= fullText.length || suggestionEnd > fullText.length || suggestionStart >= suggestionEnd) {
         console.log(`🎨 SLATE: Skipping suggestion ${suggestion.id} - invalid offsets for current text`, {
           suggestionStart,
           suggestionEnd,
           textLength: fullText.length,
           originalText: suggestion.originalText,
           currentTextAtOffset: fullText.substring(suggestionStart, suggestionEnd)
         })
         return
       }

       // Additional check: verify the text at the offset still matches what we expect
       const currentTextAtOffset = fullText.substring(suggestionStart, suggestionEnd)
       if (suggestion.originalText && currentTextAtOffset !== suggestion.originalText) {
         console.log(`🎨 SLATE: Skipping suggestion ${suggestion.id} - text mismatch`, {
           expected: suggestion.originalText,
           actual: currentTextAtOffset,
           offsets: `${suggestionStart}-${suggestionEnd}`
         })
         return
       }
       
       // Check if this suggestion overlaps with this text node
       const nodeStart = textOffset
       const nodeEnd = textOffset + nodeText.length
       
       if (suggestionStart < nodeEnd && suggestionEnd > nodeStart) {
         // Calculate the range within this text node
         const rangeStart = Math.max(0, suggestionStart - nodeStart)
         const rangeEnd = Math.min(nodeText.length, suggestionEnd - nodeStart)
         
         if (rangeStart < rangeEnd && rangeStart >= 0 && rangeEnd <= nodeText.length) {
           
           
           ranges.push({
             anchor: { path, offset: rangeStart },
             focus: { path, offset: rangeEnd },
             suggestion: true,
             suggestionId: suggestion.id,
             title: suggestion.explanation || 'Click for suggestion'
           })
         }
       }
     })

    return ranges
  }, [suggestions, value, editor])

  // Handle click events on suggestions
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const suggestionId = target.dataset.suggestionId
    
    if (suggestionId && onSuggestionClick) {
      const suggestion = suggestions.find(s => s.id === suggestionId)
      if (suggestion) {
        event.preventDefault()
        event.stopPropagation()
        onSuggestionClick(suggestion)
      }
    }
  }, [suggestions, onSuggestionClick])

  // Handle keyboard events for formatting shortcuts and spell/grammar checking triggers
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Skip if accepting a suggestion
    if (isAcceptingSuggestion) {
      return
    }

    // Handle spacebar for spell checking
    if (event.key === ' ' && documentId) {
      // Trigger spell check after a very short delay to let the space be processed
      setTimeout(() => {
        const currentText = slateToText(value)
        if (currentText.trim() && documentId) {
          console.log("🔤 SLATE: Spacebar pressed, triggering immediate spell check")
          // Use the immediate spell check function (not the content change one)
          debouncedSpellCheck(currentText, documentId)
        }
      }, 50)
    }

    // Handle period for grammar checking
    if (event.key === '.' && documentId) {
      // Trigger grammar check after a short delay to let the period be processed
      setTimeout(() => {
        const currentText = slateToText(value)
        if (currentText.trim() && documentId) {
          console.log("🤖 SLATE: Period pressed, triggering immediate grammar check")
          immediateGrammarCheck(currentText, documentId, 'period')
        }
      }, 100)
    }

    // Handle Enter/newline for grammar checking
    if (event.key === 'Enter' && documentId) {
      // Trigger grammar check after a short delay to let the newline be processed
      setTimeout(() => {
        const currentText = slateToText(value)
        if (currentText.trim() && documentId) {
          console.log("🤖 SLATE: Enter pressed, triggering immediate grammar check")
          immediateGrammarCheck(currentText, documentId, 'newline')
        }
      }, 100)
    }
    
    // Handle formatting shortcuts
    if (!event.ctrlKey && !event.metaKey) {
      return
    }
      
    switch (event.key) {
      case 'b':
        event.preventDefault()
        // Toggle bold (implement later)
        break
      case 'i':
        event.preventDefault()
        // Toggle italic (implement later)
        break
      case 'u':
        event.preventDefault()
        // Toggle underline (implement later)
        break
    }
  }, [documentId, isAcceptingSuggestion, value, debouncedSpellCheck, immediateGrammarCheck])

  // Accept suggestion by replacing text in the editor
  const acceptSuggestion = useCallback((suggestion: Suggestion) => {
    console.log("🎯 SLATE: acceptSuggestion called with:", {
      id: suggestion.id,
      startOffset: suggestion.startOffset,
      endOffset: suggestion.endOffset,
      suggestedText: suggestion.suggestedText,
      originalText: suggestion.originalText
    })
    
    if (suggestion.startOffset == null || suggestion.endOffset == null || !suggestion.suggestedText) {
      console.error("🎯 SLATE: Invalid suggestion data for acceptance:", suggestion)
        return
      }
      
    console.log("🎯 SLATE: Accepting suggestion:", {
      id: suggestion.id,
      startOffset: suggestion.startOffset,
      endOffset: suggestion.endOffset,
      originalText: suggestion.originalText,
      suggestedText: suggestion.suggestedText
    })

    // Convert the current editor value to text to verify positioning
    const fullText = slateToText(value)
    console.log("🎯 SLATE: Full text:", `"${fullText}"`)
    console.log("🎯 SLATE: Text to replace:", `"${fullText.substring(suggestion.startOffset, suggestion.endOffset)}"`)
    console.log("🎯 SLATE: Will replace with:", `"${suggestion.suggestedText}"`)

    // Build a mapping of text offsets to Slate positions
    const offsetToPosition: Array<{ path: number[], offset: number }> = []
    let textOffset = 0

    // Walk through all text nodes to build offset mapping
    for (const [node, path] of Node.nodes(editor)) {
      if (Text.isText(node)) {
        // Map each character position in this text node
        for (let i = 0; i <= node.text.length; i++) {
          offsetToPosition[textOffset + i] = { path, offset: i }
        }
        textOffset += node.text.length
      } else if (path.length === 1 && textOffset > 0) {
        // Only add newline offset if this is not the first paragraph
        // and we have some text before this paragraph
        const paragraphIndex = path[0]
        if (paragraphIndex > 0) {
          // Map the newline position to the start of this paragraph
          offsetToPosition[textOffset] = { path: [...path, 0], offset: 0 }
          textOffset += 1
        }
      }
    }

    console.log("🎯 SLATE: Built offset mapping, total text length:", textOffset)

    // Get start and end positions
    const startPos = offsetToPosition[suggestion.startOffset]
    const endPos = offsetToPosition[suggestion.endOffset]

    if (!startPos || !endPos) {
      console.error("🎯 SLATE: Could not find positions for offsets:", {
        startOffset: suggestion.startOffset,
        endOffset: suggestion.endOffset,
        mappingLength: offsetToPosition.length,
        textLength: fullText.length,
        availableOffsets: Object.keys(offsetToPosition).slice(0, 10) // Show first 10 for debugging
      })
      return
    }

    console.log("🎯 SLATE: Found positions:", {
      startPos,
      endPos,
      actualTextToReplace: fullText.substring(suggestion.startOffset, suggestion.endOffset)
    })

    // Perform the replacement
    try {
      // Create the selection range
      const range = {
        anchor: startPos,
        focus: endPos
      }

      console.log("🎯 SLATE: Applying replacement with range:", range)

      // Select the range and replace with suggested text
      Transforms.select(editor, range)
      Transforms.insertText(editor, suggestion.suggestedText)

      console.log("🎯 SLATE: Successfully replaced text - new content:", slateToText(editor.children))

    } catch (error) {
      console.error("🎯 SLATE: Error during text replacement:", error)
    }
  }, [editor, value])

  // Expose methods via ref
  useImperativeHandle(ref, () => {
    console.log("🎯 SLATE: Creating ref interface with acceptSuggestion method")
    const refInterface = {
      formatText: (command: string) => {
        ReactEditor.focus(editor)
        // Implement formatting commands
        console.log("Format command:", command)
      },
      toggleBulletList: () => {
        ReactEditor.focus(editor)
        // Implement bullet list toggle
        console.log("Toggle bullet list")
      },
      toggleNumberedList: () => {
        ReactEditor.focus(editor)
        // Implement numbered list toggle
        console.log("Toggle numbered list")
      },
      focus: () => {
        ReactEditor.focus(editor)
      },
      acceptSuggestion: (suggestion: Suggestion) => {
        console.log("🎯 SLATE: acceptSuggestion called via ref with:", suggestion.id)
        return acceptSuggestion(suggestion)
      }
    }
    console.log("🎯 SLATE: Returning ref interface:", Object.keys(refInterface))
    return refInterface
  }, [editor, acceptSuggestion])

  // Update format state (simplified for now)
  useEffect(() => {
    if (onFormatStateChange) {
      onFormatStateChange({
        isBold: false,
        isItalic: false,
        isUnderlined: false,
        isBulletList: false,
        isNumberedList: false
      })
    }
  }, [onFormatStateChange])

  return (
    <div className="slate-editor relative" onClick={handleClick}>
      {/* Grammar check status indicator */}
      {/* {isGrammarCheckInProgress && (
        <div className="absolute top-2 right-2 flex items-center space-x-2 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
          <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
          <span>Checking grammar...</span>
        </div>
      )} */}
      
      <Slate
        editor={editor}
        initialValue={value}
        onChange={handleChange}
      >
        <Editable
          decorate={decorate}
          renderLeaf={Leaf}
          onKeyDown={handleKeyDown}
          placeholder="Start writing..."
          spellCheck={false} // Disable browser spell check
          autoCorrect="off"
          autoCapitalize="off"
          style={{
            minHeight: '400px',
            fontSize: '18px',
            lineHeight: '1.6',
            outline: 'none',
            caretColor: '#374151'
          }}
          className="focus:outline-none"
        />
      </Slate>
      
      <style jsx>{`
        .slate-editor .suggestion-highlight:hover {
          background-color: #fbb6ce !important;
        }
      `}</style>
    </div>
  )
})

EditableContent.displayName = "EditableContent"