"use client"

import React, { 
  forwardRef, 
  useImperativeHandle, 
  useMemo, 
  useState, 
  useRef, 
  useCallback,
  useEffect 
} from "react"
import { createEditor, Descendant, Editor, Text, Range, Node, Transforms, Operation, BaseEditor } from "slate"
import { Slate, Editable, withReact, ReactEditor } from "slate-react"
import { withHistory, HistoryEditor } from "slate-history"
import { useSuggestStore } from "@/stores/useSuggestStore"
import { useIdleGrammarCheck } from "@/hooks/useIdleGrammarCheck"
import * as Popover from "@radix-ui/react-popover"
import { Button } from "@/components/ui/button"

// Custom types for Slate
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

const initialValue: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "Test with misspeled words and bad grammer for testing suggestions." }]
  } as const
]

// Convert Slate nodes to plain text for position calculation
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

export interface EditableHandle {
  acceptSuggestion: (id: string, replacement?: string) => void
  dismissSuggestion: (id: string) => void
}

interface EditableProps {
  // Add any additional props as needed
}

// Custom leaf component with suggestion highlighting and popover
const SuggestionLeaf = ({ attributes, children, leaf }: any) => {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 })
  const { getSuggestionById, dismiss } = useSuggestStore()
  
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (leaf.suggestionId) {
      event.preventDefault()
      event.stopPropagation()
      
      // Get the position of the clicked element
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      setPopoverPosition({ x: rect.left, y: rect.bottom + 8 })
      setPopoverOpen(true)
    }
  }, [leaf.suggestionId])

  const handleAccept = useCallback((replacement: string) => {
    if (leaf.suggestionId) {
      // This will be handled by the parent component
      const customEvent = new CustomEvent('acceptSuggestion', {
        detail: { id: leaf.suggestionId, replacement }
      })
      document.dispatchEvent(customEvent)
      setPopoverOpen(false)
    }
  }, [leaf.suggestionId])

  const handleDismiss = useCallback(() => {
    if (leaf.suggestionId) {
      dismiss(leaf.suggestionId)
      setPopoverOpen(false)
    }
  }, [leaf.suggestionId, dismiss])

  // Apply text formatting
  let styledChildren = children
  if (leaf.bold) styledChildren = <strong>{styledChildren}</strong>
  if (leaf.italic) styledChildren = <em>{styledChildren}</em>
  if (leaf.underline) styledChildren = <u>{styledChildren}</u>

  // If this is a suggestion, wrap with interactive styling and popover
  if (leaf.suggestion && leaf.suggestionId) {
    const suggestion = getSuggestionById(leaf.suggestionId)
    
    return (
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>
          <span
            {...attributes}
            className="cursor-pointer bg-red-100 hover:bg-red-200 transition-colors rounded-sm px-1 py-0.5"
            onClick={handleClick}
            title={suggestion?.explanation || 'Click for suggestion'}
          >
            {styledChildren}
          </span>
        </Popover.Trigger>
        
        <Popover.Portal>
          <Popover.Content
            className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-50"
            style={{
              position: 'fixed',
              left: popoverPosition.x,
              top: popoverPosition.y,
            }}
            sideOffset={5}
          >
            {suggestion && (
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <h4 className="font-semibold text-sm text-gray-900">
                    {suggestion.suggestionType === 'spelling' ? 'Spelling' : 'Grammar'} Suggestion
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">{suggestion.explanation}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Original: </span>
                    <span className="bg-red-100 px-1 rounded">{suggestion.originalText}</span>
                  </div>
                  
                  {suggestion.suggestedText && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Suggestions:</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start text-sm"
                        onClick={() => handleAccept(suggestion.suggestedText!)}
                      >
                        <span className="bg-green-100 px-2 py-1 rounded mr-2">
                          {suggestion.suggestedText}
                        </span>
                        Replace
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDismiss}
                    className="flex-1"
                  >
                    Ignore
                  </Button>
                </div>
              </div>
            )}
            
            <Popover.Arrow className="fill-white" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return <span {...attributes}>{styledChildren}</span>
}

const EditableComponent = forwardRef<EditableHandle, EditableProps>((props, ref) => {
  const editor = useMemo(() => withHistory(withReact(createEditor())), [])
  const [value, setValue] = useState<Descendant[]>(initialValue)
  const [isFocused, setIsFocused] = useState(false)
  const isAcceptingSuggestionRef = useRef(false)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentTypingLineRef = useRef<number | null>(null)
  const [decorationTrigger, setDecorationTrigger] = useState(0)
  
  const { getAllSuggestions, dismiss, addSuggestions, getDismissedIds } = useSuggestStore()
  const suggestions = getAllSuggestions()
  
  // Get current text for idle grammar checking
  const currentText = useMemo(() => slateToText(value), [value])
  
  // Handle spell and grammar suggestions from idle checker
  const handleGrammarSuggestions = useCallback((allSuggestions: any[]) => {
    console.log(`📝 EDITABLE: Received ${allSuggestions.length} suggestions from idle checker`)
    console.log(`📝 EDITABLE: Suggestion types:`, allSuggestions.map(s => `${s.suggestionType}: "${s.originalText}"`))
    
    // Convert API suggestions to store format and add them
    const storeSuggestions = allSuggestions.map(s => ({
      id: s.id,
      documentId: 'editor', // Temporary document ID for editor
      versionNumber: 1,
      originalText: s.originalText,
      suggestedText: s.suggestedText,
      explanation: s.explanation,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      confidence: s.confidence.toString(),
      suggestionType: s.suggestionType as 'grammar' | 'spelling',
      accepted: false,
      dismissed: false,
      createdAt: new Date()
    }))
    
    console.log(`📝 EDITABLE: Adding ${storeSuggestions.length} suggestions to store`)
    addSuggestions(storeSuggestions)
    console.log(`📝 EDITABLE: Store update completed`)
  }, [addSuggestions])
  
  // Set up idle spell and grammar checking
  const { triggerSpellCheck, triggerGrammarCheck, triggerCheck, cancelCheck, isChecking } = useIdleGrammarCheck({
    text: currentText,
    isFocused,
    onSuggestions: handleGrammarSuggestions,
    dismissedIds: getDismissedIds(),
    idleTimeout: 1000 // 1 second idle timeout
  })

  // Add initial mock suggestions for the demo text
  useEffect(() => {
    const initialText = slateToText(initialValue)
    if (initialText.trim() && initialText.includes('misspeled') && suggestions.length === 0) {
      console.log("🚀 Adding initial mock suggestions for demo text")
      
      // Create mock suggestions for the errors in the initial text
      const mockSuggestions = [
        {
          id: 'mock-spell-1',
          documentId: 'editor',
          versionNumber: 1,
          originalText: 'misspeled',
          suggestedText: 'misspelled', 
          explanation: 'Spelling correction',
          startOffset: initialText.indexOf('misspeled'),
          endOffset: initialText.indexOf('misspeled') + 'misspeled'.length,
          confidence: '0.9',
          suggestionType: 'spelling' as const,
          accepted: false,
          dismissed: false,
          createdAt: new Date()
        },
        {
          id: 'mock-spell-2', 
          documentId: 'editor',
          versionNumber: 1,
          originalText: 'grammer',
          suggestedText: 'grammar',
          explanation: 'Spelling correction',
          startOffset: initialText.indexOf('grammer'),
          endOffset: initialText.indexOf('grammer') + 'grammer'.length,
          confidence: '0.9',
          suggestionType: 'spelling' as const,
          accepted: false,
          dismissed: false,
          createdAt: new Date()
        }
      ]
      
      addSuggestions(mockSuggestions)
    }
  }, [addSuggestions, suggestions.length])

  // Trigger initial grammar check for the mock text when component mounts
  useEffect(() => {
    const initialText = slateToText(initialValue)
    if (initialText.trim() && initialText.includes('misspeled')) {
      console.log("🚀 Triggering initial grammar check for mock text")
      // Small delay to let the component fully initialize
      setTimeout(() => {
        triggerCheck()
      }, 500)
    }
  }, [triggerCheck])

  useImperativeHandle(ref, () => ({
    acceptSuggestion: (id: string, replacement?: string) => {
      handleAcceptSuggestion(id, replacement)
    },
    dismissSuggestion: (id: string) => {
      dismiss(id)
    }
  }))

  // Dynamic position finder - searches for target text in current document
  const findTextPosition = useCallback((targetText: string, currentText: string): { start: number; end: number } | null => {
    // Find the target text in the current document
    const index = currentText.indexOf(targetText)
    if (index === -1) {
      console.log("🔍 Text not found:", targetText, "in:", currentText)
      return null
    }
    
    // Check if there are multiple occurrences - use the first one
    const secondIndex = currentText.indexOf(targetText, index + 1)
    if (secondIndex !== -1) {
      console.log("⚠️ Multiple occurrences found, using first one at position", index)
    }
    
    return {
      start: index,
      end: index + targetText.length
    }
  }, [])

  // Handle accepting suggestions with collision protection and dynamic positioning
  const handleAcceptSuggestion = useCallback((id: string, replacement?: string) => {
    if (isAcceptingSuggestionRef.current) {
      console.log("🔒 Suggestion acceptance in progress, ignoring concurrent request")
      return
    }

    const suggestion = suggestions.find(s => s.id === id)
    console.log("🔍 Debug suggestion lookup:", { 
      id, 
      replacement, 
      suggestion: suggestion ? {
        id: suggestion.id,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        startOffset: suggestion.startOffset,
        endOffset: suggestion.endOffset
      } : null,
      allSuggestionsCount: suggestions.length,
      allSuggestionIds: suggestions.map(s => s.id)
    })

    if (!suggestion) {
      console.error("❌ Suggestion not found with ID:", id)
      return
    }

    if (!replacement) {
      console.error("❌ No replacement text provided")
      return
    }

    if (!suggestion.originalText) {
      console.error("❌ Suggestion missing originalText:", suggestion)
      return
    }

    console.log("🎯 Accepting suggestion:", { id, replacement, originalText: suggestion.originalText })

    try {
      isAcceptingSuggestionRef.current = true

      // Get current editor content
      const fullText = slateToText(editor.children)
      console.log("🎯 Current full text:", `"${fullText}"`)
      
      // Dynamically find the current position of the target text
      const position = findTextPosition(suggestion.originalText, fullText)
      if (!position) {
        console.error("❌ Could not find target text in current document:", suggestion.originalText)
        return
      }

      console.log("🎯 Found target text at positions:", position.start, "-", position.end)
      console.log("🎯 Target text found:", `"${fullText.substring(position.start, position.end)}"`)
      console.log("🎯 Context around target:", `"${fullText.substring(Math.max(0, position.start - 10), position.end + 10)}"`)
      
      // Build offset-to-position mapping using current text length
      const offsetToPosition: Array<{ path: number[], offset: number }> = []
      let textOffset = 0

      for (const [node, path] of Node.nodes(editor)) {
        if (Text.isText(node)) {
          for (let i = 0; i <= node.text.length; i++) {
            offsetToPosition[textOffset + i] = { path, offset: i }
          }
          textOffset += node.text.length
        } else if (path.length === 1 && textOffset > 0) {
          const paragraphIndex = path[0]
          if (paragraphIndex > 0) {
            offsetToPosition[textOffset] = { path: [...path, 0], offset: 0 }
            textOffset += 1
          }
        }
      }

      const startPos = offsetToPosition[position.start]
      const endPos = offsetToPosition[position.end]

      if (!startPos || !endPos) {
        console.error("❌ Could not map positions to Slate coordinates:", {
          startOffset: position.start,
          endOffset: position.end,
          textLength: fullText.length,
          offsetMappingLength: offsetToPosition.length
        })
        return
      }

      // Perform the replacement using Slate transforms
      const range = { anchor: startPos, focus: endPos }
      console.log("🎯 Slate range to replace:", range)
      Transforms.select(editor, range)
      Transforms.insertText(editor, replacement)

      // Check the result
      const newFullText = slateToText(editor.children)
      console.log("🎯 Text after replacement:", `"${newFullText}"`)

      // Dismiss the suggestion from the store
      dismiss(id)

      console.log("✅ Successfully accepted suggestion and dismissed from store")

    } catch (error) {
      console.error("❌ Error accepting suggestion:", error)
    } finally {
      isAcceptingSuggestionRef.current = false
    }
  }, [suggestions, editor, dismiss, findTextPosition])

  // Listen for custom accept suggestion events
  useEffect(() => {
    const handleAcceptEvent = (event: any) => {
      const { id, replacement } = event.detail
      handleAcceptSuggestion(id, replacement)
    }

    document.addEventListener('acceptSuggestion', handleAcceptEvent)
    return () => document.removeEventListener('acceptSuggestion', handleAcceptEvent)
  }, [handleAcceptSuggestion])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      isTypingRef.current = false
      currentTypingLineRef.current = null
    }
  }, [])

  // Decorate function to add suggestion ranges
  const decorate = useCallback(([node, path]: [Node, number[]]) => {
    const ranges: Range[] = []
    
    if (!Text.isText(node) || !suggestions.length) {
      return ranges
    }

    // Don't interfere with active selections during suggestion acceptance
    if (isAcceptingSuggestionRef.current) {
      return ranges
    }

    // Only hide decorations on the current line being typed, preserve others
    if (isTypingRef.current && currentTypingLineRef.current !== null) {
      // Check if this node is on the current line being typed
      const nodeParagraphIndex = path[0]
      if (nodeParagraphIndex === currentTypingLineRef.current) {
        // Hide decorations only on the current line being typed
        return ranges
      }
      // Continue showing decorations on other lines
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
      
      // Validate suggestion offsets
      if (suggestionStart >= fullText.length || suggestionEnd > fullText.length || suggestionStart >= suggestionEnd) {
        return
      }

      // Check if this suggestion overlaps with this text node
      const nodeStart = textOffset
      const nodeEnd = textOffset + nodeText.length
      
      if (suggestionStart < nodeEnd && suggestionEnd > nodeStart) {
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
  }, [suggestions, value, editor, decorationTrigger])

  const handleChange = (newValue: Descendant[]) => {
    // Skip updates during suggestion acceptance to prevent conflicts
    if (isAcceptingSuggestionRef.current) {
      return
    }

    setValue(newValue)

    // Detect typing to prevent decoration interference
    const hasTextOperations = editor.operations.some(op => 
      op.type === 'insert_text' || op.type === 'remove_text'
    )
    
    if (hasTextOperations) {
      isTypingRef.current = true
      
      // Track which line/paragraph is being typed on
      const { selection } = editor
      if (selection && Range.isCollapsed(selection)) {
        const [, currentPath] = Editor.node(editor, selection.anchor.path)
        // Get the paragraph index (first element of path)
        currentTypingLineRef.current = currentPath[0] || 0
        console.log("📝 Currently typing on line:", currentTypingLineRef.current)
      }
      
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set a timeout to stop "typing" state after user pauses
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
        currentTypingLineRef.current = null
        
        // Trigger re-render through React state instead of Slate manipulation
        // This preserves cursor position while updating decorations
        setDecorationTrigger(prev => prev + 1)
        console.log("📍 Decorations re-enabled, cursor position preserved")
      }, 500) // 500ms delay after stopping typing
    }

    // Log operations for debugging
    if (editor.operations.length > 0) {
      console.log("📝 Slate operations:", editor.operations.map(op => op.type))
    }
  }

  return (
    <div className="relative">
      {/* Spell + Grammar check status indicator */}
      {isChecking && (
        <div className="absolute top-2 right-2 z-10 flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded-md text-xs">
          <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
          <span>Checking spelling & grammar...</span>
        </div>
      )}
      
      {/* Enhanced Debug panel */}
      <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 p-2 rounded-md text-xs w-64 shadow-lg">
        <p className="font-semibold mb-1">🐛 Live Debug Panel</p>
        <p>💾 Store suggestions: {suggestions.length}</p>
        <p>⚡ Checking: {isChecking ? 'YES' : 'NO'}</p>
        <p>📍 Focus: {isFocused ? 'YES' : 'NO'}</p>
        <p>⌨️ Typing: {isTypingRef.current ? 'YES' : 'NO'}</p>
        <p>📍 Typing line: {currentTypingLineRef.current !== null ? currentTypingLineRef.current : 'None'}</p>
        {suggestions.length > 0 ? (
          <div className="mt-2 border-t pt-2">
            <p className="font-semibold">Recent suggestions:</p>
            {suggestions.slice(0, 3).map(s => (
              <div key={s.id} className="mb-1 text-xs">
                <span className={`px-1 rounded ${s.suggestionType === 'spelling' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  {s.suggestionType}
                </span>
                : "{s.originalText}" → "{s.suggestedText}"
                <button 
                  onClick={() => handleAcceptSuggestion(s.id, s.suggestedText || '')}
                  className="ml-1 text-blue-600 hover:text-blue-800 underline"
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 border-t pt-2">
            <p className="text-gray-500">No suggestions yet</p>
            <p className="text-xs text-gray-400">Try typing "recieve" + spacebar</p>
          </div>
        )}
      </div>
      
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <Editable
          decorate={decorate}
          renderLeaf={SuggestionLeaf}
          placeholder="Start typing..."
          spellCheck={false}
          className="min-h-[400px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            fontSize: '16px',
            lineHeight: '1.6',
          }}
          onFocus={() => {
            console.log("📝 Editor focused")
            setIsFocused(true)
          }}
          onBlur={() => {
            console.log("📝 Editor blurred")
            setIsFocused(false)
            // cancelCheck() // Cancel any pending grammar check when losing focus
          }}
          onKeyDown={(event) => {
            // Prevent operations during suggestion acceptance
            if (isAcceptingSuggestionRef.current) {
              event.preventDefault()
              return
            }



            // Detect spacebar for immediate spell check
            if (event.key === ' ' && isFocused) {
              // Schedule spell check after a short delay to let the text update
              setTimeout(() => {
                console.log("📝 Spacebar detected - triggering spell check")
                triggerSpellCheck()
              }, 100)
            }

            // Detect punctuation for immediate grammar check
            if (['.', '!', '?'].includes(event.key) && isFocused) {
              // Schedule grammar check after a short delay to let the text update
              setTimeout(() => {
                console.log(`🎯 Punctuation "${event.key}" detected - triggering grammar check`)
                triggerGrammarCheck()
              }, 100)
            }

            // Basic formatting shortcuts
            if (!event.ctrlKey && !event.metaKey) return
              
            switch (event.key) {
              case 'b':
                event.preventDefault()
                const isBold = Editor.marks(editor)?.bold === true
                if (isBold) {
                  Editor.removeMark(editor, 'bold')
                } else {
                  Editor.addMark(editor, 'bold', true)
                }
                break
            }
          }}
        />
      </Slate>
    </div>
  )
})

EditableComponent.displayName = "Editable"

export default EditableComponent 