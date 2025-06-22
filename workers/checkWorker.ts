import { expose } from 'comlink'
import { nanoid } from 'nanoid'
import { loadModule } from 'hunspell-asm'
import writeGood from 'write-good'

export interface Path {
  path: number[]
  offset: number
}

export interface Suggestion {
  id: string
  rule: string
  message: string
  path: Path
  offset: number
  length: number
  original: string
  suggestions: string[] // Array of suggested replacements
}

// Hunspell instance - initialized once
let hunspell: any = null
let isInitialized = false

// Initialize Hunspell with dictionary files
async function initializeHunspell() {
  if (isInitialized) return hunspell

  try {
    console.log('🔧 Initializing Hunspell...')
    
    // Fetch dictionary files
    const [affResponse, dicResponse] = await Promise.all([
      fetch('/dict/en_US.aff'),
      fetch('/dict/en_US.dic')
    ])

    if (!affResponse.ok || !dicResponse.ok) {
      throw new Error('Failed to fetch dictionary files')
    }

    const [affBuffer, dicBuffer] = await Promise.all([
      affResponse.arrayBuffer(),
      dicResponse.arrayBuffer()
    ])

    // Initialize Hunspell factory
    const hunspellFactory = await loadModule()
    
    // Mount dictionary files
    const affPath = hunspellFactory.mountBuffer(new Uint8Array(affBuffer), 'en_US.aff')
    const dicPath = hunspellFactory.mountBuffer(new Uint8Array(dicBuffer), 'en_US.dic')
    
    // Create hunspell instance
    hunspell = hunspellFactory.create(affPath, dicPath)
    
    isInitialized = true
    console.log('✅ Hunspell initialized successfully')
    
    return hunspell
  } catch (error) {
    console.error('❌ Failed to initialize Hunspell:', error)
    throw error
  }
}

// Real implementation for spell checking using Hunspell
async function spell(word: string, lang: 'en_US'): Promise<Suggestion[]> {
  try {
    // Initialize Hunspell if not already done
    if (!isInitialized) {
      await initializeHunspell()
    }

    if (!hunspell) {
      console.error('Hunspell not initialized')
      return []
    }

    // Check if word is spelled correctly
    const isCorrect = hunspell.spell(word)
    
    if (isCorrect) {
      // Word is spelled correctly
      return []
    }

    // Word is misspelled, create a suggestion with Hunspell suggestions
    const hunspellSuggestions = hunspell.suggest(word)

    return [
      {
        id: nanoid(),
        rule: 'MISSPELL',
        message: 'Possible misspelling',
        path: { path: [0], offset: 0 },
        offset: 0,
        length: word.length,
        original: word,
        suggestions: hunspellSuggestions // Include actual Hunspell suggestions
      }
    ]
  } catch (error) {
    console.error('Error in spell check:', error)
    return []
  }
}

// Real implementation for grammar checking using write-good
async function grammar(text: string): Promise<Suggestion[]> {
  try {
    // Use write-good to analyze the text
    const issues = writeGood(text)
    
    // Map write-good results to Suggestion objects, limited to 50
    const suggestions = issues.slice(0, 50).map((issue: any) => ({
      id: nanoid(),
      rule: issue.reason,
      message: issue.suggestion || issue.reason,
      path: { path: [0], offset: 0 }, // Placeholder for now
      offset: issue.index,
      length: issue.offset,
      original: text.substring(issue.index, issue.index + issue.offset),
      suggestions: issue.suggestion ? [issue.suggestion] : []
    }))
    
    return suggestions
  } catch (error) {
    console.error('Error in grammar check:', error)
    return []
  }
}

const api = {
  spell,
  grammar
}

export type WorkerAPI = typeof api

// Expose the API to the main thread
expose(api) 