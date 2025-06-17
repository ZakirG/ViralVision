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

export async function checkGrammarWithLanguageToolAction(
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
    
    // Clear existing non-dismissed, unaccepted suggestions for this document before adding new ones
    // CRITICAL: Don't delete dismissed suggestions or we can't check for duplicates!
    console.log("🔧 Clearing existing suggestions (preserving dismissed ones)...")
    const deleteResult = await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false)  // ONLY delete non-dismissed suggestions
        )
      )
    console.log("🔧 Cleared existing suggestions (dismissed suggestions preserved)")
    
    let suggestionsCreated = 0

    // Store suggestions in database
    console.log("🔧 Processing", languageToolResponse.matches.length, "matches...")
    for (const match of languageToolResponse.matches) {
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
        
        console.log(`🔧 DUPLICATE CHECK: Processing suggestion for "${originalText}" -> "${suggestedText}"`)

        // Check if we already have a dismissed suggestion for this text/position
        console.log(`🔧 DUPLICATE CHECK: Querying for existing dismissed suggestion with originalText="${originalText}", suggestedText="${suggestedText}", documentId="${documentId}"`)
        
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
        
        console.log(`🔧 DUPLICATE DEBUG: Found ${allDismissedForDoc.length} total dismissed suggestions for document:`)
        allDismissedForDoc.forEach((dismissed, i) => {
          console.log(`🔧 DUPLICATE DEBUG: Dismissed ${i}:`, {
            id: dismissed.id,
            originalText: dismissed.originalText,
            suggestedText: dismissed.suggestedText,
            startOffset: dismissed.startOffset,
            endOffset: dismissed.endOffset
          })
        })
        
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
        
        console.log(`🔧 DUPLICATE DEBUG: Exact match query for originalText="${originalText}", suggestedText="${suggestedText}" returned ${existingDismissedSuggestion.length} results`)

        // If no exact match, check for dismissed suggestions in similar position range
        // This handles cases where text might have changed slightly
        if (existingDismissedSuggestion.length === 0) {
          console.log(`🔧 DUPLICATE CHECK: No exact match found, checking position-based duplicates...`)
          
          const positionTolerance = 10 // Allow 10 character tolerance
          
          console.log(`🔧 DUPLICATE DEBUG: Current match details:`, {
            originalText: originalText,
            suggestedText: suggestedText,
            startOffset: match.offset,
            endOffset: match.offset + match.length,
            matchType: match.type?.typeName
          })

          // Check if any dismissed suggestion overlaps with current position
          existingDismissedSuggestion = allDismissedForDoc.filter(dismissed => {
            if (dismissed.startOffset === null || dismissed.endOffset === null) {
              console.log(`🔧 DUPLICATE DEBUG: Skipping dismissed suggestion ${dismissed.id} - null offsets`)
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
            
            console.log(`🔧 DUPLICATE DEBUG: Checking dismissed suggestion ${dismissed.id}:`, {
              dismissedOriginal: dismissed.originalText,
              dismissedSuggested: dismissed.suggestedText,
              dismissedPosition: `${dismissedStart}-${dismissedEnd}`,
              currentOriginal: originalText,
              currentSuggested: suggestedText,
              currentPosition: `${currentStart}-${currentEnd}`,
              hasOverlap,
              isSimilarText,
              isSameSuggestion,
              shouldSkip: hasOverlap || isSimilarText || isSameSuggestion
            })
            
            if (hasOverlap || isSimilarText || isSameSuggestion) {
              console.log(`🔧 DUPLICATE CHECK: Found position-based match - will skip creating suggestion`)
              return true
            }
            return false
          })
        }

        console.log(`🔧 DUPLICATE CHECK: Found ${existingDismissedSuggestion.length} existing dismissed suggestions`)
        if (existingDismissedSuggestion.length > 0) {
          console.log(`🔧 DUPLICATE CHECK: Existing dismissed suggestion:`, existingDismissedSuggestion[0])
          console.log(`🔧 SKIP: Found existing dismissed suggestion for "${originalText}" -> "${suggestedText}", not creating duplicate`)
          continue
        } else {
          console.log(`🔧 DUPLICATE CHECK: No existing dismissed suggestion found, will create new one`)
        }

        const suggestionType = match.type.typeName.toLowerCase().includes('spell') ? 'spelling' : 'grammar'
        console.log(`🔧 Creating suggestion ${suggestionsCreated + 1}: ${suggestionType} - "${match.message}" at offset ${match.offset}-${match.offset + match.length}`)
        
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
        console.log(`🔧 Suggestion ${suggestionsCreated} created successfully`)
      } catch (error) {
        console.error("Error storing suggestion:", error)
        // Continue with other suggestions even if one fails
      }
    }

    // Log analytics event for grammar check
    console.log("🔧 Logging analytics event...")
    try {
      await logGrammarCheckAction(documentId, text.length, suggestionsCreated)
      console.log("🔧 Analytics event logged successfully")
    } catch (error) {
      console.error("🔧 Failed to log grammar check analytics:", error)
    }

    // Fetch the suggestions we just created to return them
    console.log("🔧 Fetching created suggestions to return...")
    const createdSuggestions = await db
      .select()
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false)  // Don't return dismissed suggestions
        )
      )

    console.log(`🔧 Grammar check completed successfully! Created ${suggestionsCreated} suggestions, returning ${createdSuggestions.length} suggestions`)
    return {
      isSuccess: true,
      message: `Grammar check completed. ${suggestionsCreated} suggestions found.`,
      data: createdSuggestions
    }

  } catch (error) {
    console.error("🔧 Error checking grammar with LanguageTool:", error)
    return {
      isSuccess: false,
      message: "Failed to check grammar"
    }
  }
} 