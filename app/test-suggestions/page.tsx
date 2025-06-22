"use client"

import { useState, useEffect } from 'react'
import { useSuggestStore } from '@/stores/useSuggestStore'
import type { Suggestion } from '@/db/schema'
import { Button } from '@/components/ui/button'

// Mock suggestions for testing
const mockSuggestions: Suggestion[] = [
  {
    id: 'suggest-1',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 0,
    endOffset: 5,
    originalText: 'Hello',
    suggestionType: 'spelling',
    suggestedText: 'Hi',
    explanation: 'Consider a more casual greeting',
    confidence: '0.8',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  },
  {
    id: 'suggest-2',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 6,
    endOffset: 11,
    originalText: 'world',
    suggestionType: 'style',
    suggestedText: 'everyone',
    explanation: 'More inclusive language',
    confidence: '0.9',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  },
  {
    id: 'suggest-3',
    documentId: 'test-doc',
    versionNumber: 1,
    startOffset: 12,
    endOffset: 20,
    originalText: 'tommorow',
    suggestionType: 'spelling',
    suggestedText: 'tomorrow',
    explanation: 'Spelling correction',
    confidence: '0.95',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  }
]

const newRevisionSuggestions: Suggestion[] = [
  {
    id: 'suggest-4',
    documentId: 'test-doc',
    versionNumber: 2,
    startOffset: 21,
    endOffset: 30,
    originalText: 'very good',
    suggestionType: 'style',
    suggestedText: 'excellent',
    explanation: 'Stronger word choice',
    confidence: '0.7',
    accepted: false,
    dismissed: false,
    createdAt: new Date()
  },
  // Include a previously dismissed suggestion to test filtering
  ...mockSuggestions.slice(0, 2)
]

export default function TestSuggestionsPage() {
  const {
    byId,
    dismissed,
    revision,
    merge,
    dismiss,
    getAllSuggestions,
    isDismissed,
    clearAll,
    getStats
  } = useSuggestStore()
  
  const [currentRevision, setCurrentRevision] = useState(1)
  const stats = getStats()

  // Load initial suggestions on mount
  useEffect(() => {
    merge(1, mockSuggestions)
  }, [merge])

  const handleDismiss = (id: string) => {
    dismiss(id)
  }

  const loadNewRevision = () => {
    const newRev = currentRevision + 1
    setCurrentRevision(newRev)
    merge(newRev, newRevisionSuggestions)
  }

  const loadOldRevision = () => {
    // Try to load an older revision - should be ignored
    merge(0, mockSuggestions)
  }

  const clearAllSuggestions = () => {
    clearAll()
    setCurrentRevision(1)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Suggestion Store Test</h1>
      
      <div className="space-y-6">
        {/* Stats */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Store Stats</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Revision</p>
              <p className="font-bold text-lg">{revision}</p>
            </div>
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
          <Button onClick={loadNewRevision} className="bg-blue-600 hover:bg-blue-700">
            Load Revision {currentRevision + 1}
          </Button>
          <Button onClick={loadOldRevision} variant="outline">
            Try Old Revision (Should Ignore)
          </Button>
          <Button onClick={clearAllSuggestions} variant="destructive">
            Clear All
          </Button>
        </div>

        {/* Active Suggestions */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Active Suggestions</h3>
          <div className="space-y-3">
            {getAllSuggestions().map((suggestion) => (
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
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {suggestion.suggestionType}
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
                    onClick={() => handleDismiss(suggestion.id)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
            {getAllSuggestions().length === 0 && (
              <p className="text-gray-500 text-center py-4">No active suggestions</p>
            )}
          </div>
        </div>

        {/* Dismissed Suggestions */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Dismissed Suggestions (localStorage)</h3>
          <div className="space-y-2">
            {Array.from(dismissed).map((id) => (
              <div key={id} className="bg-gray-100 p-2 rounded text-sm">
                <span className="font-mono">{id}</span>
                <span className="text-gray-600 ml-2">(dismissed)</span>
              </div>
            ))}
            {dismissed.size === 0 && (
              <p className="text-gray-500 text-center py-2">No dismissed suggestions</p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Dismiss some suggestions and observe them move to the dismissed list</li>
            <li>Reload the page - dismissed suggestions should persist in localStorage</li>
            <li>Load a new revision - dismissed suggestions should not reappear</li>
            <li>Try loading an old revision - should be ignored (check console)</li>
            <li>Check browser dev tools → Application → Local Storage for persisted data</li>
          </ol>
        </div>

        {/* Console Instructions */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Console Monitoring:</h3>
          <p className="text-sm text-gray-700">
            Open browser console to see detailed logging of store operations:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
            <li><code>📥 Merged suggestions</code> - When suggestions are added</li>
            <li><code>🙈 Dismissed suggestion</code> - When suggestions are dismissed</li>
            <li><code>💾 Saved X dismissed suggestions</code> - localStorage updates</li>
            <li><code>🚫 Ignoring merge with older revision</code> - Revision protection</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 