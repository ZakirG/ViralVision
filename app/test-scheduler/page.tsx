"use client"

import { useState, useRef, useCallback } from 'react'
import { createEditor, Descendant } from 'slate'
import { Slate, Editable, withReact } from 'slate-react'
import { withHistory } from 'slate-history'
import { useScheduler } from '@/hooks/useScheduler'

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: 'Start typing to test the scheduler. Try typing at ~100 WPM to see spell/grammar checks queued automatically!' }],
  },
]

export default function TestSchedulerPage() {
  const [value, setValue] = useState<Descendant[]>(initialValue)
  const editor = useRef(withHistory(withReact(createEditor())))
  const { registerKey, startScheduler, stopScheduler } = useScheduler()
  
  // Track WPM calculation
  const typingStats = useRef({
    keyCount: 0,
    startTime: Date.now(),
    isRunning: false
  })
  
  const [wpm, setWpm] = useState(0)
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false)

  const calculateWPM = useCallback(() => {
    const stats = typingStats.current
    const elapsed = (Date.now() - stats.startTime) / 1000 / 60 // minutes
    const wordsTyped = stats.keyCount / 5 // average 5 characters per word
    return elapsed > 0 ? Math.round(wordsTyped / elapsed) : 0
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const char = event.key
    
    // Start timing on first keystroke
    if (!typingStats.current.isRunning) {
      typingStats.current.startTime = Date.now()
      typingStats.current.isRunning = true
      typingStats.current.keyCount = 0
    }
    
    // Count printable characters and some special keys
    if (char.length === 1 || ['Backspace', 'Enter', 'Space'].includes(char)) {
      typingStats.current.keyCount++
      
      // Update WPM display every 10 keystrokes
      if (typingStats.current.keyCount % 10 === 0) {
        setWpm(calculateWPM())
      }
      
      // Register key with scheduler
      if (isSchedulerRunning) {
        registerKey(char, editor.current)
      }
    }
  }, [registerKey, calculateWPM, isSchedulerRunning])

  const startTest = useCallback(() => {
    setIsSchedulerRunning(true)
    startScheduler(editor.current)
    
    // Reset stats
    typingStats.current = {
      keyCount: 0,
      startTime: Date.now(),
      isRunning: false
    }
    setWpm(0)
  }, [startScheduler])

  const stopTest = useCallback(() => {
    setIsSchedulerRunning(false)
    stopScheduler()
    typingStats.current.isRunning = false
  }, [stopScheduler])

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Scheduler Test - Typing Detection</h1>
      
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex gap-4 items-center">
          <button
            onClick={startTest}
            disabled={isSchedulerRunning}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
          >
            Start Scheduler
          </button>
          <button
            onClick={stopTest}
            disabled={!isSchedulerRunning}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-400"
          >
            Stop Scheduler
          </button>
        </div>

        {/* Stats Display */}
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Current WPM</p>
              <p className="text-2xl font-bold">{wpm}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Keys Typed</p>
              <p className="text-2xl font-bold">{typingStats.current.keyCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Scheduler Status</p>
              <p className={`text-2xl font-bold ${isSchedulerRunning ? 'text-green-600' : 'text-red-600'}`}>
                {isSchedulerRunning ? 'ACTIVE' : 'STOPPED'}
              </p>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="border rounded-lg p-4 min-h-96 bg-white">
          <Slate
            editor={editor.current}
            initialValue={value}
            onChange={setValue}
          >
            <Editable
              onKeyDown={handleKeyDown}
              placeholder="Start typing here to test the scheduler..."
              style={{
                minHeight: '300px',
                fontSize: '18px',
                lineHeight: '1.6',
                outline: 'none',
              }}
              className="focus:outline-none"
            />
          </Slate>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click "Start Scheduler" to begin monitoring</li>
            <li>Type continuously to reach ~100 WPM (aim for 8-9 characters per second)</li>
            <li>Watch the browser console for scheduler events:</li>
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li><code>⌨️ [Scheduler] Key registered</code> - Each keystroke</li>
              <li><code>🔤 [Scheduler] Queuing spell check</code> - Word-level checks (300ms after stopping)</li>
              <li><code>📝 [Scheduler] Queuing grammar check</code> - Sentence-level checks (1200ms after stopping)</li>
              <li><code>📍 [Scheduler] Sentence boundary detected</code> - When you type . ! or ?</li>
            </ul>
            <li>Try typing misspelled words like "tommorow" and sentences with grammar issues</li>
            <li>Notice how the scheduler prevents duplicate requests using revision numbers</li>
          </ol>
        </div>

        {/* Test Examples */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Test Phrases (copy and type these):</h3>
          <div className="space-y-2 text-sm font-mono">
            <p>tommorow definately seperate recieve</p>
            <p>This could very easily be improved by someone.</p>
            <p>The quick brown fox jumps over the lazy dog. This sentence could definitely be improved.</p>
          </div>
        </div>
      </div>
    </div>
  )
} 