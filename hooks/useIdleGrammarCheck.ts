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
  /** Trigger spell check only */
  triggerSpellCheck: () => void
  /** Trigger grammar check only */
  triggerGrammarCheck: () => void
  /** Trigger combined spell + grammar check */
  triggerCheck: () => void
  /** Cancel any pending spell/grammar check (optionally filter by type) */
  cancelCheck: (checkType?: 'spell' | 'grammar' | 'combined') => void
  /** Whether a spell/grammar check is currently in progress */
  isChecking: boolean
  /** Current revision number */
  revision: number
  /** Schedule idle spell check */
  scheduleIdleSpellCheck: () => void
  /** Schedule idle grammar check */
  scheduleIdleGrammarCheck: () => void
}

export function useIdleGrammarCheck({
  text,
  isFocused,
  onSuggestions,
  dismissedIds,
  idleTimeout = 1000
}: UseIdleSpellGrammarCheckOptions): UseIdleSpellGrammarCheckReturn {
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const spellIdleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const grammarIdleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isCheckingRef = useRef(false)
  const currentCheckTypeRef = useRef<'spell' | 'grammar' | 'combined' | null>(null)
  const revisionRef = useRef(0)
  const lastTextRef = useRef('')
  const lastCheckTimeRef = useRef(0)

  // Cancel any pending timer or request (optionally filter by type)
  const cancelCheck = useCallback((checkType?: 'spell' | 'grammar' | 'combined') => {
    // If no type specified, cancel everything
    if (!checkType) {
      // Cancel all idle timers
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (spellIdleTimerRef.current) {
        clearTimeout(spellIdleTimerRef.current)
        spellIdleTimerRef.current = null
      }
      if (grammarIdleTimerRef.current) {
        clearTimeout(grammarIdleTimerRef.current)
        grammarIdleTimerRef.current = null
      }

      // Abort ongoing request
      if (abortControllerRef.current) {
        console.log("🚫 Cancelling all ongoing checks")
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      isCheckingRef.current = false
      currentCheckTypeRef.current = null
      return
    }

    // Only cancel if the current check matches the specified type
    if (currentCheckTypeRef.current === checkType) {
      // Cancel idle timers
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      if (spellIdleTimerRef.current) {
        clearTimeout(spellIdleTimerRef.current)
        spellIdleTimerRef.current = null
      }
      if (grammarIdleTimerRef.current) {
        clearTimeout(grammarIdleTimerRef.current)
        grammarIdleTimerRef.current = null
      }

      // Abort ongoing request
      if (abortControllerRef.current) {
        console.log(`🚫 Cancelling ongoing ${checkType} check`)
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      isCheckingRef.current = false
      currentCheckTypeRef.current = null
    }
  }, [])

  // Perform spell check only
  const performSpellCheck = useCallback(async (checkText: string, revision: number) => {
    if (!checkText.trim()) {
      return
    }

    // Cancel any existing spell check (but allow grammar checks to continue)
    cancelCheck('spell')

    // Allow spell checks to run even if grammar checks are running
    console.log(`📝 Starting spell check (current check type: ${currentCheckTypeRef.current})`)

    try {
      isCheckingRef.current = true
      currentCheckTypeRef.current = 'spell'
      revisionRef.current = revision

      console.log(`📝 Starting spell check only - revision ${revision}`)

      // Create new abort controller for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch('/api/spellCheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: checkText,
          dismissedIds,
          revision
        }),
        signal: controller.signal
      })

      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log("🚫 Spell check was cancelled")
        return
      }

      if (!response.ok) {
        throw new Error(`Spell check failed: ${response.status}`)
      }

      const result = await response.json()
      
      // Only apply results if this is still the current revision
      if (revisionRef.current === revision && !controller.signal.aborted) {
        console.log(`✅ Spell check complete - ${result.suggestions.length} suggestions`)
        console.log(`📝 Spell suggestions:`, result.suggestions.map((s: any) => `"${s.originalText}" → "${s.suggestedText}"`))
        console.log(`📝 Calling onSuggestions with:`, result.suggestions)
        onSuggestions(result.suggestions)
        lastCheckTimeRef.current = Date.now()
        console.log(`📝 onSuggestions called successfully`)
      } else {
        console.log(`🕰️ Spell check result discarded - revision mismatch or cancelled`)
        console.log(`   Current revision: ${revisionRef.current}, received: ${revision}`)
        console.log(`   Controller aborted: ${controller.signal.aborted}`)
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("🚫 Spell check was aborted")
      } else {
        console.error("🚨 Spell check error:", error)
      }
    } finally {
      isCheckingRef.current = false
      currentCheckTypeRef.current = null
      abortControllerRef.current = null
    }
  }, [dismissedIds, onSuggestions, cancelCheck])

  // Perform grammar check only
  const performGrammarCheck = useCallback(async (checkText: string, revision: number) => {
    if (!checkText.trim()) {
      return
    }

    // Cancel any existing grammar check (but allow spell checks to continue)
    cancelCheck('grammar')

    // Allow grammar checks to run even if spell checks are running
    console.log(`🎯 Starting grammar check (current check type: ${currentCheckTypeRef.current})`)

    try {
      isCheckingRef.current = true
      currentCheckTypeRef.current = 'grammar'
      revisionRef.current = revision

      console.log(`🎯 Starting grammar check only - revision ${revision}`)

      // Create new abort controller for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      const response = await fetch('/api/llmGrammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: checkText,
          dismissedIds,
          revision
        }),
        signal: controller.signal
      })

      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log("🚫 Grammar check was cancelled")
        return
      }

      if (!response.ok) {
        throw new Error(`Grammar check failed: ${response.status}`)
      }

      const result = await response.json()
      
      // Only apply results if this is still the current revision
      if (revisionRef.current === revision && !controller.signal.aborted) {
        console.log(`✅ Grammar check complete - ${result.suggestions.length} suggestions`)
        onSuggestions(result.suggestions)
        lastCheckTimeRef.current = Date.now()
      } else {
        console.log(`🕰️ Grammar check result discarded - revision mismatch or cancelled`)
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("🚫 Grammar check was aborted")
      } else {
        console.error("🚨 Grammar check error:", error)
      }
    } finally {
      isCheckingRef.current = false
      currentCheckTypeRef.current = null
      abortControllerRef.current = null
    }
  }, [dismissedIds, onSuggestions, cancelCheck])

  // Schedule idle spell check
  const scheduleIdleSpellCheck = useCallback(() => {
    if (!text.trim() || !isFocused) return

    // Clear existing spell idle timer
    if (spellIdleTimerRef.current) {
      clearTimeout(spellIdleTimerRef.current)
    }

    // Schedule new spell check after idle timeout
    spellIdleTimerRef.current = setTimeout(() => {
      if (text.trim() && isFocused) {
        const currentRevision = revisionRef.current + 1
        console.log(`⏰ Idle spell check triggered (revision ${currentRevision})`)
        performSpellCheck(text, currentRevision)
      }
    }, idleTimeout)
  }, [text, isFocused, idleTimeout, performSpellCheck])

  // Schedule idle grammar check
  const scheduleIdleGrammarCheck = useCallback(() => {
    if (!text.trim() || !isFocused) return

    // Clear existing grammar idle timer
    if (grammarIdleTimerRef.current) {
      clearTimeout(grammarIdleTimerRef.current)
    }

    // Schedule new grammar check after idle timeout
    grammarIdleTimerRef.current = setTimeout(() => {
      if (text.trim() && isFocused) {
        const currentRevision = revisionRef.current + 1
        console.log(`⏰ Idle grammar check triggered (revision ${currentRevision})`)
        performGrammarCheck(text, currentRevision)
      }
    }, idleTimeout)
  }, [text, isFocused, idleTimeout, performGrammarCheck])

  // Perform both spelling and grammar checks (combined)
  const performCombinedCheck = useCallback(async (checkText: string, revision: number) => {
    if (!checkText.trim() || isCheckingRef.current) {
      return
    }

    try {
      isCheckingRef.current = true
      revisionRef.current = revision

      console.log(`⏱️ Starting combined spell + grammar check - revision ${revision}`)

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
        console.log("🚫 Combined spell + grammar check was cancelled")
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
        console.log(`🕰️ Combined check result discarded - revision mismatch or cancelled`)
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("🚫 Combined spell + grammar check was aborted")
      } else {
        console.error("🚨 Combined spell + grammar check error:", error)
      }
    } finally {
      isCheckingRef.current = false
      abortControllerRef.current = null
    }
  }, [dismissedIds, onSuggestions])

  // Note: Idle scheduling removed - now using spacebar and punctuation triggers

  // Immediate spell check trigger (for spacebar)
  const triggerSpellCheck = useCallback(() => {
    if (!text.trim()) return

    // Only cancel spell checks, let grammar checks continue
    // cancelCheck('spell') - removed to let background checks complete

    // Throttle immediate triggers to prevent spam
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckTimeRef.current
    if (timeSinceLastCheck < 100) { // Reduced from 500ms to 100ms for faster response
      console.log("🚦 Spell check throttled - too soon since last check")
      return
    }

    const currentRevision = revisionRef.current + 1
    console.log(`📝 Immediate spell check triggered (revision ${currentRevision})`)
    performSpellCheck(text, currentRevision)
  }, [text, isFocused, performSpellCheck])

  // Immediate grammar check trigger (for punctuation)
  const triggerGrammarCheck = useCallback(() => {
    if (!text.trim()) return

    // Only cancel grammar checks, let spell checks continue
    // cancelCheck('grammar') - removed to let background checks complete

    // Throttle immediate triggers to prevent spam
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckTimeRef.current
    if (timeSinceLastCheck < 1000) { // Don't trigger if less than 1s since last check
      console.log("🚦 Grammar check throttled - too soon since last check")
      return
    }

    const currentRevision = revisionRef.current + 1
    console.log(`🎯 Immediate grammar check triggered (revision ${currentRevision})`)
    performGrammarCheck(text, currentRevision)
  }, [text, isFocused, performGrammarCheck])

  // Combined trigger (for combined checks)
  const triggerCheck = useCallback(() => {
    if (!text.trim() || !isFocused) return

    cancelCheck() // Cancel any pending check

    // Throttle immediate triggers to prevent spam
    const now = Date.now()
    const timeSinceLastCheck = now - lastCheckTimeRef.current
    if (timeSinceLastCheck < 2000) { // Don't trigger if less than 2s since last check
      console.log("🚦 Combined check throttled - too soon since last check")
      return
    }

    const currentRevision = revisionRef.current + 1
    console.log(`🎯 Immediate combined check triggered (revision ${currentRevision})`)
    performCombinedCheck(text, currentRevision)
  }, [text, isFocused, cancelCheck, performCombinedCheck])

  // Handle text changes
  useEffect(() => {
    // Update last text reference
    if (text !== lastTextRef.current) {
      lastTextRef.current = text
      
      // Schedule idle checks when text changes
      if (text.trim() && isFocused) {
        scheduleIdleSpellCheck()
        scheduleIdleGrammarCheck()
      }
    }
  }, [text, isFocused, scheduleIdleSpellCheck, scheduleIdleGrammarCheck])

  // Handle focus changes
  useEffect(() => {
    if (!isFocused) {
      // Cancel checks when editor loses focus
      // cancelCheck()
    } else if (text.trim()) {
      // Schedule idle checks when editor gains focus and has text
      scheduleIdleSpellCheck()
      scheduleIdleGrammarCheck()
    }
  }, [isFocused, cancelCheck, scheduleIdleSpellCheck, scheduleIdleGrammarCheck, text])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelCheck()
    }
  }, [cancelCheck])

  return {
    triggerSpellCheck,
    triggerGrammarCheck,
    triggerCheck,
    cancelCheck,
    scheduleIdleSpellCheck,
    scheduleIdleGrammarCheck,
    isChecking: isCheckingRef.current,
    revision: revisionRef.current
  }
} 