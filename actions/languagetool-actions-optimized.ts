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
    console.log("🚀 OPTIMIZED: Input text:", `"${text}"`)
    console.log("🚀 OPTIMIZED: Document ID:", documentId)
    console.log("🚀 OPTIMIZED: Word range filter:", wordStartOffset, "to", wordEndOffset)
    
    const { userId } = await auth()
    if (!userId) {
      return { isSuccess: false, message: "User not authenticated" }
    }

    if (!text.trim()) {
      return { isSuccess: true, message: "No text to check", data: [] }
    }

    // STEP 1: Get cached response or call API (fastest path)
    let languageToolResponse = await getCachedSpellingResponse(text)
    let wasFromCache = false
    
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
    } else {
      console.log("🚀 OPTIMIZED: Using cached LanguageTool response")
      wasFromCache = true
    }

    // ALWAYS log the response for debugging (even cached ones)
    console.log("🚀 OPTIMIZED: LanguageTool response (cached=" + wasFromCache + "):", JSON.stringify(languageToolResponse, null, 2))

    // STEP 2: Filter spelling matches efficiently
    const allMatches = languageToolResponse.matches
    console.log("🚀 OPTIMIZED: Total matches from LanguageTool:", allMatches.length)
    allMatches.forEach((match, index) => {
      const matchText = text.substring(match.offset, match.offset + match.length)
      console.log(`  ${index + 1}. Match "${matchText}" (${match.offset}-${match.offset + match.length}) - Category: ${match.rule.category.id}, Type: ${match.type.typeName}, Rule: ${match.rule.id}`)
      console.log(`     → Message: ${match.message}`)
      console.log(`     → Replacements: ${match.replacements?.map(r => r.value).join(', ') || 'none'}`)
    })

    // const spellingMatches = languageToolResponse.matches.filter(match => 
    //   match.rule.category.id === 'TYPOS' || 
    //   match.type.typeName === 'UnknownWord' ||
    //   (match.type.typeName === 'Other' && match.rule.category.name === 'Possible Typo')
    // )

    const spellingMatches = languageToolResponse.matches;

    console.log("🚀 OPTIMIZED: Filtered spelling matches:", spellingMatches.length)
    spellingMatches.forEach((match, index) => {
      const matchText = text.substring(match.offset, match.offset + match.length)
      console.log(`  ${index + 1}. Spelling match "${matchText}" (${match.offset}-${match.offset + match.length}) - Message: ${match.message}`)
    })

    // Apply word range filter if provided
    const filteredMatches = wordStartOffset !== undefined && wordEndOffset !== undefined
      ? spellingMatches.filter(match => {
          const matchStart = match.offset
          const matchEnd = match.offset + match.length
          return !(matchEnd < wordStartOffset || matchStart > wordEndOffset)
        })
      : spellingMatches

    console.log("🚀 OPTIMIZED: After range filtering:", filteredMatches.length, "matches")

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

        console.log(`🚀 OPTIMIZED: Processing match "${originalText}" (${match.offset}-${match.offset + match.length}) -> "${suggestedText}"`)

        // ENHANCED VALIDATION: Skip suggestions for incomplete words
        if (originalText.length < 2) {
          console.log("🚀 OPTIMIZED: Skipping very short word:", originalText)
          continue
        }

        // Check if this appears to be a partial word by looking at surrounding characters
        const beforeChar = match.offset > 0 ? text[match.offset - 1] : ' '
        const afterChar = match.offset + match.length < text.length ? text[match.offset + match.length] : ' '
        
        console.log(`🚀 OPTIMIZED: Context check for "${originalText}": before="${beforeChar}" after="${afterChar}"`)
        
        // Skip if the word appears to be incomplete (no spaces around it and it's short)
        const isIncompleteWord = /[a-zA-Z]/.test(beforeChar) || /[a-zA-Z]/.test(afterChar)
        if (isIncompleteWord && originalText.length < 4) {
          console.log("🚀 OPTIMIZED: Skipping potentially incomplete word:", originalText, {
            beforeChar,
            afterChar,
            length: originalText.length
          })
          continue
        }

        // Check if already dismissed (in memory)
        const isDismissed = allDismissedSuggestions.some(dismissed =>
          dismissed.originalText === originalText && 
          dismissed.suggestedText === suggestedText
        )

        if (isDismissed) {
          console.log("🚀 OPTIMIZED: Skipping dismissed suggestion:", originalText)
          continue
        }

        // Check if already exists (in memory)
        const existing = existingSpellingSuggestions.find(existing => 
          existing.startOffset === match.offset &&
          existing.endOffset === match.offset + match.length &&
          existing.originalText === originalText &&
          existing.suggestedText === suggestedText
        )

        if (existing) {
          console.log("🚀 OPTIMIZED: Found existing suggestion:", existing.id.substring(0, 8))
          validExistingSuggestionIds.add(existing.id)
        } else {
          console.log("🚀 OPTIMIZED: Creating new suggestion for:", originalText, "->", suggestedText)
          
          // CRITICAL DEBUG: Validate offsets before storing
          const validationText = text.substring(match.offset, match.offset + match.length)
          if (validationText !== originalText) {
            console.error("🚨 OFFSET MISMATCH DETECTED DURING CREATION!")
            console.error("  Expected (from LanguageTool):", originalText)
            console.error("  Actual (from our offset):", validationText)
            console.error("  LanguageTool offset:", match.offset, "-", match.offset + match.length)
            console.error("  Full text:", `"${text}"`)
            console.error("  Text length:", text.length)
            console.error("  Context around offset:")
            const contextStart = Math.max(0, match.offset - 10)
            const contextEnd = Math.min(text.length, match.offset + match.length + 10)
            console.error("    ", `"${text.substring(contextStart, contextEnd)}"`)
            console.error("    ", " ".repeat(match.offset - contextStart) + "^".repeat(match.length))
            
            // Skip this suggestion since it has invalid offsets
            continue
          }
          
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
          
          console.log("🚀 OPTIMIZED: ✅ Validated and queued suggestion:", {
            originalText,
            suggestedText,
            offsets: `${match.offset}-${match.offset + match.length}`,
            validationText
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