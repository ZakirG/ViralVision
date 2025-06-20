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
import { checkSpellingOptimizedAction } from "@/actions/languagetool-actions-optimized"
import { checkGrammarWithOpenAIAction } from "@/actions/openai-grammar-actions"
import { getSuggestionsByDocumentIdAction } from "@/actions/db/suggestions-actions"
import type { Suggestion } from "@/db/schema"
import { createEditor, Descendant, Editor, Text, Range, Node, BaseEditor, Element, Transforms, Operation, Path } from "slate"
import { Slate, Editable, withReact, ReactEditor } from "slate-react"
import { withHistory, HistoryEditor } from "slate-history"
import { updateSuggestionsAfterOperations } from "@/utils/pathAnchors"
import { critiqueViralAbilityAction, type ViralCritique } from "@/actions/openai-critique-actions"
import { makeDecorations, createUnifiedDiff } from "./diff-highlighter"
import { cn } from "@/lib/utils"
import RevisionBar from "./revision-bar"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

// Extend Suggestion type to include isStale property
interface ExtendedSuggestion extends Suggestion {
  isStale?: boolean;
}

// Define custom types for Slate
interface CustomElement {
  type: "paragraph"
  children: CustomText[]
}

interface CustomText {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  suggestion?: boolean
  suggestionId?: string
  suggestionType?: "spelling" | "grammar" | string | null
  title?: string
  added?: boolean
  removed?: boolean
  // Support for multiple suggestion types on the same text
  spellingSuggestion?: boolean
  grammarSuggestion?: boolean
  spellingSuggestionId?: string
  grammarSuggestionId?: string
  spellingTitle?: string
  grammarTitle?: string
}

// Custom types for Slate editor
// Note: CustomTypes interface removed to avoid TypeScript conflicts

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
  onDirectSuggestionsUpdate?: (suggestions: Suggestion[]) => void // New: direct update to avoid DB round-trip
  suggestions?: Suggestion[] // Add suggestions as props
  isAcceptingSuggestion?: boolean // Add lock state to prevent concurrent operations
  onViralCritiqueUpdate?: (critique: ViralCritique | null, isLoading: boolean) => void // New: viral critique callback
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
  insertContent: (content: string) => void
  replaceContent: (content: string) => void
  triggerViralCritique: () => void
  applyItalicToBrackets: () => void
}

// Custom leaf component for rendering suggestions
const Leaf = ({ attributes, children, leaf }: any) => {
  // Debug: Log when leaf has suggestion properties
  if (leaf.suggestion || leaf.spellingSuggestion || leaf.grammarSuggestion) {
    // console.log(`🎨 LEAF RENDER: Rendering leaf with suggestions:`, {
    //   suggestion: leaf.suggestion,
    //   spellingSuggestion: leaf.spellingSuggestion,
    //   grammarSuggestion: leaf.grammarSuggestion,
    //   spellingSuggestionId: leaf.spellingSuggestionId,
    //   grammarSuggestionId: leaf.grammarSuggestionId,
    //   suggestionId: leaf.suggestionId,
    //   text: children?.props?.children || 'unknown'
    // })
  }
  
  // Build styles for multiple suggestion types
  const styles: React.CSSProperties = {}
  const className = ["suggestion-highlight cursor-pointer"]
  const dataAttributes: { [key: string]: string } = {}
  const title = leaf.title || 'Click for suggestion'
  
  // Handle spelling suggestions with thick red underline
  if (leaf.spellingSuggestion || (leaf.suggestion && leaf.suggestionType === 'spelling')) {
    styles.borderBottom = '3px solid #dc2626' // Thick red underline
    styles.borderBottomStyle = 'solid'
    styles.borderBottomWidth = '3px'
    styles.borderBottomColor = '#dc2626'
    
    if (leaf.spellingSuggestionId || leaf.suggestionId) {
      dataAttributes['data-spelling-suggestion-id'] = leaf.spellingSuggestionId || leaf.suggestionId
    }
    
    if (leaf.spellingTitle || leaf.title) {
      dataAttributes.title = leaf.spellingTitle || leaf.title
    }
    
    // console.log(`🎨 SPELLING STYLE: Applied spelling suggestion style for ID: ${leaf.spellingSuggestionId || leaf.suggestionId}`)
  }
  
  // Handle grammar suggestions with yellow background
  if (leaf.grammarSuggestion || (leaf.suggestion && leaf.suggestionType === 'grammar')) {
    styles.backgroundColor = 'rgba(255, 255, 0, 0.3)' // Yellow background for grammar
    styles.borderRadius = '2px'
    styles.padding = '1px 2px'
    
    if (leaf.grammarSuggestionId || leaf.suggestionId) {
      dataAttributes['data-grammar-suggestion-id'] = leaf.grammarSuggestionId || leaf.suggestionId
    }
    
    if (leaf.grammarTitle || leaf.title) {
      dataAttributes.title = leaf.grammarTitle || leaf.title
    }
  }
  
  // Handle other suggestion types with pink background (fallback)
  if (leaf.suggestion && leaf.suggestionType !== 'spelling' && leaf.suggestionType !== 'grammar') {
    styles.backgroundColor = '#fce7f3' // Pink background for other types
    styles.borderRadius = '2px'
    styles.padding = '1px 2px'
    
    if (leaf.suggestionId) {
      dataAttributes['data-suggestion-id'] = leaf.suggestionId
    }
    
    if (leaf.title) {
      dataAttributes.title = leaf.title
    }
    
  }
  
  // Add transition for smooth hover effects
  if (Object.keys(styles).length > 0) {
    styles.transition = 'all 0.2s ease'
  }
  
  // Render with suggestions if any exist
  if (leaf.spellingSuggestion || leaf.grammarSuggestion || leaf.suggestion) {
    
    
    return (
      <span
        {...attributes}
        className={className.join(' ')}
        {...dataAttributes}
        style={styles}
        onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => {
          // Enhanced hover effects
          if (leaf.spellingSuggestion || (leaf.suggestion && leaf.suggestionType === 'spelling')) {
            e.currentTarget.style.borderBottomColor = '#b91c1c' // Darker red on hover
          }
          if (leaf.grammarSuggestion || (leaf.suggestion && leaf.suggestionType === 'grammar')) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 0, 0.5)' // Darker yellow on hover
          }
          if (leaf.suggestion && leaf.suggestionType !== 'spelling' && leaf.suggestionType !== 'grammar') {
            e.currentTarget.style.backgroundColor = '#fbb6ce' // Darker pink on hover
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => {
          // Restore original styles
          if (leaf.spellingSuggestion || (leaf.suggestion && leaf.suggestionType === 'spelling')) {
            e.currentTarget.style.borderBottomColor = '#dc2626'
          }
          if (leaf.grammarSuggestion || (leaf.suggestion && leaf.suggestionType === 'grammar')) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'
          }
          if (leaf.suggestion && leaf.suggestionType !== 'spelling' && leaf.suggestionType !== 'grammar') {
            e.currentTarget.style.backgroundColor = '#fce7f3'
          }
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

  return (
    <span
      {...attributes}
      className={cn(
        leaf.added && 'bg-green-200',
        leaf.removed && 'bg-red-200 line-through'
      )}
    >
      {styledChildren}
    </span>
  )
}

// Convert HTML/rich text to Slate nodes
const htmlToSlate = (html: string): Descendant[] => {
  // Handle <br> tags first by converting them to newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n')
  
  // Then strip other HTML tags and convert entities
  text = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  
  if (!text.trim()) {
    return [{ type: 'paragraph', children: [{ text: '' }] }]
  }

  const lines = text.split('\n')
  return lines.map(line => ({
    type: 'paragraph',
    children: [{ text: line }]
  }))
}

// Convert plain text to Slate nodes (preserving newlines)
const textToSlate = (text: string): Descendant[] => {
  if (!text.trim()) {
    return [{ type: 'paragraph', children: [{ text: '' }] }]
  }

  const lines = text.split('\n')
  return lines.map(line => ({
    type: 'paragraph',
    children: [{ text: line }]
  }))
}

// Test the round-trip conversion:
// Input: "Line 1<br>Line 2<br>Line 3"
// htmlToSlate: converts <br> to \n, then splits by \n → ["Line 1", "Line 2", "Line 3"]
// slateToHtml: joins with \n, then replaces \n with <br> → "Line 1<br>Line 2<br>Line 3"
// This preserves newlines correctly!

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
  
  const result = parts.join('')
  // REMOVED: Excessive logging that was spamming console
  // console.log(`🔍 TEXT: slateToText called, input nodes:`, nodes.length, `output: "${result}" (length: ${result.length})`)
  // nodes.forEach((node, i) => {
  //   const nodeText = Node.string(node)
  //   console.log(`  Node ${i}: "${nodeText}" (length: ${nodeText.length})`)
  // })
  
  return result
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
>(({ initialContent, onContentChange, onFormatStateChange, documentId, onSuggestionClick, onSuggestionsUpdated, onDirectSuggestionsUpdate, suggestions: propSuggestions = [], isAcceptingSuggestion = false, onViralCritiqueUpdate }, ref) => {
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isGrammarCheckInProgress, setIsGrammarCheckInProgress] = useState(false)
  const [viralCritique, setViralCritique] = useState<ViralCritique | null>(null)
  const [isCheckingCritique, setIsCheckingCritique] = useState(false)
  const [isViralCritiqueInProgress, setIsViralCritiqueInProgress] = useState(false)
  const [isViralCritiqueUpdating, setIsViralCritiqueUpdating] = useState(false)
  const [isReplacingContent, setIsReplacingContent] = useState(false)
  
  // Diff highlighting state
  const [baseline, setBaseline] = useState<string>(() => {
    // Initialize baseline with the plain text version of initial content
    const initialNodes = htmlToSlate(initialContent)
    const baselineText = slateToText(initialNodes)
    return baselineText
  })
  
  // Diff mode state - only active after viral critique suggestions are applied
  const [diffMode, setDiffMode] = useState(false)
  
  // New content state - stores the AI suggestion for Accept action
  const [newContent, setNewContent] = useState<string>('')
  
  // Combined diff state - stores the unified diff text and decorations
  const [combinedDiffText, setCombinedDiffText] = useState<string>('')
  const [combinedDiffDecorations, setCombinedDiffDecorations] = useState<any[]>([])

  // Use suggestions from props, filtered for validity after operations
  const filteredSuggestionsRef = useRef<Suggestion[]>([])
  
  // Track if content has actually changed (not just selection)
  const contentChangeTriggerRef = useRef(0)
  
  // Update filtered suggestions when props change or operations occur
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
  
  useEffect(() => {

    
    const filtered = propSuggestions.filter(s => 
      s.startOffset != null && s.endOffset != null && s.startOffset < s.endOffset
    )
    
    setFilteredSuggestions(filtered);
    filteredSuggestionsRef.current = filtered;
    
    // Force decoration update when suggestions change
    contentChangeTriggerRef.current += 1
  }, [propSuggestions])
  
  const suggestions = filteredSuggestions;
  
  // Add render counter and cursor tracking
  const renderCountRef = useRef(0)
  const lastCursorPositionRef = useRef<Range | null>(null)
  
  renderCountRef.current += 1
  // REMOVED: Excessive render logging
  // console.log(`🔄 SMART: Component render #${renderCountRef.current}`)

  // Create Slate editor with plugins
  const editor = useMemo(
    () => withHistory(withReact(createEditor())),
    []
  )

  // Track cursor position changes - ONLY log when cursor actually jumps unexpectedly
  useEffect(() => {
    const currentSelection = editor.selection
    const lastSelection = lastCursorPositionRef.current
    
    if (currentSelection !== lastSelection) {
      // Only log if cursor jumps to beginning unexpectedly
      lastCursorPositionRef.current = currentSelection
    }
  })

  // Preserve cursor position during updates
  const preservedSelectionRef = useRef<Range | null>(null)

  // Initialize Slate value from initial content
  const [value, setValue] = useState<Descendant[]>(() => {
    return htmlToSlate(initialContent)
  })

  // Use refs for stable access to latest values without causing re-renders
  const onContentChangeRef = useRef(onContentChange)
  const documentIdRef = useRef(documentId)
  const isAcceptingSuggestionRef = useRef(isAcceptingSuggestion)
  
  // Add refs for the callback functions to prevent effect re-runs
  const stableDebouncedWordCompleteSpellCheckRef = useRef<((text: string, docId: string) => void) | null>(null)
  const sentenceCompleteGrammarCheckRef = useRef<((text: string, docId: string, trigger: string) => void) | null>(null)
  const debouncedViralCritiqueCheckRef = useRef<((text: string) => void) | null>(null)
  
  // Track if initial checks have been run for the current document
  const initialChecksRunRef = useRef<Set<string>>(new Set())
  
  // Track if cleanup is already in progress to prevent continuous calls
  const cleanupInProgressRef = useRef<boolean>(false)
  
  // Track last cleanup time to prevent too frequent cleanups
  const lastCleanupTimeRef = useRef<number>(0)
  
  // Track current viral critique text to prevent duplicate calls
  const currentViralCritiqueTextRef = useRef<string>("")
  
  // Update refs when props change, but don't trigger re-renders
  useEffect(() => {
    onContentChangeRef.current = onContentChange
    documentIdRef.current = documentId
    isAcceptingSuggestionRef.current = isAcceptingSuggestion
  })

  // Update callback function refs when they change
  useEffect(() => {
    stableDebouncedWordCompleteSpellCheckRef.current = stableDebouncedWordCompleteSpellCheck
    sentenceCompleteGrammarCheckRef.current = sentenceCompleteGrammarCheck
    // Note: viral critique ref is set immediately after function creation
  })

  // Handle initialContent changes (e.g., when suggestion is accepted) - STABLE VERSION
  useEffect(() => {
    if (!initialContent) {
      return
    }

    const newValue = htmlToSlate(initialContent)
    const newText = slateToText(newValue)
    const currentText = slateToText(value)
    
    // Only update if the content actually changed 
    if (newText !== currentText && newText !== previousTextRef.current) {
      // Preserve the current selection before updating
      if (editor.selection) {
        preservedSelectionRef.current = editor.selection
      }
      
      setValue(newValue)
      previousTextRef.current = newText
      
      // Restore selection after a short delay to allow the update to process
      if (preservedSelectionRef.current) {
        setTimeout(() => {
          try {
            if (preservedSelectionRef.current && editor.selection !== preservedSelectionRef.current) {
              Transforms.select(editor, preservedSelectionRef.current)
            }
          } catch (error) {
            // Silent fallback
          }
          preservedSelectionRef.current = null
        }, 10)
      }
    }
  }, [initialContent]) // Only depend on initialContent, not value or editor

  // Debug prop suggestions but DON'T cause re-renders
  useEffect(() => {
    // REMOVED: All excessive logging
    // Only run this effect when suggestions actually change
  }, [suggestions.length, suggestions.map(s => s.id).join(',')]) // STABLE: Only re-run when count or IDs change

  // Track previous text to avoid unnecessary checks
  const previousTextRef = useRef<string>("")
  const lastSpellCheckTimeRef = useRef<number>(0)
  const WORD_COMPLETION_DELAY = 50 // Wait 50ms after user stops typing to check

  // Add debug for key callbacks that might be changing
  const stableDebouncedWordCompleteSpellCheck = useCallback(
    debounce(async (text: string, docId: string) => {
      console.log('>> calling stableDebouncedWordCompleteSpellCheck with text:', text);
      // Early return if no text content
      if (!text || !text.trim()) {
        return
      }

      try {
        // Preserve cursor position before API call
        const selectionBeforeCheck = editor.selection
        console.log('the text is:', text, " for spell check and we're about to call checkSpellingOptimizedAction");
        const result = await checkSpellingOptimizedAction(text, docId)
        
        if (result.isSuccess && result.data && Array.isArray(result.data)) {
          console.log('the spell check result is:', result.data);
          // Update suggestions but preserve cursor position
          if (onDirectSuggestionsUpdate) {
            onDirectSuggestionsUpdate(result.data)
          } else if (onSuggestionsUpdated) {
            onSuggestionsUpdated()
          }
          
          // Restore cursor position if it was lost during suggestion update
          setTimeout(() => {
            if (selectionBeforeCheck && !editor.selection) {
              try {
                Transforms.select(editor, selectionBeforeCheck)
              } catch (error) {
                // Silent fallback
              }
            }
          }, 10)
        }
      } catch (error) {
        // Silent error handling
      }
    }, WORD_COMPLETION_DELAY),
    [onSuggestionsUpdated, onDirectSuggestionsUpdate, editor]
  )

  // Fast grammar check for sentence completion (period/newline)
  const sentenceCompleteGrammarCheck = useCallback(async (text: string, docId: string, trigger: string) => {
    // Early return if no text content
    if (!text || !text.trim()) {
      return
    }

    if (isGrammarCheckInProgress) {
      return
    }

    try {
      // Preserve cursor position before API call
      const selectionBeforeCheck = editor.selection
      
      setIsGrammarCheckInProgress(true)
      setIsCheckingGrammar(true)
      
      const result = await checkGrammarWithOpenAIAction(text, docId)
      
      if (result.isSuccess && result.data && Array.isArray(result.data)) {
        if (onSuggestionsUpdated) {
          onSuggestionsUpdated()
        }
        
        // Restore cursor position if it was lost during suggestion update
        setTimeout(() => {
          if (selectionBeforeCheck && !editor.selection) {
            try {
              Transforms.select(editor, selectionBeforeCheck)
            } catch (error) {
              // Silent fallback
            }
          }
        }, 10)
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setIsCheckingGrammar(false)
      setIsGrammarCheckInProgress(false)
    }
  }, [onSuggestionsUpdated, isGrammarCheckInProgress, editor])

  // New: Debounced viral critique check - now matches spell check timing
  const debouncedViralCritiqueCheck = useCallback(
    debounce(async (text: string) => {
      // Early return if no text content
      if (!text || !text.trim()) {
        return
      }

      if (isViralCritiqueInProgress || !documentIdRef.current) {
        return
      }

      // Prevent duplicate calls for the same text
      if (currentViralCritiqueTextRef.current === text) {
        return
      }

      try {
        setIsViralCritiqueInProgress(true)
        setIsCheckingCritique(true)
        currentViralCritiqueTextRef.current = text
        onViralCritiqueUpdate?.(null, true) // Notify parent that we're loading
        
        const result = await critiqueViralAbilityAction(text)

        if (result.isSuccess) {
          setViralCritique(result.data)
          onViralCritiqueUpdate?.(result.data, false) // Notify parent with result
        } else {
          // Optionally handle the error case, e.g., show a message
          setViralCritique(null)
          onViralCritiqueUpdate?.(null, false) // Notify parent of failure
        }
      } catch (error) {
        console.error("Error getting viral critique:", error)
        setViralCritique(null)
        onViralCritiqueUpdate?.(null, false) // Notify parent of error
      } finally {
        setIsCheckingCritique(false)
        setIsViralCritiqueInProgress(false)
        currentViralCritiqueTextRef.current = ""
      }
    }, WORD_COMPLETION_DELAY), // Use same delay as spell check (800ms)
    [isViralCritiqueInProgress, onViralCritiqueUpdate]
  )

  // Set the ref immediately when the function is created
  debouncedViralCritiqueCheckRef.current = debouncedViralCritiqueCheck

  // Detect if user just completed a word (typed space after letters)
  const isWordBoundary = useCallback((currentText: string, previousText: string): boolean => {
    if (currentText.length <= previousText.length) return false
    
    const lastChar = currentText[currentText.length - 1]
    const isSpaceOrPunctuation = /[\s.,!?;:]/.test(lastChar)
    
    if (!isSpaceOrPunctuation) return false
    
    // Check if there were letters before this boundary
    const beforeBoundary = currentText.slice(0, -1)
    const hasLettersAtEnd = /[a-zA-Z]+$/.test(beforeBoundary)
    
    return hasLettersAtEnd
  }, [])

  // Detect if user completed a sentence (typed period, exclamation, question mark)
  const isSentenceBoundary = useCallback((currentText: string, previousText: string): boolean => {
    if (currentText.length <= previousText.length) return false
    
    const lastChar = currentText[currentText.length - 1]
    return /[.!?]/.test(lastChar)
  }, [])

  // Format toggle functions (moved above handleChange to fix dependency order)
  const toggleFormat = useCallback((format: 'bold' | 'italic' | 'underline') => {
    const isActive = Editor.marks(editor)?.[format] === true
    
    if (isActive) {
      Editor.removeMark(editor, format)
    } else {
      Editor.addMark(editor, format, true)
    }
  }, [editor])

  const isFormatActive = useCallback((format: 'bold' | 'italic' | 'underline') => {
    const marks = Editor.marks(editor)
    return marks ? marks[format] === true : false
  }, [editor])

  // Update format state based on current selection
  const updateFormatState = useCallback(() => {
    if (onFormatStateChange) {
      onFormatStateChange({
        isBold: isFormatActive('bold'),
        isItalic: isFormatActive('italic'),
        isUnderlined: isFormatActive('underline'),
        isBulletList: false, // TODO: implement list detection
        isNumberedList: false // TODO: implement list detection
      })
    }
  }, [onFormatStateChange, isFormatActive])

  // Handle editor changes - STABILIZED VERSION
  const handleChange = useCallback((newValue: Descendant[]) => {
    // Preserve current selection before any operations
    const currentSelection = editor.selection
    
    // Update the value state
    setValue(newValue)
    
    // Call updateFormatState directly instead of through dependency
    if (onFormatStateChange) {
      onFormatStateChange({
        isBold: (Editor.marks(editor)?.bold === true),
        isItalic: (Editor.marks(editor)?.italic === true),
        isUnderlined: (Editor.marks(editor)?.underline === true),
        isBulletList: false, 
        isNumberedList: false
      })
    }
    
    const plainText = slateToText(newValue)
    const htmlContent = slateToHtml(newValue)
    
    // Don't call onContentChange during content replacement to prevent circular updates
    if (!isReplacingContent) {
      onContentChangeRef.current(htmlContent)
    }
    
    if (isAcceptingSuggestionRef.current) {
      return
    }
    
    const previousText = previousTextRef.current
    
    // Only proceed if text actually changed
    if (plainText === previousText || !documentIdRef.current || !plainText.trim()) {
      return
    }
    
    // Increment content change trigger when text actually changes
    contentChangeTriggerRef.current += 1
    
    // Preserve selection state to prevent cursor jumping
    if (currentSelection) {
      preservedSelectionRef.current = currentSelection
    }
    
    // Check for word completion (space after letters)
    const isWordComplete = (() => {
      if (plainText.length <= previousText.length) return false
      const lastChar = plainText[plainText.length - 1]
      const isSpaceOrPunctuation = /[\s.,!?;:]/.test(lastChar)
      if (!isSpaceOrPunctuation) return false
      const beforeBoundary = plainText.slice(0, -1)
      const hasLettersAtEnd = /[a-zA-Z]+$/.test(beforeBoundary)
      
      return hasLettersAtEnd
    })()
    
    if (isWordComplete && documentIdRef.current) {
      stableDebouncedWordCompleteSpellCheck(plainText, documentIdRef.current)
      // Also trigger viral critique on word completion (same as spell check)
      debouncedViralCritiqueCheck(plainText)
    }
    
    // Check for sentence completion (period, etc.)
    const isSentenceComplete = (() => {
      if (plainText.length <= previousText.length) return false
      const lastChar = plainText[plainText.length - 1]
      const isSentenceEnd = /[.!?]/.test(lastChar)
      
      return isSentenceEnd
    })()
    
    if (isSentenceComplete && documentIdRef.current) {
      sentenceCompleteGrammarCheck(plainText, documentIdRef.current, 'sentence-end')
      // Also trigger viral critique on sentence completion
      debouncedViralCritiqueCheck(plainText)
    }
    
    // Always update previous text after checks
    previousTextRef.current = plainText
    
  }, [editor, onFormatStateChange, isReplacingContent, isViralCritiqueUpdating]) // MINIMAL: Only stable dependencies

  // Simplified keyboard handler - only for shortcuts and Enter grammar check
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isAcceptingSuggestionRef.current) return

         // Handle Enter for grammar check
     if (event.key === 'Enter' && documentIdRef.current) {
       setTimeout(() => {
         const currentText = slateToText(value)
         if (currentText.trim() && documentIdRef.current) {
           sentenceCompleteGrammarCheck(currentText, documentIdRef.current, 'enter')
           // Also trigger viral critique on Enter key
           debouncedViralCritiqueCheck(currentText)
         }
       }, 100)
     }
    
    // Handle formatting shortcuts
    if (!event.ctrlKey && !event.metaKey) return
      
    switch (event.key) {
      case 'b':
        event.preventDefault()
        toggleFormat('bold')
        break
      case 'i':
        event.preventDefault()
        toggleFormat('italic')
        break
      case 'u':
        event.preventDefault()
        toggleFormat('underline')
        break
    }
  }, [documentIdRef, isAcceptingSuggestionRef, value, sentenceCompleteGrammarCheck, toggleFormat])

  // Accept suggestion by replacing text in the editor - STABILIZED VERSION
  const acceptSuggestion = useCallback((suggestion: Suggestion) => {
    if (suggestion.startOffset == null || suggestion.endOffset == null || !suggestion.suggestedText) {
      return
    }

    // Convert the current editor value to text to verify positioning
    const fullText = slateToText(editor.children) // Use editor.children directly instead of value

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

    // Get start and end positions
    const startPos = offsetToPosition[suggestion.startOffset]
    const endPos = offsetToPosition[suggestion.endOffset]

    if (!startPos || !endPos) {
      return
    }

    // Perform the replacement
    try {
      // Create the selection range
      const range = {
        anchor: startPos,
        focus: endPos
      }

      // Select the range and replace with suggested text
      Transforms.select(editor, range)
      Transforms.insertText(editor, suggestion.suggestedText)

      // Increment content change trigger to force decoration update
      contentChangeTriggerRef.current += 1

    } catch (error) {
      // Silent error handling
    }
  }, [editor]) // CRITICAL: Only depend on editor, not value

  // Helper function to calculate text offset for a given path
  const calculateTextOffset = useCallback((path: Path): number => {
    let offset = 0;
    
    for (const [node, nodePath] of Node.nodes(editor)) {
      if (path.length > 0 && nodePath[0] < path[0]) {
        if (Text.isText(node)) {
          offset += node.text.length;
        }
        // Add 1 for paragraph breaks (newlines)
        if (nodePath.length === 1) {
          offset += 1;
        }
      } else if (path.length > 1 && nodePath[0] === path[0] && nodePath[1] < path[1]) {
        if (Text.isText(node)) {
          offset += node.text.length;
        }
      } else if (nodePath.length === path.length && nodePath.every((val, i) => val === path[i])) {
        break;
      }
    }
    
    return offset;
  }, [editor]);

  // Helper function to group ranges by position
  const groupRangesByPosition = useCallback((ranges: Array<Range & { suggestionData: ExtendedSuggestion }>) => {
    const groups: Array<{ start: number; end: number; suggestions: ExtendedSuggestion[] }> = [];
    
    for (const range of ranges) {
      const start = range.anchor.offset;
      const end = range.focus.offset;
      
      // Find existing group with same position
      const existingGroup = groups.find(g => g.start === start && g.end === end);
      if (existingGroup) {
        existingGroup.suggestions.push(range.suggestionData);
      } else {
        groups.push({ start, end, suggestions: [range.suggestionData] });
      }
    }
    
    return groups;
  }, []);

  // Decorate function for highlighting suggestions
  const decorate = useCallback(([node, path]: [Node, Path]) => {
    // Only process text nodes
    if (!Text.isText(node)) {
      return [];
    }

    // Only log essential information
    if (suggestions.length === 0) {
      return [];
    }

    const text = node.text;
    if (!text || text.length === 0) {
      return [];
    }

    // Calculate text offset for this node
    const textOffset = calculateTextOffset(path);
    
    
    const ranges: Array<Range & { suggestionData: ExtendedSuggestion }> = [];

    // Process each suggestion
    for (const suggestion of suggestions as ExtendedSuggestion[]) {
      console.log('the decorate function is now looking at suggestion:', suggestion.originalText);
      // Skip stale suggestions
      if (suggestion.isStale) {
        console.log('the suggestion is stale:', suggestion.originalText);
        continue;
      }

      // Check if suggestion overlaps with this text node
      const suggestionStart = suggestion.startOffset;
      const suggestionEnd = suggestion.endOffset;
      
      if (suggestionStart === null || suggestionEnd === null) {
        console.log('the suggestion has no start or end offset:', suggestion.originalText);
        continue;
      }
      
      const nodeStart = textOffset;
      const nodeEnd = textOffset + text.length;

      if (suggestionStart >= nodeEnd || suggestionEnd <= nodeStart) {
        console.log('the suggestion does not overlap with this text node:', suggestion.originalText);
        continue; // No overlap
      }

      // Calculate range within this node
      const rangeStart = Math.max(0, suggestionStart - nodeStart);
      const rangeEnd = Math.min(text.length, suggestionEnd - nodeStart);

      if (rangeStart >= rangeEnd) {
        continue;
      }

      // Validate the text matches using the full document text for accuracy
      const fullText = slateToText(editor.children);
      console.log('the full text is:', fullText, ' while checking suggestion:', suggestion.originalText);
      const currentTextAtOffset = fullText.substring(suggestionStart, suggestionEnd);
      const originalText = suggestion.originalText;
      if (!originalText) {
        continue;
      }
      
      // More robust text comparison - normalize both texts
      const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim();
      const normalizedCurrent = currentTextAtOffset.replace(/\s+/g, ' ').trim();

      // More lenient matching - check if the original text is contained within the current text
      // This handles cases where there might be extra punctuation or whitespace
      const isContained = normalizedCurrent.includes(normalizedOriginal) || 
                         normalizedOriginal.includes(normalizedCurrent) ||
                         normalizedOriginal === normalizedCurrent;

      if (!isContained) {
        // Mark as stale and skip
        suggestion.isStale = true;
        continue;
      }

      const rangeWithSuggestion = {
        anchor: { path, offset: rangeStart },
        focus: { path, offset: rangeEnd },
        suggestionData: suggestion
      };
      ranges.push(rangeWithSuggestion);
    }

    // Group ranges by position and create combined decorations
    const groupedRanges = groupRangesByPosition(ranges);
    
    const decorations: Range[] = [];

    for (const group of groupedRanges) {
      const { start, end, suggestions: groupSuggestions } = group;
      
      const spellingSuggestion = groupSuggestions.find(s => s.suggestionType === 'spelling');
      const grammarSuggestion = groupSuggestions.find(s => s.suggestionType === 'grammar');
      const otherSuggestions = groupSuggestions.filter(s => s.suggestionType !== 'spelling' && s.suggestionType !== 'grammar');

      const decoration: any = {
        anchor: { path, offset: start },
        focus: { path, offset: end }
      };

      if (spellingSuggestion) {
        decoration.spellingSuggestion = true;
        decoration.spellingSuggestionId = spellingSuggestion.id;
        decoration.spellingTitle = spellingSuggestion.explanation || 'Click for spelling suggestion';
      }
      if (grammarSuggestion) {
        decoration.grammarSuggestion = true;
        decoration.grammarSuggestionId = grammarSuggestion.id;
        decoration.grammarTitle = grammarSuggestion.explanation || 'Click for grammar suggestion';
      }
      if (otherSuggestions.length > 0) {
        const otherSuggestion = otherSuggestions[0];
        decoration.suggestion = true;
        decoration.suggestionId = otherSuggestion.id;
        decoration.suggestionType = otherSuggestion.suggestionType;
        decoration.title = otherSuggestion.explanation || 'Click for suggestion';
      }

      decorations.push(decoration);
    }

    return decorations;
  }, [suggestions, contentChangeTriggerRef.current, diffMode, calculateTextOffset, groupRangesByPosition, editor]);

  // Cleanup function for stale suggestions
  const cleanupStaleSuggestions = useCallback(async (suggestionIds: string[]) => {
    if (!documentIdRef.current || suggestionIds.length === 0) return
    
    // Additional protection: don't cleanup if we're already in progress
    if (cleanupInProgressRef.current) {
      return
    }
    
    // Additional protection: don't cleanup if user is actively typing
    const now = Date.now()
    const timeSinceLastChange = now - lastSpellCheckTimeRef.current
    if (timeSinceLastChange < 3000) {
      return
    }
    
    // Additional protection: don't cleanup too frequently (minimum 10 seconds between cleanups)
    const timeSinceLastCleanup = now - lastCleanupTimeRef.current
    if (timeSinceLastCleanup < 10000) {
      return
    }
    
    try {
      lastCleanupTimeRef.current = now
      
      // Import the delete action and clean up stale suggestions
      const { deleteSuggestionsByIdsAction } = await import("@/actions/db/suggestions-actions")
      const result = await deleteSuggestionsByIdsAction(suggestionIds)
      
      if (result.isSuccess) {
        // Refresh suggestions to update UI
        // console.log("🧹 CLEANUP: Database cleanup successful, calling onSuggestionsUpdated")
        if (onSuggestionsUpdated) {
          onSuggestionsUpdated()
        } else {
          // console.log("🧹 CLEANUP: onSuggestionsUpdated callback is not available")
        }
      } else {
        // console.log("🧹 CLEANUP: Database cleanup failed:", result.message)
      }
    } catch (error) {
      console.error("Error during cleanup:", error)
    }
  }, [documentIdRef, onSuggestionsUpdated, cleanupInProgressRef, lastSpellCheckTimeRef, lastCleanupTimeRef])

  // Debounced version of cleanup to prevent excessive calls
  const debouncedCleanupStaleSuggestions = useCallback(
    debounce(async (suggestionIds: string[]) => {
      await cleanupStaleSuggestions(suggestionIds)
    }, 2000), // 2 second debounce
    [cleanupStaleSuggestions]
  )

  // Handle click events on suggestions
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const spellingSuggestionId = target.dataset.spellingSuggestionId
    const grammarSuggestionId = target.dataset.grammarSuggestionId
    const suggestionId = target.dataset.suggestionId
    
    // Prioritize spelling suggestions, then grammar, then other types
    const clickedSuggestionId = spellingSuggestionId || grammarSuggestionId || suggestionId
    
    if (clickedSuggestionId && onSuggestionClick) {
      const suggestion = suggestions.find(s => s.id === clickedSuggestionId)
      if (suggestion) {
        event.preventDefault()
        event.stopPropagation()
        onSuggestionClick(suggestion)
      }
    }
  }, [suggestions, onSuggestionClick])

  // Expose methods via ref - STABILIZED TO PREVENT RECREATION
  useImperativeHandle(ref, () => {
    // DON'T log on every creation to avoid noise
    // console.log(`🎯 SMART: Creating ref interface on render #${renderCountRef.current}`)
    
    return {
      formatText: (command: string) => {
        ReactEditor.focus(editor)
        if (command === 'bold' || command === 'italic' || command === 'underline') {
          const isActive = Editor.marks(editor)?.[command] === true
          if (isActive) {
            Editor.removeMark(editor, command)
          } else {
            Editor.addMark(editor, command, true)
          }
          
          // Increment content change trigger to force decoration update
          contentChangeTriggerRef.current += 1
        }
      },
      toggleBulletList: () => {
        ReactEditor.focus(editor)
        console.log("Toggle bullet list")
      },
      toggleNumberedList: () => {
        ReactEditor.focus(editor)
        console.log("Toggle numbered list")
      },
      focus: () => {
        ReactEditor.focus(editor)
      },
      acceptSuggestion: acceptSuggestion,
      insertContent: (content: string) => {
        // Move cursor to the end of the document
        const endPoint = Editor.end(editor, [])
        Transforms.select(editor, endPoint)
        
        // Insert the content at the end
        const currentText = slateToText(editor.children)
        const separator = currentText.trim() ? '\n\n' : ''
        Transforms.insertText(editor, separator + content)
        
        // Increment content change trigger to force decoration update
        contentChangeTriggerRef.current += 1
        
        // Focus the editor
        ReactEditor.focus(editor)
      },
      replaceContent: (content: string) => {
        
        
        // Set flags to prevent content reversion during viral critique update
        setIsViralCritiqueUpdating(true)
        setIsReplacingContent(true)
        
        // Store the current text as baseline before applying the viral critique suggestion
        const currentText = Node.string(editor)
        // console.log('📝 SETTING BASELINE:', currentText)
        setBaseline(currentText)
        
        // Enter diff mode
        setDiffMode(true)
        
        // Store the new content for Accept action (but don't apply it yet)
        const newContent = content
        setNewContent(content)
        
        // Create unified diff that combines both old and new text
        const { combinedText, decorations } = createUnifiedDiff(currentText, content)
        
        
        setCombinedDiffText(combinedText)
        setCombinedDiffDecorations(decorations)
        
        // Apply the combined text to the editor
        const newNodes = htmlToSlate(combinedText)
        while (editor.children.length > 0) {
          Transforms.removeNodes(editor, { at: [0] })
        }
        newNodes.forEach((node, i) => {
          Transforms.insertNodes(editor, node, { at: [i] })
        })
        
        // Increment content change trigger to force decoration update
        contentChangeTriggerRef.current += 1
        
        // Keep the original text in the editor - don't replace it
        // The diff decorations will show what's been added/removed
        
        // Also trigger the onContentChange callback to update parent state
        onContentChangeRef.current(currentText) // Keep original content for now
        
        // Focus the editor after a short delay to ensure the content has updated
        setTimeout(() => {
          try {
            ReactEditor.focus(editor)
            const endPoint = Editor.end(editor, [])
            Transforms.select(editor, endPoint)
            
            // Clear the flags after a delay to allow the update to complete
            setTimeout(() => {
              setIsViralCritiqueUpdating(false)
              setIsReplacingContent(false)
            }, 500)
          } catch (error) {
            console.error("Error during content replacement:", error)
            setIsViralCritiqueUpdating(false)
            setIsReplacingContent(false)
          }
        }, 50) // Increased delay to ensure content update has propagated
      },
      triggerViralCritique: () => {
        // Get the current text content from the editor
        const currentText = slateToText(editor.children)
        
        // Trigger viral critique check if we have content and document ID
        if (currentText.trim() && documentIdRef.current) {
          debouncedViralCritiqueCheckRef.current?.(currentText)
        }
      },
      applyItalicToBrackets: () => {
        // Find all text wrapped in square brackets and apply italic formatting
        const fullText = slateToText(editor.children)
        const bracketRegex = /\[([^\]]+)\]/g
        let match
        const brackets: Array<{ start: number; end: number; text: string }> = []
        
        // Find all bracket matches
        while ((match = bracketRegex.exec(fullText)) !== null) {
          brackets.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
          })
        }
        
        // Apply italic formatting to each bracket match
        brackets.forEach(bracket => {
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
              const paragraphIndex = path[0]
              if (paragraphIndex > 0) {
                offsetToPosition[textOffset] = { path: [...path, 0], offset: 0 }
                textOffset += 1
              }
            }
          }
          
          // Get start and end positions for this bracket
          const startPos = offsetToPosition[bracket.start]
          const endPos = offsetToPosition[bracket.end]
          
          if (startPos && endPos) {
            try {
              // Create the selection range
              const range = {
                anchor: startPos,
                focus: endPos
              }
              
              // Select the range and apply italic formatting
              Transforms.select(editor, range)
              Editor.addMark(editor, 'italic', true)
            } catch (error) {
              // Silent error handling
            }
          }
        })
        
        // Increment content change trigger to force decoration update
        contentChangeTriggerRef.current += 1
        
        // Clear selection after applying formatting
        try {
          Transforms.deselect(editor)
        } catch (error) {
          // Silent error handling
        }
      }
    }
  }, [editor, acceptSuggestion]) // MINIMAL STABLE DEPENDENCIES

  // Run initial checks on page load when content is available
  useEffect(() => {
    if (!initialContent || !documentId || !initialContent.trim()) {
      return
    }

    // Check if we've already run initial checks for this document
    if (initialChecksRunRef.current.has(documentId)) {
      return
    }

    // Mark that we've run initial checks for this document
    initialChecksRunRef.current.add(documentId)
    
    // Run checks immediately without setTimeout
    const plainText = slateToText(htmlToSlate(initialContent))
    
    if (plainText.trim()) {
      // Check if spell check function is available
      if (stableDebouncedWordCompleteSpellCheckRef.current) {
        stableDebouncedWordCompleteSpellCheckRef.current(plainText, documentId)
      }
      
      // Check if grammar check function is available
      if (sentenceCompleteGrammarCheckRef.current) {
        sentenceCompleteGrammarCheckRef.current(plainText, documentId, 'initial-load')
      }
      
      // Run viral critique immediately
      if (debouncedViralCritiqueCheckRef.current) {
        debouncedViralCritiqueCheckRef.current(plainText)
      } else {
        // Fallback: call the function directly if ref is not available
        debouncedViralCritiqueCheck(plainText)
      }
    }
    
  }, [documentId, initialContent]) // Remove debouncedViralCritiqueCheck dependency since ref is set immediately

  // Update format state when selection changes
  useEffect(() => {
    updateFormatState()
  }, [value, updateFormatState])

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
      
      {diffMode && (
        <RevisionBar
          onAccept={() => {
            // Accept the changes - apply the new content and exit diff mode
            const newNodes = htmlToSlate(newContent)
            while (editor.children.length > 0) {
              Transforms.removeNodes(editor, { at: [0] })
            }
            newNodes.forEach((node, i) => {
              Transforms.insertNodes(editor, node, { at: [i] })
            })
            setBaseline(newContent) // Update baseline to the new content
            setDiffMode(false)
            setNewContent('') // Clear the new content
            setCombinedDiffText('') // Clear combined diff text
            setCombinedDiffDecorations([]) // Clear combined diff decorations
            
            // Increment content change trigger to force decoration update
            contentChangeTriggerRef.current += 1
          }}
          onReject={() => {
            
            // Reject the changes - revert to baseline and exit diff mode
            const newNodes = textToSlate(baseline)
            
            
            while (editor.children.length > 0) {
              Transforms.removeNodes(editor, { at: [0] })
            }
            newNodes.forEach((node, i) => {
              Transforms.insertNodes(editor, node, { at: [i] })
            })
            
            
            
            setDiffMode(false)
            setNewContent('') // Clear the new content
            setCombinedDiffText('') // Clear combined diff text
            setCombinedDiffDecorations([]) // Clear combined diff decorations
            
            // Increment content change trigger to force decoration update
            contentChangeTriggerRef.current += 1
          }}
        />
      )}
      
      <style jsx>{`
        .slate-editor .suggestion-highlight:hover {
          background-color: #fbb6ce !important;
        }
      `}</style>
    </div>
  )
})

EditableContent.displayName = "EditableContent"