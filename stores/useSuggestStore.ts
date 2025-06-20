import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Suggestion } from '@/db/schema'

// Generate a simple hash for dictionary version
function generateDictionaryHash(): string {
  // For now, use a simple version string
  // In a real implementation, this could be based on dictionary file checksums
  return `dict_v1_${Date.now().toString(36)}`
}

// Get localStorage key for dismissed suggestions
function getDismissedStorageKey(): string {
  const dictHash = generateDictionaryHash()
  return `viralvision_dismissed_${dictHash}`
}

// Load dismissed suggestion IDs from localStorage
function loadDismissedFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  
  try {
    const key = getDismissedStorageKey()
    const stored = localStorage.getItem(key)
    if (stored) {
      const dismissedArray = JSON.parse(stored) as string[]
      return new Set(dismissedArray)
    }
  } catch (error) {
    console.error('Error loading dismissed suggestions from localStorage:', error)
  }
  
  return new Set()
}

// Save dismissed suggestion IDs to localStorage
function saveDismissedToStorage(dismissed: Set<string>): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getDismissedStorageKey()
    const dismissedArray = Array.from(dismissed)
    localStorage.setItem(key, JSON.stringify(dismissedArray))
    console.log(`💾 Saved ${dismissedArray.length} dismissed suggestions to localStorage`)
  } catch (error) {
    console.error('Error saving dismissed suggestions to localStorage:', error)
  }
}

// Store state interface
interface SuggestStore {
  // State
  byId: Record<string, Suggestion>
  dismissed: Set<string>
  revision: number
  
  // Actions
  merge: (revision: number, incoming: Suggestion[]) => void
  dismiss: (id: string) => void
  addSuggestions: (suggestions: Suggestion[]) => void
  
  // Getters
  getAllSuggestions: () => Suggestion[]
  getSuggestionById: (id: string) => Suggestion | undefined
  isDismissed: (id: string) => boolean
  getDismissedIds: () => string[]
  
  // Utilities
  clearAll: () => void
  getStats: () => { total: number; dismissed: number; active: number }
}

export const useSuggestStore = create<SuggestStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    byId: {},
    dismissed: loadDismissedFromStorage(),
    revision: 0,
    
    // Actions
    merge: (revision: number, incoming: Suggestion[]) => {
      const state = get()
      
      // Ignore if revision is older than current
      if (revision < state.revision) {
        console.log(`🚫 Ignoring merge with older revision: ${revision} < ${state.revision}`)
        return
      }
      
      const newById = { ...state.byId }
      let addedCount = 0
      let dismissedCount = 0
      
      // Process incoming suggestions
      for (const suggestion of incoming) {
        // Skip if suggestion is dismissed
        if (state.dismissed.has(suggestion.id)) {
          dismissedCount++
          continue
        }
        
        // Add or update suggestion
        newById[suggestion.id] = suggestion
        addedCount++
      }
      
      console.log(`📥 Merged suggestions: revision ${revision}, added ${addedCount}, dismissed ${dismissedCount}`)
      
      set({
        byId: newById,
        revision: Math.max(state.revision, revision)
      })
    },
    
    dismiss: (id: string) => {
      const state = get()
      const newById = { ...state.byId }
      const newDismissed = new Set(state.dismissed)
      
      // Remove from active suggestions
      delete newById[id]
      
      // Add to dismissed set
      newDismissed.add(id)
      
      console.log(`🙈 Dismissed suggestion: ${id}`)
      
      set({
        byId: newById,
        dismissed: newDismissed
      })
      
      // Persist to localStorage
      saveDismissedToStorage(newDismissed)
    },
    
    addSuggestions: (suggestions: Suggestion[]) => {
      const state = get()
      const newById = { ...state.byId }
      let addedCount = 0
      let dismissedCount = 0
      
      console.log(`📦 STORE: addSuggestions called with ${suggestions.length} suggestions`)
      console.log(`📦 STORE: Current store has ${Object.keys(state.byId).length} suggestions`)
      
      // Process incoming suggestions
      for (const suggestion of suggestions) {
        console.log(`📦 STORE: Processing suggestion: ${suggestion.suggestionType} "${suggestion.originalText}" → "${suggestion.suggestedText}"`)
        
        // Skip if suggestion is dismissed
        if (state.dismissed.has(suggestion.id)) {
          console.log(`📦 STORE: Skipping dismissed suggestion: ${suggestion.id}`)
          dismissedCount++
          continue
        }
        
        // Add suggestion (will overwrite if exists)
        newById[suggestion.id] = suggestion
        addedCount++
        console.log(`📦 STORE: Added suggestion with ID: ${suggestion.id}`)
      }
      
      console.log(`➕ Added suggestions: ${addedCount} added, ${dismissedCount} dismissed`)
      console.log(`📦 STORE: New store will have ${Object.keys(newById).length} suggestions`)
      
      set({
        byId: newById
      })
      
      console.log(`📦 STORE: Store update completed, triggering re-render`)
    },
    
    // Getters
    getAllSuggestions: () => {
      return Object.values(get().byId)
    },
    
    getSuggestionById: (id: string) => {
      return get().byId[id]
    },
    
    isDismissed: (id: string) => {
      return get().dismissed.has(id)
    },
    
    getDismissedIds: () => {
      return Array.from(get().dismissed)
    },
    
    // Utilities
    clearAll: () => {
      console.log('🗑️ Clearing all suggestions')
      set({
        byId: {},
        revision: 0
      })
    },
    
    getStats: () => {
      const state = get()
      const active = Object.keys(state.byId).length
      const dismissed = state.dismissed.size
      
      return {
        total: active + dismissed,
        dismissed,
        active
      }
    }
  }))
)

// Subscribe to dismissed changes to persist them
useSuggestStore.subscribe(
  (state) => state.dismissed,
  (dismissed) => {
    saveDismissedToStorage(dismissed)
  }
)

// Export utility functions for external use
export { generateDictionaryHash, getDismissedStorageKey } 