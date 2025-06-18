/*
<ai_context>
Custom hook for efficient idle-based spell and grammar checking.
Minimizes API calls through intelligent scheduling and request cancellation.
Triggers after 1s idle (spell) or period (spell + grammar), aborts on user typing.
</ai_context>
*/

import { useCallback, useRef, useEffect } from 'react'

interface GrammarSuggestion {
  id: string
  originalText: string
  suggestedText: string
  explanation: string
  startOffset: number
  endOffset: number
  confidence: number
  suggestionType: 'grammar'
}

interface UseIdleSpellGrammarCheckOptions {
  /** Current text content */
  text: string
  /** Whether editor is focused */
  isFocused: boolean
  /** Callback when spell/grammar suggestions are received */
  onSuggestions: (suggestions: GrammarSuggestion[]) => void
  /** IDs of dismissed suggestions to filter out */
  dismissedIds: string[]
  /** Idle timeout in ms (default: 1000) */
  idleTimeout?: number
}

interface UseIdleSpellGrammarCheckReturn {
  /** Trigger spell + grammar check immediately (e.g., on period) */
  triggerCheck: () => void
  /** Cancel any pending spell/grammar check */
  cancelCheck: () => void
  /** Whether a spell/grammar check is currently in progress */
  isChecking: boolean
  /** Current revision number */
  revision: number
}

export function useIdleGrammarCheck({
  text,
  isFocused,
  onSuggestions,
  dismissedIds,
  idleTimeout = 1000
}: UseIdleSpellGrammarCheckOptions): UseIdleSpellGrammarCheckReturn {
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isCheckingRef = useRef(false)
  const revisionRef = useRef(0)
  const lastTextRef = useRef('')
  const lastCheckTimeRef = useRef(0)

  // Cancel any pending timer or request
  const cancelCheck = useCallback(() => {
    // Cancel idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }

    // Abort ongoing request
    if (abortControllerRef.current) {
      console.log("🚫 Cancelling ongoing grammar check")
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    isCheckingRef.current = false
  }, [])

  // Perform both spelling and grammar checks
  const performGrammarCheck = useCallback(async (checkText: string, revision: number) => {
    if (!checkText.trim() || isCheckingRef.current) {
      return
    }

    try {
      isCheckingRef.current = true
      revisionRef.current = revision

      console.log(`⏱️ Starting spell + grammar check - revision ${revision}`)

      // Create new abort controller for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Run both spelling and grammar checks in parallel
      const [spellResponse, grammarResponse] = await Promise.all([
        // Spell check using server action
        fetch('/api/spellCheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: checkText,
            dismissedIds,
            revision
          }),
          signal: controller.signal
        }),
        // Grammar check using LLM API
        fetch('/api/llmGrammar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: checkText,
            dismissedIds,
            revision
          }),
          signal: controller.signal
        })
      ])

      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log("🚫 Spell + grammar check was cancelled")
        return
      }

      // Process results
      let allSuggestions: any[] = []

      // Process spell check results
      if (spellResponse.ok) {
        const spellResult = await spellResponse.json()
        if (spellResult.suggestions) {
          allSuggestions.push(...spellResult.suggestions)
          console.log(`📝 Spell check found ${spellResult.suggestions.length} suggestions`)
        }
      } else {
        console.warn("⚠️ Spell check failed:", spellResponse.status)
      }

      // Process grammar check results
      if (grammarResponse.ok) {
        const grammarResult = await grammarResponse.json()
        if (grammarResult.suggestions) {
          allSuggestions.push(...grammarResult.suggestions)
          console.log(`📝 Grammar check found ${grammarResult.suggestions.length} suggestions`)
        }
      } else {
        console.warn("⚠️ Grammar check failed:", grammarResponse.status)
      }
      
      // Only apply results if this is still the current revision
      if (revisionRef.current === revision && !controller.signal.aborted) {
        console.log(`✅ Combined check complete - ${allSuggestions.length} total suggestions`)
        onSuggestions(allSuggestions)
        lastCheckTimeRef.current = Date.now()
      } else {
        console.log(`🕰️ Check result discarded - revision mismatch or cancelled`)
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("🚫 Spell + grammar check was aborted")
      } else {
        console.error("🚨 Spell + grammar check error:", error)
      }
    } finally {
      isCheckingRef.current = false
      abortControllerRef.current = null
    }
  }, [dismissedIds, onSuggestions])

  // Schedule a grammar check after idle timeout
  const scheduleIdleCheck = useCallback(() => {
    cancelCheck() // Cancel any existing timer/request

    // Only schedule if editor is focused and text has changed
    if (!isFocused || !text.trim() || text === lastTextRef.current) {
      return
    }

    console.log("⏰ Scheduling idle grammar check...")
    
    idleTimerRef.current = setTimeout(() => {
      const currentRevision = revisionRef.current + 1
      console.log(`⏱️ Idle timeout reached - triggering grammar check (revision ${currentRevision})`)
      performGrammarCheck(text, currentRevision)
    }, idleTimeout)
  }, [text, isFocused, idleTimeout, cancelCheck, performGrammarCheck])

  // Immediate trigger (for period detection)
  const triggerCheck = useCallback(() => {
    if (!text.trim() || !isFocused) return

    cancelCheck() // Cancel any pending check

    // Throttle immediate triggers to prevent spam
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckTimeRef.current
    if (timeSinceLastCheck < 2000) { // Don't trigger if less than 2s since last check
      console.log("🚦 Grammar check throttled - too soon since last check")
      return
    }

    const currentRevision = revisionRef.current + 1
    console.log(`🎯 Immediate grammar check triggered (revision ${currentRevision})`)
    performGrammarCheck(text, currentRevision)
  }, [text, isFocused, cancelCheck, performGrammarCheck])

  // Handle text changes
  useEffect(() => {
    // Cancel any pending check when user starts typing
    if (text !== lastTextRef.current) {
      cancelCheck()
      
      // Update last text reference
      lastTextRef.current = text
      
      // Schedule new idle check
      scheduleIdleCheck()
    }
  }, [text, scheduleIdleCheck, cancelCheck])

  // Handle focus changes
  useEffect(() => {
    if (!isFocused) {
      // Cancel checks when editor loses focus
      cancelCheck()
    } else if (text.trim()) {
      // Re-schedule when editor gains focus
      scheduleIdleCheck()
    }
  }, [isFocused, scheduleIdleCheck, cancelCheck, text])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelCheck()
    }
  }, [cancelCheck])

  return {
    triggerCheck,
    cancelCheck,
    isChecking: isCheckingRef.current,
    revision: revisionRef.current
  }
} 