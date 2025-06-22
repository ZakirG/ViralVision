"use client"

import { useState, useEffect } from 'react'
import { workerAPI, type Suggestion } from '@/utils/workerClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TestWorkerPage() {
  const [spellResult, setSpellResult] = useState<Suggestion[]>([])
  const [grammarResult, setGrammarResult] = useState<Suggestion[]>([])
  const [testWord, setTestWord] = useState('tommorow')
  const [testText, setTestText] = useState('This could very easily be improved.')
  const [isLoading, setIsLoading] = useState(false)

  // Test the worker on page load
  useEffect(() => {
    testWorker()
  }, [])

  const testWorker = async () => {
    setIsLoading(true)
    try {
      console.log('🔧 Testing worker API...')
      
      // Test spell checking
      const spellResults = await workerAPI.spell('tommorow', 'en_US')
      console.log('✅ Spell check result:', spellResults)
      setSpellResult(spellResults)
      
      // Test grammar checking
      const grammarResults = await workerAPI.grammar('This could very easily be improved.')
      console.log('✅ Grammar check result:', grammarResults)
      setGrammarResult(grammarResults)
      
    } catch (error) {
      console.error('❌ Worker test failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testCustomSpell = async () => {
    setIsLoading(true)
    try {
      const results = await workerAPI.spell(testWord, 'en_US')
      setSpellResult(results)
    } catch (error) {
      console.error('Spell check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testCustomGrammar = async () => {
    setIsLoading(true)
    try {
      const results = await workerAPI.grammar(testText)
      setGrammarResult(results)
    } catch (error) {
      console.error('Grammar check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Worker API Test</h1>
      
      <div className="space-y-6">
        {/* Status indicator */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-sm text-gray-600">
            Worker Status: {isLoading ? '⏳ Loading...' : '✅ Ready'}
          </p>
        </div>

        {/* Spell checking test */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Spell Check Test</h2>
          <div className="flex gap-2 mb-4">
            <Input
              value={testWord}
              onChange={(e) => setTestWord(e.target.value)}
              placeholder="Enter word to check..."
              className="flex-1"
            />
            <Button onClick={testCustomSpell} disabled={isLoading}>
              Check Spelling
            </Button>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Results:</h3>
            {spellResult.length > 0 ? (
              <div className="space-y-2">
                {spellResult.map((suggestion) => (
                  <div key={suggestion.id} className="bg-yellow-100 p-3 rounded">
                    <p><strong>Rule:</strong> {suggestion.rule}</p>
                    <p><strong>Message:</strong> {suggestion.message}</p>
                    <p><strong>Original:</strong> "{suggestion.original}"</p>
                    <p><strong>Suggestions:</strong> {suggestion.suggestions && suggestion.suggestions.length > 0 ? suggestion.suggestions.join(', ') : 'No suggestions'}</p>
                    <p><strong>Offset:</strong> {suggestion.offset} (length: {suggestion.length})</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No spelling issues found</p>
            )}
          </div>
        </div>

        {/* Grammar checking test */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Grammar Check Test</h2>
          <div className="flex gap-2 mb-4">
            <Input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to check..."
              className="flex-1"
            />
            <Button onClick={testCustomGrammar} disabled={isLoading}>
              Check Grammar
            </Button>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Results:</h3>
            {grammarResult.length > 0 ? (
              <div className="space-y-2">
                {grammarResult.map((suggestion) => (
                  <div key={suggestion.id} className="bg-red-100 p-3 rounded">
                    <p><strong>Rule:</strong> {suggestion.rule}</p>
                    <p><strong>Message:</strong> {suggestion.message}</p>
                    <p><strong>Original:</strong> "{suggestion.original}"</p>
                    <p><strong>Suggestions:</strong> {suggestion.suggestions && suggestion.suggestions.length > 0 ? suggestion.suggestions.join(', ') : 'No suggestions'}</p>
                    <p><strong>Offset:</strong> {suggestion.offset} (length: {suggestion.length})</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No grammar issues found</p>
            )}
          </div>
        </div>

        {/* Refresh test */}
        <div className="flex gap-2">
          <Button onClick={testWorker} disabled={isLoading} variant="outline">
            Re-run Full Test
          </Button>
        </div>

        {/* Console instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Console Test:</h3>
          <p className="text-sm text-gray-700 mb-2">
            Open your browser console and try:
          </p>
          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
            await workerAPI.spell('tommorow', 'en_US')
          </code>
          <p className="text-xs text-gray-500 mt-2">
            This should resolve with a suggestion for "tomorrow".
          </p>
        </div>
      </div>
    </div>
  )
} 