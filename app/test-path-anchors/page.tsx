"use client"

import { useState, useCallback, useRef } from 'react'
import { createEditor, Descendant } from 'slate'
import { Slate, Editable, withReact } from 'slate-react'
import { withHistory } from 'slate-history'

// Define a test suggestion interface to avoid type issues
interface TestSuggestion {
  id: string
  documentId: string
  versionNumber: number
  startOffset: number | null
  endOffset: number | null
  originalText: string | null
  suggestionType: string | null
  explanation: string | null
  suggestedText: string | null
  priority: string | null
  confidence: number | null
  createdAt: Date
  updatedAt: Date
}

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: 'This is a test with misspeled words for testing path anchors.' }],
  },
]

// Mock suggestions for testing with correct offsets
// Text: "This is a test with misspeled words for testing path anchors."
//       01234567890123456789012345678901234567890123456789012345678901
//                           ^misspeled^         ^testing^
const mockSuggestions: TestSuggestion[] = [
  {
    id: 'test-1',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 20, // "misspeled" starts at position 20
    endOffset: 29,   // "misspeled" ends at position 29
    originalText: 'misspeled',
    suggestionType: 'spelling',
    explanation: 'Possible spelling mistake',
    suggestedText: 'misspelled',
    priority: 'medium',
    confidence: 0.9,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'test-2', 
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 40, // "testing" starts at position 40
    endOffset: 47,   // "testing" ends at position 47
    originalText: 'testing',
    suggestionType: 'style',
    explanation: 'Consider a more formal word',
    suggestedText: 'evaluating',
    priority: 'low',
    confidence: 0.7,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export default function TestPathAnchorsPage() {
  const [value, setValue] = useState<Descendant[]>(initialValue)
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>(mockSuggestions)
  const editor = useRef(withHistory(withReact(createEditor())))

  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue)
    
    // Simulate updating suggestions based on operations
    const operations = editor.current.operations
    if (operations.length > 0) {
      console.log('🔧 Operations detected:', operations.length, operations)
      
      // For testing, just log when operations happen
      // In real implementation, this would update suggestion offsets
      operations.forEach((op) => {
        if (op.type === 'remove_text' || op.type === 'insert_text') {
          console.log(`📝 ${op.type}: path=${JSON.stringify(op.path)}, offset=${op.offset}`)
          if (op.type === 'remove_text') {
            console.log(`   Removed: "${op.text}"`)
          } else {
            console.log(`   Inserted: "${op.text}"`)
          }
        }
      })
    }
  }, [])

  // Simple decorate function to highlight suggestions
  const decorate = useCallback(([node, path]: any) => {
    const ranges: any[] = []
    
    if (node.text && suggestions.length > 0) {
      // Calculate text offset for this node
      let textOffset = 0
      for (let i = 0; i < path[0]; i++) {
        const prevNode = value[i]
        if (prevNode && 'children' in prevNode) {
          textOffset += prevNode.children.reduce((sum: number, child: any) => sum + (child.text?.length || 0), 0)
          if (i > 0) textOffset += 1 // newline
        }
      }
      
      suggestions.forEach((suggestion) => {
        if (suggestion.startOffset == null || suggestion.endOffset == null) return
        
        const suggestionStart = suggestion.startOffset
        const suggestionEnd = suggestion.endOffset
        const nodeStart = textOffset
        const nodeEnd = textOffset + node.text.length
        
        // Check if suggestion overlaps with this node
        if (suggestionStart < nodeEnd && suggestionEnd > nodeStart) {
          const rangeStart = Math.max(0, suggestionStart - nodeStart)
          const rangeEnd = Math.min(node.text.length, suggestionEnd - nodeStart)
          
          if (rangeStart < rangeEnd) {
            ranges.push({
              anchor: { path, offset: rangeStart },
              focus: { path, offset: rangeEnd },
              highlight: true,
              suggestionId: suggestion.id
            })
          }
        }
      })
    }
    
    return ranges
  }, [suggestions, value])

  // Custom leaf renderer for highlights
  const renderLeaf = useCallback(({ attributes, children, leaf }: any) => {
    if (leaf.highlight) {
      return (
        <span
          {...attributes}
          style={{
            backgroundColor: '#ffeaa7',
            borderRadius: '2px',
            padding: '1px 2px'
          }}
          data-suggestion-id={leaf.suggestionId}
        >
          {children}
        </span>
      )
    }
    
    return <span {...attributes}>{children}</span>
  }, [])

  const clearSuggestions = () => {
    setSuggestions([])
    console.log('🧹 Cleared all suggestions')
  }

  const resetSuggestions = () => {
    setSuggestions(mockSuggestions)
    console.log('🔄 Reset suggestions')
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Path Anchors Test</h1>
      
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex gap-4">
          <button
            onClick={clearSuggestions}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Suggestions
          </button>
          <button
            onClick={resetSuggestions}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reset Suggestions
          </button>
        </div>

        {/* Editor */}
        <div className="border rounded-lg p-4 min-h-64 bg-white">
          <Slate
            editor={editor.current}
            initialValue={value}
            onChange={handleChange}
          >
            <Editable
              decorate={decorate}
              renderLeaf={renderLeaf}
              placeholder="Start editing to test path anchors..."
              style={{
                minHeight: '200px',
                fontSize: '18px',
                lineHeight: '1.6',
                outline: 'none',
              }}
              className="focus:outline-none"
            />
          </Slate>
        </div>

        {/* Status */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Active Suggestions:</h3>
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="text-sm">
                <span className="font-mono bg-yellow-200 px-1 rounded">
                  {suggestion.startOffset}-{suggestion.endOffset}
                </span>
                {' '}
                "{suggestion.originalText}" → "{suggestion.suggestedText}"
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-gray-500 text-sm">No active suggestions</p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Notice the highlighted words "misspeled" and "testing"</li>
            <li>Try backspacing inside the highlighted words</li>
            <li>Watch the browser console for operation logs</li>
            <li>Observe that highlights should be removed when text changes</li>
            <li>Use Clear/Reset buttons to test highlight behavior</li>
          </ol>
        </div>
      </div>
    </div>
  )
} 