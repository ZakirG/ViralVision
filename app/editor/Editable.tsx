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
  const isAcceptingSuggestionRef = useRef(false)
  
  const { getAllSuggestions, dismiss } = useSuggestStore()
  const suggestions = getAllSuggestions()

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
    if (!suggestion || !replacement || !suggestion.originalText) {
      console.log("❌ Invalid suggestion or replacement:", { id, replacement, originalText: suggestion?.originalText })
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
  }, [suggestions, value, editor])

  const handleChange = (newValue: Descendant[]) => {
    // Skip updates during suggestion acceptance to prevent conflicts
    if (isAcceptingSuggestionRef.current) {
      return
    }

    setValue(newValue)

    // Log operations for debugging
    if (editor.operations.length > 0) {
      console.log("📝 Slate operations:", editor.operations.map(op => op.type))
    }
  }

  return (
    <div className="relative">
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
          onKeyDown={(event) => {
            // Prevent operations during suggestion acceptance
            if (isAcceptingSuggestionRef.current) {
              event.preventDefault()
              return
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