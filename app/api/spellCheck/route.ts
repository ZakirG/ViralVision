/*
<ai_context>
Efficient spell checking API route for WordWise.
Uses LanguageTool for accurate spelling suggestions with caching.
Integrates with idle detection system for minimal API calls.
</ai_context>
*/

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

interface SpellCheckRequest {
  text: string
  dismissedIds: string[]
  revision: number
}

interface SpellingSuggestion {
  id: string
  originalText: string
  suggestedText: string
  explanation: string
  startOffset: number
  endOffset: number
  confidence: number
  suggestionType: 'spelling'
}

interface LanguageToolMatch {
  message: string
  offset: number
  length: number
  type: {
    typeName: string
  }
  rule: {
    id: string
    category: {
      id: string
      name: string
    }
  }
  replacements: Array<{
    value: string
  }>
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

// Call LanguageTool API with optimized settings for spelling
async function callLanguageToolSpelling(text: string): Promise<SpellingSuggestion[]> {
  try {
    console.log("📝 Calling LanguageTool API for spelling check...")

    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text: text,
        language: 'en-US',
        enabledOnly: 'false',
        // Disable non-spelling rules for faster response
        disabledRules: 'WHITESPACE_RULE,EN_QUOTES,DASH_RULE,WORD_CONTAINS_UNDERSCORE'
      })
    })

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.status}`)
    }

    const languageToolResponse: LanguageToolResponse = await response.json()
    
    // Filter for spelling errors only
    const spellingMatches = languageToolResponse.matches.filter(match => 
      match.rule.category.id === 'TYPOS' || 
      match.type.typeName === 'UnknownWord' ||
      (match.type.typeName === 'Other' && match.rule.category.name === 'Possible Typo')
    )

    console.log(`📝 Found ${spellingMatches.length} spelling errors out of ${languageToolResponse.matches.length} total matches`)

    // Convert to our format
    const suggestions: SpellingSuggestion[] = []
    
    for (const match of spellingMatches) {
      const originalText = text.substring(match.offset, match.offset + match.length)
      const suggestedText = match.replacements?.[0]?.value

      if (!suggestedText) continue

      // Skip very short words that might be incomplete
      if (originalText.length < 2) continue

      // Check if word appears incomplete (letters before/after)
      const beforeChar = match.offset > 0 ? text[match.offset - 1] : ' '
      const afterChar = match.offset + match.length < text.length ? text[match.offset + match.length] : ' '
      
      const isIncompleteWord = /[a-zA-Z]/.test(beforeChar) || /[a-zA-Z]/.test(afterChar)
      if (isIncompleteWord && originalText.length < 4) {
        console.log(`📝 Skipping potentially incomplete word: "${originalText}"`)
        continue
      }

      suggestions.push({
        id: `spell_${match.offset}_${match.offset + match.length}_${Date.now()}`,
        originalText,
        suggestedText,
        explanation: match.message,
        startOffset: match.offset,
        endOffset: match.offset + match.length,
        confidence: 0.9,
        suggestionType: 'spelling'
      })
    }

    return suggestions

  } catch (error) {
    console.error("📝 LanguageTool API error:", error)
    return []
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SpellCheckRequest = await request.json()
    const { text, dismissedIds, revision } = body

    if (!text?.trim()) {
      return NextResponse.json({ suggestions: [], revision })
    }

    console.log(`📝 Spell Check API: Processing ${text.length} chars, revision ${revision}`)
    console.log(`📝 Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`)

    // Get spelling suggestions from LanguageTool
    const apiStartTime = Date.now()
    const suggestions = await callLanguageToolSpelling(text)
    const apiEndTime = Date.now()

    console.log(`📝 LanguageTool API took ${apiEndTime - apiStartTime}ms`)

    // Filter out dismissed suggestions
    const filteredSuggestions = suggestions.filter(s => 
      !dismissedIds.includes(s.id)
    )

    const totalTime = Date.now() - startTime
    console.log(`📝 Spell Check API: Found ${suggestions.length} suggestions, ${filteredSuggestions.length} after filtering`)
    console.log(`📝 Total API response time: ${totalTime}ms`)

    if (filteredSuggestions.length > 0) {
      console.log(`📝 Suggestions found:`, filteredSuggestions.map(s => `"${s.originalText}" → "${s.suggestedText}"`))
    }

    return NextResponse.json({
      suggestions: filteredSuggestions,
      revision
    })

  } catch (error) {
    console.error("📝 Spell Check API error:", error)
    return NextResponse.json(
      { error: 'Spell check failed' },
      { status: 500 }
    )
  }
} 