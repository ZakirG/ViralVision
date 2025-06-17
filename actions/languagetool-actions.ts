/*
<ai_context>
Server actions for LanguageTool integration in WordWise.
Handles grammar and spell checking via LanguageTool API.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, cacheLlmResponsesTable, documentVersionsTable } from "@/db/schema"
import type { Suggestion } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"
import { auth } from "@clerk/nextjs/server"
import { clerkUserIdToUuid } from "@/lib/clerk-to-uuid"
import { logGrammarCheckAction } from "./analytics-actions"

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

// Cache the LanguageTool response to avoid duplicate API calls
async function getCachedResponse(text: string): Promise<LanguageToolResponse | null> {
  try {
    const textHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const hashArray = Array.from(new Uint8Array(textHash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const cachedResponse = await db
      .select()
      .from(cacheLlmResponsesTable)
      .where(eq(cacheLlmResponsesTable.promptHash, `languagetool_${hashHex}`))
      .limit(1)

    if (cachedResponse.length > 0 && cachedResponse[0].response) {
      // Validate that the cached response has the expected structure
      const response = cachedResponse[0].response as any
      if (response && typeof response === 'object' && Array.isArray(response.matches)) {
        return response as LanguageToolResponse
      } else {
        console.warn("Invalid cached response structure, skipping cache")
        return null
      }
    }
  } catch (error) {
    console.error("Error getting cached response:", error)
  }
  
  return null
}

async function setCachedResponse(text: string, response: LanguageToolResponse): Promise<void> {
  try {
    const textHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const hashArray = Array.from(new Uint8Array(textHash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Validate response structure before caching
    if (!response || typeof response !== 'object' || !Array.isArray(response.matches)) {
      console.warn("Invalid response structure, not caching")
      return
    }

    await db
      .insert(cacheLlmResponsesTable)
      .values({
        promptHash: `languagetool_${hashHex}`,
        response: response
      })
      .onConflictDoNothing()
  } catch (error) {
    console.error("Error setting cached response:", error)
  }
}

export async function checkGrammarOnlyWithLanguageToolAction(
  text: string,
  documentId: string
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🔧 checkGrammarWithLanguageToolAction starting - text length:", text.length, "documentId:", documentId)
    
    const { userId } = await auth()
    console.log("🔧 Auth check - userId:", userId ? "✅" : "❌")
    
    if (!userId) {
      console.log("🔧 User not authenticated, returning error")
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    if (!text.trim()) {
      console.log("🔧 No text to check, returning success")
      return {
        isSuccess: true,
        message: "No text to check",
        data: []
      }
    }

    // Ensure document_versions entry exists (create if missing)
    console.log("🔧 Checking document version entry...")
    const existingVersion = await db
      .select()
      .from(documentVersionsTable)
      .where(
        and(
          eq(documentVersionsTable.documentId, documentId),
          eq(documentVersionsTable.versionNumber, 1)
        )
      )
      .limit(1)

    if (existingVersion.length === 0) {
      console.log("🔧 Creating missing document version entry...")
      // Create the missing document version entry
      await db
        .insert(documentVersionsTable)
        .values({
          documentId,
          versionNumber: 1,
          textSnapshot: text
        })
        .onConflictDoNothing()
      console.log("🔧 Document version entry created")
    } else {
      console.log("🔧 Document version entry exists")
    }

    // Check cache first
    console.log("🔧 Checking cache for response...")
    let languageToolResponse = await getCachedResponse(text)
    
    if (!languageToolResponse) {
      console.log("🔧 No cached response, calling LanguageTool API...")
      // Call LanguageTool API
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          language: 'en-US',
          enabledOnly: 'false'
        })
      })
      console.log("🔧 LanguageTool API response status:", response.status)

      if (!response.ok) {
        console.log("🔧 LanguageTool API error - status:", response.status)
        return {
          isSuccess: false,
          message: `LanguageTool API error: ${response.status}`
        }
      }

      try {
        console.log("🔧 Parsing LanguageTool API response...")
        const responseText = await response.text()
        languageToolResponse = JSON.parse(responseText) as LanguageToolResponse
        console.log("🔧 LanguageTool API response parsed, matches found:", languageToolResponse.matches?.length || 0)
        
        // Validate the API response structure
        if (!languageToolResponse || typeof languageToolResponse !== 'object' || !Array.isArray(languageToolResponse.matches)) {
          console.error('🔧 Invalid LanguageTool API response structure:', languageToolResponse)
          return {
            isSuccess: false,
            message: "Invalid response from grammar checking service"
          }
        }
      } catch (jsonError) {
        console.error('🔧 Failed to parse LanguageTool API response:', jsonError)
        return {
          isSuccess: false,
          message: "Failed to parse grammar checking response"
        }
      }
      
      // Cache the response (will validate again before caching)
      console.log("🔧 Caching LanguageTool response...")
      await setCachedResponse(text, languageToolResponse)
    } else {
      console.log("🔧 Using cached response with", languageToolResponse.matches?.length || 0, "matches")
    }

    const userUuid = clerkUserIdToUuid(userId)
    console.log("🔧 User UUID:", userUuid)
    
    // Get existing grammar suggestions only (not spelling)
    console.log("🔧 Fetching existing grammar suggestions for smart merge...")
    const existingSuggestions = await db
      .select()
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.suggestionType, 'grammar')
        )
      )
    
    console.log("🔧 Found", existingSuggestions.length, "existing active suggestions")
    
    // Track which existing suggestions are still valid (will be updated at the end)
    const validExistingSuggestionIds = new Set<string>()
    let suggestionsCreated = 0
    let suggestionsUpdated = 0

    // Process only grammar matches (exclude spelling/typos)
    const grammarMatches = languageToolResponse.matches.filter(match => 
      // Exclude spelling/typo matches - only real grammar issues
      !(match.rule.category.id === 'TYPOS' || 
        match.type.typeName === 'UnknownWord' ||
        (match.type.typeName === 'Other' && match.rule.category.name === 'Possible Typo'))
    )
    
    console.log("🔧 Processing", grammarMatches.length, "grammar matches out of", languageToolResponse.matches.length, "total matches")
    console.log("🔧 GRAMMAR FILTER DEBUG: Found these as grammar:", grammarMatches.map(m => m.type.typeName))
    for (const match of grammarMatches) {
      console.log("🔧 BASIC: Starting to process match:", match.offset, match.length)
      try {
        // Validate match structure
        if (!match || typeof match !== 'object' || 
            typeof match.offset !== 'number' || 
            typeof match.length !== 'number' ||
            !match.type || typeof match.type.typeName !== 'string' ||
            typeof match.message !== 'string') {
          console.warn('Skipping invalid match:', match)
          continue
        }

        // Extract the original text from the document that this suggestion is for
        const originalText = text.substring(match.offset, match.offset + match.length)
        const suggestedText = match.replacements && match.replacements[0] ? match.replacements[0].value : null

        // Categorization logic updated based on LanguageTool response analysis
        
        
        // DEBUG: Let's see all dismissed suggestions for this document first
        const allDismissedForDoc = await db
          .select()
          .from(suggestionsTable)
          .where(
            and(
              eq(suggestionsTable.documentId, documentId),
              eq(suggestionsTable.dismissed, true)
            )
          )
        
        
        
        
        // First try exact match (current logic)
        let existingDismissedSuggestion = await db
          .select()
          .from(suggestionsTable)
          .where(
            and(
              eq(suggestionsTable.documentId, documentId),
              eq(suggestionsTable.originalText, originalText),
              eq(suggestionsTable.suggestedText, suggestedText || ''),
              eq(suggestionsTable.dismissed, true)
            )
          )
          .limit(1)
        
        

        // If no exact match, check for dismissed suggestions in similar position range
        // This handles cases where text might have changed slightly
        if (existingDismissedSuggestion.length === 0) {
          
          
          const positionTolerance = 10 // Allow 10 character tolerance
          
          

          // Check if any dismissed suggestion overlaps with current position
          existingDismissedSuggestion = allDismissedForDoc.filter(dismissed => {
            if (dismissed.startOffset === null || dismissed.endOffset === null) {
              // console.log(`🔧 DUPLICATE DEBUG: Skipping dismissed suggestion ${dismissed.id} - null offsets`)
              return false
            }
            
            const currentStart = match.offset
            const currentEnd = match.offset + match.length
            const dismissedStart = dismissed.startOffset
            const dismissedEnd = dismissed.endOffset
            
            // Check for overlap or nearby position
            const hasOverlap = (currentStart < dismissedEnd + positionTolerance) && 
                              (currentEnd > dismissedStart - positionTolerance)
            
            // Also check if the original text is similar (to catch minor text changes)
            const isSimilarText = dismissed.originalText && 
                                 originalText.toLowerCase().trim() === dismissed.originalText.toLowerCase().trim()
            
            // Check if suggested text matches
            const isSameSuggestion = dismissed.suggestedText === suggestedText
            
            
            
            if (hasOverlap || isSimilarText || isSameSuggestion) {
              
              return true
            }
            return false
          })
        }

        
        if (existingDismissedSuggestion.length > 0) {
          continue
        }

        const suggestionType = 'grammar' // Only processing grammar in this function
        
        // Check if an existing suggestion matches this match (same position and content)
        const matchingExistingSuggestion = existingSuggestions.find(existing => 
          existing.startOffset === match.offset &&
          existing.endOffset === match.offset + match.length &&
          existing.originalText === originalText &&
          existing.suggestedText === suggestedText
        )
        
        if (matchingExistingSuggestion) {
          // This suggestion already exists and is still valid - mark it to keep
          validExistingSuggestionIds.add(matchingExistingSuggestion.id)
          console.log(`🔧 PRESERVING existing suggestion ${matchingExistingSuggestion.id} (position: ${match.offset}-${match.offset + match.length}) - text: "${originalText}" -> "${suggestedText}"`)
          
          // Optionally update explanation if it has changed
          if (matchingExistingSuggestion.explanation !== match.message) {
            await db
              .update(suggestionsTable)
              .set({ explanation: match.message })
              .where(eq(suggestionsTable.id, matchingExistingSuggestion.id))
            suggestionsUpdated++
            console.log(`🔧 Updated explanation for suggestion ${matchingExistingSuggestion.id}`)
          }
        } else {
          // Create new suggestion
          console.log(`🔧 NO MATCH found for position ${match.offset}-${match.offset + match.length}, text: "${originalText}" -> "${suggestedText}"`)
          console.log(`🔧 Available existing suggestions:`, existingSuggestions.map(s => ({
            id: s.id.substring(0, 8),
            startOffset: s.startOffset,
            endOffset: s.endOffset,
            originalText: s.originalText,
            suggestedText: s.suggestedText
          })))
          
          await db
            .insert(suggestionsTable)
            .values({
              documentId,
              versionNumber: 1, // Using version 1 since we're not doing versioning
              originalText: originalText, // Store the original text that this suggestion is for
              suggestedText: suggestedText,
              explanation: match.message,
              startOffset: match.offset,
              endOffset: match.offset + match.length,
              suggestionType: suggestionType as "grammar" | "spelling",
              confidence: "0.8", // Default confidence
              accepted: false
            })
          
          suggestionsCreated++
          console.log(`🔧 CREATED new suggestion ${suggestionsCreated} (position: ${match.offset}-${match.offset + match.length}) - text: "${originalText}" -> "${suggestedText}"`)
        }
      } catch (error) {
        console.error("Error storing suggestion:", error)
        // Continue with other suggestions even if one fails
      }
    }

    // Clean up existing suggestions that are no longer valid
    const obsoleteSuggestionIds = existingSuggestions
      .filter(existing => !validExistingSuggestionIds.has(existing.id))
      .map(existing => existing.id)
    
    let suggestionsDeleted = 0
    if (obsoleteSuggestionIds.length > 0) {
      console.log(`🔧 Removing ${obsoleteSuggestionIds.length} obsolete suggestions:`, obsoleteSuggestionIds)
      // Delete each obsolete suggestion specifically
      for (const obsoleteSuggestionId of obsoleteSuggestionIds) {
        try {
          await db
            .delete(suggestionsTable)
            .where(eq(suggestionsTable.id, obsoleteSuggestionId))
          suggestionsDeleted++
        } catch (error) {
          console.error(`🔧 Failed to delete obsolete suggestion ${obsoleteSuggestionId}:`, error)
        }
      }
      console.log(`🔧 Deleted ${suggestionsDeleted} obsolete suggestions`)
    } else {
      console.log("🔧 No obsolete suggestions to remove")
    }

    console.log(`🔧 Grammar check complete: ${suggestionsCreated} created, ${suggestionsUpdated} updated, ${suggestionsDeleted} deleted, ${validExistingSuggestionIds.size} preserved`)

    // Log analytics event for grammar check
    
    try {
      await logGrammarCheckAction(documentId, text.length, suggestionsCreated)
    
    } catch (error) {
      // console.error("🔧 Failed to log grammar check analytics:", error)
    }

    // Fetch only grammar suggestions
    
    const grammarSuggestions = await db
      .select()
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.suggestionType, 'grammar')
        )
      )

    
    return {
      isSuccess: true,
      message: `Grammar check completed. ${suggestionsCreated} grammar suggestions found.`,
      data: grammarSuggestions
    }

    } catch (error) {
    
    return {
      isSuccess: false,
      message: "Failed to check grammar"
    }
  }
}

// Backward compatibility function that combines both spell and AI grammar checking
export async function checkGrammarWithLanguageToolAction(
  text: string,
  documentId: string
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🔧🔤🤖 COMBINED FUNCTION CALLED: Running spell + AI grammar check...")
    console.log("🔧🔤🤖 Text being processed:", text)
    
    // Import the AI grammar function
    console.log("🔧🔤🤖 Importing OpenRouter grammar action...")
    const { checkGrammarWithOpenRouterAction } = await import("./openrouter-grammar-actions")
    console.log("🔧🔤🤖 OpenRouter function imported successfully")
    
    // Run both spell and AI grammar checks
    console.log("🔧🔤🤖 Starting parallel execution of spell and grammar checks...")
    const [spellResult, grammarResult] = await Promise.all([
      checkSpellingWithLanguageToolAction(text, documentId),
      checkGrammarWithOpenRouterAction(text, documentId)
    ])
    
    console.log("🔧🔤🤖 Spell result:", spellResult)
    console.log("🔧🔤🤖 Grammar result:", grammarResult)

    // Check if both were successful
    if (!spellResult.isSuccess || !grammarResult.isSuccess) {
      return {
        isSuccess: false,
        message: `Failed to complete checks. Spell: ${spellResult.message}, Grammar: ${grammarResult.message}`
      }
    }

    // Combine the results
    const combinedSuggestions = [
      ...(spellResult.data || []),
      ...(grammarResult.data || [])
    ]

    const totalSpelling = spellResult.data?.length || 0
    const totalGrammar = grammarResult.data?.length || 0

    return {
      isSuccess: true,
      message: `Combined check completed. ${totalSpelling} spelling + ${totalGrammar} AI grammar suggestions found.`,
      data: combinedSuggestions
    }
  } catch (error) {
    console.error("Combined spell+AI grammar check error:", error)
    return {
      isSuccess: false,
      message: "Failed to check spelling and grammar"
    }
  }
}

export async function checkSpellingWithLanguageToolAction(
  text: string,
  documentId: string,
  wordStartOffset?: number,
  wordEndOffset?: number
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🔤 checkSpellingWithLanguageToolAction starting - text length:", text.length, "wordOffset:", wordStartOffset, "-", wordEndOffset)
    
    const { userId } = await auth()
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    if (!text.trim()) {
      return {
        isSuccess: true,
        message: "No text to check",
        data: []
      }
    }

    // For spell checking, we can be more aggressive about using cache since spelling is more stable
    let languageToolResponse = await getCachedResponse(text)
    
    if (!languageToolResponse) {
      console.log("🔤 Calling LanguageTool API for spell check...")
      // Call LanguageTool API with spell-check optimized parameters
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          language: 'en-US',
          enabledOnly: 'false',
          // Optimize for spell checking - focus on spelling rules
          disabledRules: 'WHITESPACE_RULE,EN_QUOTES,DASH_RULE,WORD_CONTAINS_UNDERSCORE'
        })
      })

      if (!response.ok) {
        return {
          isSuccess: false,
          message: `LanguageTool API error: ${response.status}`
        }
      }

      const responseText = await response.text()
      languageToolResponse = JSON.parse(responseText) as LanguageToolResponse
      
      // Cache the response
      await setCachedResponse(text, languageToolResponse)
    }

    // Get existing spelling suggestions only
    const existingSpellingSuggestions = await db
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

    console.log("🔤 Found", existingSpellingSuggestions.length, "existing spelling suggestions")

    const validExistingSuggestionIds = new Set<string>()
    let suggestionsCreated = 0
    let suggestionsUpdated = 0

    // Process spelling matches now that we know the correct categorization

    // Process spelling matches (based on actual LanguageTool response structure)
    const spellingMatches = languageToolResponse.matches.filter(match => 
      // LanguageTool categorizes spelling errors as:
      // - typeName: 'UnknownWord' (misspelled words)
      // - typeName: 'Other' (capitalization, etc.) 
      // - categoryId: 'TYPOS' (all typos/spelling issues)
      match.rule.category.id === 'TYPOS' || 
      match.type.typeName === 'UnknownWord' ||
      (match.type.typeName === 'Other' && match.rule.category.name === 'Possible Typo')
    )

    console.log("🔤 Processing", spellingMatches.length, "spelling matches out of", languageToolResponse.matches.length, "total matches")
    console.log("🔤 SPELLING FILTER DEBUG: Found these as spelling:", spellingMatches.map(m => m.type.typeName))

    for (const match of spellingMatches) {
      try {
        const originalText = text.substring(match.offset, match.offset + match.length)
        const suggestedText = match.replacements && match.replacements[0] ? match.replacements[0].value : null

        // If word offsets are provided, only process spelling errors within that word range
        if (wordStartOffset !== undefined && wordEndOffset !== undefined) {
          const matchStart = match.offset
          const matchEnd = match.offset + match.length
          
          // Skip if this spelling error is not within the specified word range
          if (matchEnd < wordStartOffset || matchStart > wordEndOffset) {
            console.log(`🔤 Skipping spelling error outside word range: ${matchStart}-${matchEnd} not in ${wordStartOffset}-${wordEndOffset}`)
            continue
          }
        }

        // Check for dismissed suggestions (simplified for spelling)
        const existingDismissedSuggestion = await db
          .select()
          .from(suggestionsTable)
          .where(
            and(
              eq(suggestionsTable.documentId, documentId),
              eq(suggestionsTable.originalText, originalText),
              eq(suggestionsTable.suggestedText, suggestedText || ''),
              eq(suggestionsTable.dismissed, true),
              eq(suggestionsTable.suggestionType, 'spelling')
            )
          )
          .limit(1)

        if (existingDismissedSuggestion.length > 0) {
          continue
        }

        // Check if an existing spelling suggestion matches this match
        const matchingExistingSuggestion = existingSpellingSuggestions.find(existing => 
          existing.startOffset === match.offset &&
          existing.endOffset === match.offset + match.length &&
          existing.originalText === originalText &&
          existing.suggestedText === suggestedText
        )

        if (matchingExistingSuggestion) {
          validExistingSuggestionIds.add(matchingExistingSuggestion.id)
          console.log(`🔤 PRESERVING existing spelling suggestion ${matchingExistingSuggestion.id}`)
          
          if (matchingExistingSuggestion.explanation !== match.message) {
            await db
              .update(suggestionsTable)
              .set({ explanation: match.message })
              .where(eq(suggestionsTable.id, matchingExistingSuggestion.id))
            suggestionsUpdated++
          }
        } else {
          // Create new spelling suggestion
          await db
            .insert(suggestionsTable)
            .values({
              documentId,
              versionNumber: 1,
              originalText: originalText,
              suggestedText: suggestedText,
              explanation: match.message,
              startOffset: match.offset,
              endOffset: match.offset + match.length,
              suggestionType: 'spelling',
              confidence: "0.9", // Higher confidence for spelling
              accepted: false
            })
          
          suggestionsCreated++
          console.log(`🔤 CREATED new spelling suggestion ${suggestionsCreated}`)
        }
      } catch (error) {
        console.error("Error storing spelling suggestion:", error)
      }
    }

    // Clean up obsolete spelling suggestions only
    const obsoleteSpellingSuggestionIds = existingSpellingSuggestions
      .filter(existing => !validExistingSuggestionIds.has(existing.id))
      .map(existing => existing.id)

    let suggestionsDeleted = 0
    for (const obsoleteSuggestionId of obsoleteSpellingSuggestionIds) {
      try {
        await db
          .delete(suggestionsTable)
          .where(eq(suggestionsTable.id, obsoleteSuggestionId))
        suggestionsDeleted++
      } catch (error) {
        console.error(`🔤 Failed to delete obsolete spelling suggestion ${obsoleteSuggestionId}:`, error)
      }
    }

    console.log(`🔤 Spell check complete: ${suggestionsCreated} created, ${suggestionsUpdated} updated, ${suggestionsDeleted} deleted, ${validExistingSuggestionIds.size} preserved`)

    // Return only spelling suggestions
    const spellingSuggestions = await db
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
      message: `Spell check completed. ${suggestionsCreated} spelling suggestions found.`,
      data: spellingSuggestions
    }

  } catch (error) {
    console.error("Spell check error:", error)
    return {
      isSuccess: false,
      message: "Failed to check spelling"
    }
  }
} 