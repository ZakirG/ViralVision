/*
<ai_context>
Optimized LanguageTool actions for fast spelling suggestions in WordWise.
Focus on minimal database round-trips and instant user feedback.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, cacheLlmResponsesTable } from "@/db/schema"
import type { Suggestion } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"
import { auth } from "@clerk/nextjs/server"

interface LanguageToolMatch {
  message: string
  shortMessage: string
  offset: number
  length: number
  type: {
    typeName: string
  }
  rule: {
    id: string
    description: string
    category: {
      id: string
      name: string
    }
  }
  replacements: Array<{
    value: string
  }>
  context: {
    text: string
    offset: number
    length: number
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

// Optimized cache functions (simplified)
async function getSpellingCacheKey(text: string): Promise<string> {
  const textHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hashArray = Array.from(new Uint8Array(textHash))
  return `spell_${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`
}

async function getCachedSpellingResponse(text: string): Promise<LanguageToolResponse | null> {
  try {
    const cacheKey = await getSpellingCacheKey(text)
    const cached = await db
      .select()
      .from(cacheLlmResponsesTable)
      .where(eq(cacheLlmResponsesTable.promptHash, cacheKey))
      .limit(1)

    if (cached.length > 0 && cached[0].response) {
      const response = cached[0].response as any
      if (response && typeof response === 'object' && Array.isArray(response.matches)) {
        return response as LanguageToolResponse
      }
    }
  } catch (error) {
    console.error("Cache get error:", error)
  }
  return null
}

async function setCachedSpellingResponse(text: string, response: LanguageToolResponse): Promise<void> {
  try {
    const cacheKey = await getSpellingCacheKey(text)
    await db
      .insert(cacheLlmResponsesTable)
      .values({
        promptHash: cacheKey,
        response: response
      })
      .onConflictDoNothing()
  } catch (error) {
    console.error("Cache set error:", error)
  }
}

export async function checkSpellingOptimizedAction(
  text: string,
  documentId: string,
  wordStartOffset?: number,
  wordEndOffset?: number
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🚀 OPTIMIZED: Fast spell check starting - text length:", text.length)
    
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!text.trim()) {
      return { isSuccess: true, message: "No text to check", data: [] }
    }

    // STEP 1: Get cached response or call API (fastest path)
    let languageToolResponse = await getCachedSpellingResponse(text)
    
    if (!languageToolResponse) {
      console.log("🚀 OPTIMIZED: Calling LanguageTool API...")
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          text: text,
          language: 'en-US',
          enabledOnly: 'false',
          disabledRules: 'WHITESPACE_RULE,EN_QUOTES,DASH_RULE,WORD_CONTAINS_UNDERSCORE'
        })
      })

      if (!response.ok) {
        return { isSuccess: false, message: `LanguageTool API error: ${response.status}` }
      }

      languageToolResponse = JSON.parse(await response.text()) as LanguageToolResponse
      setCachedSpellingResponse(text, languageToolResponse) // Fire and forget
    }

    // STEP 2: Filter spelling matches efficiently
    const spellingMatches = languageToolResponse.matches.filter(match => 
      match.rule.category.id === 'TYPOS' || 
      match.type.typeName === 'UnknownWord' ||
      (match.type.typeName === 'Other' && match.rule.category.name === 'Possible Typo')
    )

    // Apply word range filter if provided
    const filteredMatches = wordStartOffset !== undefined && wordEndOffset !== undefined
      ? spellingMatches.filter(match => {
          const matchStart = match.offset
          const matchEnd = match.offset + match.length
          return !(matchEnd < wordStartOffset || matchStart > wordEndOffset)
        })
      : spellingMatches

    console.log("🚀 OPTIMIZED: Processing", filteredMatches.length, "spelling matches")

    if (filteredMatches.length === 0) {
      return { isSuccess: true, message: "No spelling errors found", data: [] }
    }

    // STEP 3: Batch database operations (single query for existing suggestions)
    const [existingSpellingSuggestions, allDismissedSuggestions] = await Promise.all([
      db.select().from(suggestionsTable).where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.suggestionType, 'spelling')
        )
      ),
      db.select().from(suggestionsTable).where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.dismissed, true),
          eq(suggestionsTable.suggestionType, 'spelling')
        )
      )
    ])

    console.log("🚀 OPTIMIZED: Found", existingSpellingSuggestions.length, "existing +", allDismissedSuggestions.length, "dismissed")

    // STEP 4: Process matches in memory (no database queries in loop)
    const validExistingSuggestionIds = new Set<string>()
    const newSuggestions: Array<typeof suggestionsTable.$inferInsert> = []

    for (const match of filteredMatches) {
      try {
        const originalText = text.substring(match.offset, match.offset + match.length)
        const suggestedText = match.replacements?.[0]?.value || null

        // Check if already dismissed (in memory)
        const isDismissed = allDismissedSuggestions.some(dismissed =>
          dismissed.originalText === originalText && 
          dismissed.suggestedText === suggestedText
        )

        if (isDismissed) continue

        // Check if already exists (in memory)
        const existing = existingSpellingSuggestions.find(existing => 
          existing.startOffset === match.offset &&
          existing.endOffset === match.offset + match.length &&
          existing.originalText === originalText &&
          existing.suggestedText === suggestedText
        )

        if (existing) {
          validExistingSuggestionIds.add(existing.id)
        } else {
          // Queue for batch insert
          newSuggestions.push({
            documentId,
            versionNumber: 1,
            originalText,
            suggestedText,
            explanation: match.message,
            startOffset: match.offset,
            endOffset: match.offset + match.length,
            suggestionType: 'spelling',
            confidence: "0.9",
            accepted: false
          })
        }
      } catch (error) {
        console.error("Error processing match:", error)
      }
    }

    // STEP 5: Batch database updates (minimal queries)
    const operations: Promise<any>[] = []

    // Batch insert new suggestions
    if (newSuggestions.length > 0) {
      operations.push(
        db.insert(suggestionsTable).values(newSuggestions)
      )
    }

    // Batch delete obsolete suggestions
    const obsoleteIds = existingSpellingSuggestions
      .filter(existing => !validExistingSuggestionIds.has(existing.id))
      .map(existing => existing.id)

    if (obsoleteIds.length > 0) {
      operations.push(
        db.delete(suggestionsTable).where(inArray(suggestionsTable.id, obsoleteIds))
      )
    }

    // Execute all operations in parallel
    await Promise.all(operations)

    console.log(`🚀 OPTIMIZED: Complete! ${newSuggestions.length} created, ${obsoleteIds.length} deleted, ${validExistingSuggestionIds.size} preserved`)

    // STEP 6: Return final suggestions (single query)
    const finalSuggestions = await db
      .select()
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.suggestionType, 'spelling')
        )
      )

    return {
      isSuccess: true,
      message: `Fast spell check complete. ${newSuggestions.length} new spelling suggestions.`,
      data: finalSuggestions
    }

  } catch (error) {
    console.error("🚀 OPTIMIZED: Spell check error:", error)
    return {
      isSuccess: false,
      message: "Failed to check spelling"
    }
  }
} 