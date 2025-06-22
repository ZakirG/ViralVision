"use client"

import { useEffect, useRef, useState } from 'react'
import { useSuggestStore } from '@/stores/useSuggestStore'
import EditableComponent, { EditableHandle } from '@/app/editor/Editable'
import type { Suggestion } from '@/db/schema'
import { Button } from '@/components/ui/button'

// Mock suggestions that match the test text in the Editable component
// ORIGINAL TEXT: "Test with misspeled words and bad grammer for testing suggestions."
//                 0123456789012345678901234567890123456789012345678901234567890123456789
//                           ^misspeled^             ^grammer^
// 
// IMPORTANT: These positions are for the ORIGINAL text. When suggestions are accepted
// in different orders, the text changes and positions shift! This is a known limitation
// of this test setup. In a real app, suggestions should be recalculated after each change.

const mockSuggestions: Suggestion[] = [
  {
    id: 'spell-1',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 10, // "misspeled" (positions 10-18 in original text)
    endOffset: 19,
    originalText: 'misspeled',
    suggestionType: 'spelling',
    suggestedText: 'misspelled',
    explanation: 'Spelling correction',
    confidence: '0.95',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  },
  {
    id: 'grammar-1',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 34, // "grammer" (positions 34-40 in original text)
    endOffset: 41,   // NOTE: If spelling is fixed first, this position will be off by +1
    originalText: 'grammer',
    suggestionType: 'grammar',
    suggestedText: 'grammar',
    explanation: 'Grammar correction - grammer should be grammar',
    confidence: '0.9',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  }
]

export default function TestHighlightPage() {
  const editableRef = useRef<EditableHandle>(null)
  const { merge, getAllSuggestions, getStats, clearAll } = useSuggestStore()
  const [revision, setRevision] = useState(1)
  
  const suggestions = getAllSuggestions()
  const stats = getStats()

  // Load mock suggestions on mount
  useEffect(() => {
    merge(1, mockSuggestions)
  }, [merge])

  const loadNewSuggestions = () => {
    const newRev = revision + 1
    setRevision(newRev)
    
    // Add some new suggestions
    const newSuggestions: Suggestion[] = [
      {
        id: 'spell-2',
        documentId: 'test-doc',
        versionNumber: newRev,
        startOffset: 42, // "testing"
        endOffset: 49,
        originalText: 'testing',
        suggestionType: 'style',
        suggestedText: 'evaluating',
        explanation: 'Consider a more formal word',
        confidence: '0.7',
        accepted: false,
        dismissed: false,
        createdAt: new Date()
      }
    ]
    
    merge(newRev, [...mockSuggestions, ...newSuggestions])
  }

  const clearSuggestions = () => {
    clearAll()
    setRevision(1)
  }

  const testAcceptSuggestion = () => {
    if (suggestions.length > 0 && editableRef.current) {
      const firstSuggestion = suggestions[0]
      editableRef.current.acceptSuggestion(firstSuggestion.id, firstSuggestion.suggestedText!)
    }
  }

  const acceptSpecificSuggestion = (suggestionId: string, replacement: string) => {
    if (editableRef.current) {
      editableRef.current.acceptSuggestion(suggestionId, replacement)
    }
  }

  const testDismissSuggestion = () => {
    if (suggestions.length > 0 && editableRef.current) {
      const firstSuggestion = suggestions[0]
      editableRef.current.dismissSuggestion(firstSuggestion.id)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Interactive Suggestion Highlighting Test</h1>
      
      <div className="space-y-6">
        {/* Store Stats */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Suggestion Store Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Active</p>
              <p className="font-bold text-lg text-green-600">{stats.active}</p>
            </div>
            <div>
              <p className="text-gray-600">Dismissed</p>
              <p className="font-bold text-lg text-red-600">{stats.dismissed}</p>
            </div>
            <div>
              <p className="text-gray-600">Total</p>
              <p className="font-bold text-lg">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 flex-wrap">
          <Button onClick={loadNewSuggestions} className="bg-blue-600 hover:bg-blue-700">
            Load More Suggestions
          </Button>
          <Button onClick={testAcceptSuggestion} variant="outline">
            Accept First Suggestion (API)
          </Button>
          <Button onClick={testDismissSuggestion} variant="outline">
            Dismiss First Suggestion (API)
          </Button>
          <Button onClick={clearSuggestions} variant="destructive">
            Clear All Suggestions
          </Button>
        </div>

        {/* Enhanced Editable Component */}
        <div className="space-y-2">
          <h3 className="font-semibold">Enhanced Editable Component</h3>
          <p className="text-sm text-gray-600">
            Click on underlined words to see suggestion popovers. The text contains "misspeled" and "grammer" which should be highlighted.
          </p>
          <EditableComponent ref={editableRef} />
        </div>

        {/* Active Suggestions List */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Active Suggestions ({suggestions.length})</h3>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="font-mono text-xs bg-gray-200 px-1 rounded">
                        {suggestion.id}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        suggestion.suggestionType === 'spelling' 
                          ? 'bg-red-100 text-red-700' 
                          : suggestion.suggestionType === 'grammar'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {suggestion.suggestionType}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({suggestion.startOffset}-{suggestion.endOffset})
                      </span>
                    </div>
                    <p className="text-sm">
                      <strong>Original:</strong> "{suggestion.originalText}" → 
                      <strong> Suggested:</strong> "{suggestion.suggestedText}"
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {suggestion.explanation}
                    </p>
                  </div>
                  <Button
                    onClick={() => acceptSpecificSuggestion(suggestion.id, suggestion.suggestedText!)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={!suggestion.suggestedText}
                  >
                    Accept "{suggestion.suggestedText}"
                  </Button>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-gray-500 text-center py-4">No active suggestions</p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><strong>Interactive Highlighting:</strong> Click on underlined words like "misspeled" and "grammer"</li>
            <li><strong>Popover UI:</strong> See suggestion details in the popup with Replace/Ignore buttons</li>
            <li><strong>Accept Suggestions:</strong> Click "Replace" to apply the correction</li>
            <li><strong>Dismiss Suggestions:</strong> Click "Ignore" to hide the suggestion</li>
            <li><strong>Collision Protection:</strong> Editor is locked during suggestion acceptance</li>
            <li><strong>Persistence:</strong> Dismissed suggestions won't reappear</li>
          </ol>
        </div>

        {/* Dynamic Position Calculation Info */}
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h3 className="font-semibold mb-2 text-green-800">✅ Dynamic Position Calculation</h3>
          <div className="text-sm text-green-700 space-y-2">
            <p><strong>Fixed Implementation:</strong> Suggestions now use dynamic text search instead of static offsets!</p>
            <p><strong>How it works:</strong> When accepting a suggestion, the system searches for the exact target text in the current document using JavaScript's <code>indexOf()</code> method.</p>
            <p><strong>Benefits:</strong> Works regardless of acceptance order - no more position shift issues!</p>
            <div className="mt-2 space-y-1">
              <p className="font-medium">Test Any Order:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Accept suggestions in any order you want</li>
                <li>Both "misspeled" → "misspelled" and "grammer" → "grammar" should work perfectly</li>
                <li>Check console for detailed logging of the dynamic position finding</li>
                <li>Result should be: "Test with misspelled words and bad grammar for testing suggestions."</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Technical Features:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Slate Decoration:</strong> Creates ranges with suggestionId for highlighting</li>
            <li><strong>Radix Popover:</strong> Positioned tooltips with suggestion details</li>
            <li><strong>Collision Protection:</strong> `isAcceptingSuggestionRef` prevents worker conflicts</li>
            <li><strong>Store Integration:</strong> Zustand store manages suggestion state and persistence</li>
            <li><strong>Text Replacement:</strong> Slate Transforms for precise text modifications</li>
            <li><strong>Event System:</strong> Custom events for component communication</li>
          </ul>
        </div>

        {/* Console Monitoring */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Console Monitoring:</h3>
          <p className="text-sm text-gray-700">
            Check browser console for detailed logging of dynamic position calculation:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
            <li><code>🎯 Current full text</code> - Shows current document content</li>
            <li><code>🎯 Found target text at positions</code> - Dynamic position calculation results</li>
            <li><code>🎯 Target text found</code> - Confirms exact text being replaced</li>
            <li><code>🎯 Context around target</code> - Shows surrounding text for verification</li>
            <li><code>🎯 Text after replacement</code> - Final result after suggestion acceptance</li>
            <li><code>🔒 Suggestion acceptance in progress</code> - Collision protection active</li>
            <li><code>✅ Successfully accepted suggestion</code> - Successful replacement</li>
            <li><code>🙈 Dismissed suggestion</code> - Store dismissal logging</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 