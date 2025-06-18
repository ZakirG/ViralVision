import { useRef, useEffect, useCallback } from 'react'
import { Editor, Text } from 'slate'
import { workerAPI } from '@/utils/workerClient'
import type { Suggestion } from '@/workers/checkWorker'

// Scheduling constants
const WORD_GAP = 300 // ms
const SENTENCE_GAP = 1200 // ms

type PendingLevel = 'none' | 'word' | 'sentence'

interface SchedulerState {
  lastKey: number
  lastSent: number
  pendingLevel: PendingLevel
  revision: number
  abortController: AbortController | null
  isRunning: boolean
}

export function useScheduler() {
  const stateRef = useRef<SchedulerState>({
    lastKey: Date.now(),
    lastSent: 0,
    pendingLevel: 'none',
    revision: 0,
    abortController: null,
    isRunning: false
  })

  const rafRef = useRef<number | null>(null)

  // Get current word at cursor position
  const getCurrentWord = useCallback((editor: Editor): string => {
    if (!editor.selection) return ''
    
    try {
      const { anchor } = editor.selection
      const node = Editor.node(editor, anchor.path)
      
      if (!node || !node[0] || !Text.isText(node[0])) return ''
      
      const textNode = node[0]
      const text = textNode.text
      const offset = anchor.offset
      
      // Find word boundaries around cursor
      let start = offset
      let end = offset
      
      // Move start backward to word boundary
      while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
        start--
      }
      
      // Move end forward to word boundary
      while (end < text.length && /[a-zA-Z]/.test(text[end])) {
        end++
      }
      
      return text.substring(start, end).trim()
    } catch (error) {
      console.error('Error getting current word:', error)
      return ''
    }
  }, [])

  // Get full text content
  const getFullText = useCallback((editor: Editor): string => {
    try {
      return Editor.string(editor, [])
    } catch (error) {
      console.error('Error getting full text:', error)
      return ''
    }
  }, [])

  // Queue spell check for current word
  const queueSpellCheck = useCallback(async (word: string, revision: number) => {
    if (!word || word.length < 2) return

    console.log(`🔤 [Scheduler] Queuing spell check for word: "${word}" (revision: ${revision})`)
    
    try {
      const suggestions = await workerAPI.spell(word, 'en_US')
      
      // Check if this response is still relevant
      if (revision === stateRef.current.revision) {
        if (suggestions.length > 0) {
          console.log(`✅ [Scheduler] Spell check completed: ${suggestions.length} suggestions for "${word}"`)
        } else {
          console.log(`✅ [Scheduler] Spell check completed: "${word}" is correctly spelled`)
        }
        stateRef.current.pendingLevel = 'none'
      } else {
        console.log(`🚫 [Scheduler] Ignoring stale spell check response (revision: ${revision}, current: ${stateRef.current.revision})`)
      }
    } catch (error) {
      console.error('Spell check error:', error)
      if (revision === stateRef.current.revision) {
        stateRef.current.pendingLevel = 'none'
      }
    }
  }, [])

  // Queue grammar check for full text
  const queueGrammarCheck = useCallback(async (text: string, revision: number) => {
    if (!text || text.trim().length < 10) return

    console.log(`📝 [Scheduler] Queuing grammar check for text: "${text.substring(0, 50)}..." (revision: ${revision})`)
    
    try {
      const suggestions = await workerAPI.grammar(text)
      
      // Check if this response is still relevant
      if (revision === stateRef.current.revision) {
        if (suggestions.length > 0) {
          console.log(`✅ [Scheduler] Grammar check completed: ${suggestions.length} suggestions`)
        } else {
          console.log(`✅ [Scheduler] Grammar check completed: no issues found`)
        }
        stateRef.current.pendingLevel = 'none'
      } else {
        console.log(`🚫 [Scheduler] Ignoring stale grammar check response (revision: ${revision}, current: ${stateRef.current.revision})`)
      }
    } catch (error) {
      console.error('Grammar check error:', error)
      if (revision === stateRef.current.revision) {
        stateRef.current.pendingLevel = 'none'
      }
    }
  }, [])

  // Main scheduler loop
  const schedulerLoop = useCallback((editor: Editor | null) => {
    if (!editor || !stateRef.current.isRunning) {
      rafRef.current = requestAnimationFrame(() => schedulerLoop(editor))
      return
    }

    const now = Date.now()
    const state = stateRef.current
    const idleTime = now - state.lastKey

    // Check if we should queue a word-level spell check
    if (idleTime >= WORD_GAP && state.pendingLevel === 'none') {
      const currentWord = getCurrentWord(editor)
      if (currentWord && currentWord.length >= 2) {
        state.pendingLevel = 'word'
        state.revision++
        
        // Cancel any pending requests
        if (state.abortController) {
          state.abortController.abort()
        }
        state.abortController = new AbortController()
        
        queueSpellCheck(currentWord, state.revision)
      }
    }

    // Check if we should queue a sentence-level grammar check
    if (idleTime >= SENTENCE_GAP && state.pendingLevel !== 'sentence') {
      const fullText = getFullText(editor)
      if (fullText && fullText.trim().length >= 10) {
        state.pendingLevel = 'sentence'
        state.revision++
        
        // Cancel any pending requests
        if (state.abortController) {
          state.abortController.abort()
        }
        state.abortController = new AbortController()
        
        queueGrammarCheck(fullText, state.revision)
      }
    }

    // Schedule next loop iteration (approximately 32ms = ~30fps)
    rafRef.current = requestAnimationFrame(() => schedulerLoop(editor))
  }, [getCurrentWord, getFullText, queueSpellCheck, queueGrammarCheck])

  // Register a keypress event
  const registerKey = useCallback((char: string, editor: Editor) => {
    const now = Date.now()
    const state = stateRef.current
    
    // Update last key timestamp
    state.lastKey = now
    
    // Check if this is a sentence-ending character
    if (/[.!?]/.test(char)) {
      state.lastSent = now
      console.log(`📍 [Scheduler] Sentence boundary detected: "${char}"`)
    }
    
    // Reset pending level if user is actively typing
    if (state.pendingLevel !== 'none') {
      console.log(`⏰ [Scheduler] Resetting pending check due to new keypress: "${char}"`)
      state.pendingLevel = 'none'
      state.revision++
      
      // Cancel any pending requests
      if (state.abortController) {
        state.abortController.abort()
        state.abortController = null
      }
    }

    console.log(`⌨️  [Scheduler] Key registered: "${char}" (idle will start counting from now)`)
  }, [])

  // Start the scheduler
  const startScheduler = useCallback((editor: Editor | null) => {
    if (stateRef.current.isRunning) return
    
    stateRef.current.isRunning = true
    console.log('🚀 [Scheduler] Starting scheduler loop')
    schedulerLoop(editor)
  }, [schedulerLoop])

  // Stop the scheduler
  const stopScheduler = useCallback(() => {
    stateRef.current.isRunning = false
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    
    if (stateRef.current.abortController) {
      stateRef.current.abortController.abort()
      stateRef.current.abortController = null
    }
    
    console.log('🛑 [Scheduler] Stopping scheduler loop')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScheduler()
    }
  }, [stopScheduler])

  return {
    registerKey,
    startScheduler,
    stopScheduler
  }
} 