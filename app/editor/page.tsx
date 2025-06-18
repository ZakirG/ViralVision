"use client"

import { useRef } from 'react'
import EditableComponent, { EditableHandle } from './Editable'
import { useSuggestStore } from '@/stores/useSuggestStore'
import { Button } from '@/components/ui/button'

export default function EditorPage() {
  const editableRef = useRef<EditableHandle>(null)
  const { getAllSuggestions, getStats, clearAll, dismiss } = useSuggestStore()
  
  const suggestions = getAllSuggestions()
  const stats = getStats()

  const acceptSpecificSuggestion = (suggestionId: string, replacement: string) => {
    if (editableRef.current) {
      editableRef.current.acceptSuggestion(suggestionId, replacement)
    }
  }

  const dismissSpecificSuggestion = (suggestionId: string) => {
    dismiss(suggestionId)
  }

  const clearAllSuggestions = () => {
    clearAll()
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Document Editor</h1>
          <div className="flex gap-2">
            <Button onClick={clearAllSuggestions} variant="outline" size="sm">
              Clear All Suggestions
            </Button>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
          <h3 className="font-semibold mb-3">Writing Assistant Status</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Active Suggestions</p>
              <p className="font-bold text-2xl text-blue-600">{stats.active}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Dismissed</p>
              <p className="font-bold text-2xl text-gray-500">{stats.dismissed}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Processed</p>
              <p className="font-bold text-2xl text-purple-600">{stats.total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Acceptance Rate</p>
              <p className="font-bold text-2xl text-green-600">
                {stats.total > 0 ? Math.round(((stats.total - stats.dismissed) / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Your Document</h2>
            <p className="text-sm text-gray-600">
              Write naturally. Grammar and spelling will be checked automatically.
            </p>
          </div>
          <EditableComponent ref={editableRef} />
        </div>

        {/* Suggestions Panel */}
        <div className="border rounded-lg bg-white">
          <div className="bg-gray-50 px-4 py-3 border-b rounded-t-lg">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Writing Suggestions ({suggestions.length})
              </h2>
              {suggestions.length > 0 && (
                <p className="text-sm text-gray-600">
                  Click suggestions above or use buttons below to apply changes
                </p>
              )}
            </div>
          </div>
          
          <div className="p-4">
            {suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div 
                    key={suggestion.id} 
                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        {/* Suggestion Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                                                     <span className={`text-xs px-2 py-1 rounded font-medium ${
                             suggestion.suggestionType === 'spelling' 
                               ? 'bg-red-100 text-red-700 border border-red-200' 
                               : suggestion.suggestionType === 'grammar'
                               ? 'bg-blue-100 text-blue-700 border border-blue-200'
                               : 'bg-purple-100 text-purple-700 border border-purple-200'
                           }`}>
                             {suggestion.suggestionType ? 
                               suggestion.suggestionType.charAt(0).toUpperCase() + suggestion.suggestionType.slice(1) :
                               'Unknown'
                             }
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Position: {suggestion.startOffset}-{suggestion.endOffset}
                          </span>
                          {suggestion.confidence && (
                            <span className="text-xs text-gray-500 bg-green-100 px-2 py-1 rounded">
                              {Math.round(parseFloat(suggestion.confidence) * 100)}% confident
                            </span>
                          )}
                        </div>

                        {/* Suggestion Content */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Change:</span>
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono">
                              "{suggestion.originalText}"
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono">
                              "{suggestion.suggestedText}"
                            </span>
                          </div>
                          
                          {suggestion.explanation && (
                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              <span className="font-medium">Explanation:</span> {suggestion.explanation}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          onClick={() => acceptSpecificSuggestion(suggestion.id, suggestion.suggestedText!)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={!suggestion.suggestedText}
                        >
                          ✓ Accept
                        </Button>
                        <Button
                          onClick={() => dismissSpecificSuggestion(suggestion.id)}
                          size="sm"
                          variant="outline"
                          className="text-gray-600 hover:text-gray-800"
                        >
                          ✕ Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✨</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No suggestions at the moment
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Keep writing! Our AI assistant will automatically check for spelling and grammar issues as you type.
                  Suggestions will appear here when found.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Help Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">💡 How It Works</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <p className="font-medium mb-1">Automatic Checking:</p>
              <ul className="space-y-1 text-xs">
                <li>• Wait 1 second after typing → spell check</li>
                <li>• Type a period (.) → spell + grammar check</li>
                <li>• Real-time highlighting in editor</li>
                <li>• Parallel processing for speed</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Interacting with Suggestions:</p>
              <ul className="space-y-1 text-xs">
                <li>• Click highlighted text → quick popover</li>
                <li>• Use buttons below → detailed view</li>
                <li>• Accept/dismiss individual suggestions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 