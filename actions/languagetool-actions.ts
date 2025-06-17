/*
<ai_context>
Server actions for LanguageTool integration in WordWise.
Handles grammar and spell checking via LanguageTool API.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, cacheLlmResponsesTable, documentVersionsTable } from "@/db/schema"
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
): Promise<ActionState<{ suggestionsCreated: number }>> {
  try {
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
        data: { suggestionsCreated: 0 }
      }
    }

    // Ensure document_versions entry exists (create if missing)
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
      // Create the missing document version entry
      await db
        .insert(documentVersionsTable)
        .values({
          documentId,
          versionNumber: 1,
          textSnapshot: text
        })
        .onConflictDoNothing()
    }

    // Check cache first
    let languageToolResponse = await getCachedResponse(text)
    
    if (!languageToolResponse) {
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

      if (!response.ok) {
        return {
          isSuccess: false,
          message: `LanguageTool API error: ${response.status}`
        }
      }

      try {
        const responseText = await response.text()
        languageToolResponse = JSON.parse(responseText) as LanguageToolResponse
        
        // Validate the API response structure
        if (!languageToolResponse || typeof languageToolResponse !== 'object' || !Array.isArray(languageToolResponse.matches)) {
          console.error('Invalid LanguageTool API response structure:', languageToolResponse)
          return {
            isSuccess: false,
            message: "Invalid response from grammar checking service"
          }
        }
      } catch (jsonError) {
        console.error('Failed to parse LanguageTool API response:', jsonError)
        return {
          isSuccess: false,
          message: "Failed to parse grammar checking response"
        }
      }
      
      // Cache the response (will validate again before caching)
      await setCachedResponse(text, languageToolResponse)
    }

    const userUuid = clerkUserIdToUuid(userId)
    
    // Clear existing unaccepted suggestions for this document before adding new ones
    await db
      .delete(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, 1),
          eq(suggestionsTable.accepted, false)
        )
      )
    
    let suggestionsCreated = 0

    // Store suggestions in database
    for (const match of languageToolResponse.matches) {
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

        const suggestionType = match.type.typeName.toLowerCase().includes('spell') ? 'spelling' : 'grammar'
        
        await db
          .insert(suggestionsTable)
          .values({
            documentId,
            versionNumber: 1, // Using version 1 since we're not doing versioning
            suggestedText: match.replacements && match.replacements[0] ? match.replacements[0].value : null,
            explanation: match.message,
            startOffset: match.offset,
            endOffset: match.offset + match.length,
            suggestionType: suggestionType as "grammar" | "spelling",
            confidence: "0.8", // Default confidence
            accepted: false
          })
        
        suggestionsCreated++
      } catch (error) {
        console.error("Error storing suggestion:", error)
        // Continue with other suggestions even if one fails
      }
    }

    // Log analytics event for grammar check
    try {
      await logGrammarCheckAction(documentId, text.length, suggestionsCreated)
    } catch (error) {
      console.error("Failed to log grammar check analytics:", error)
    }

    return {
      isSuccess: true,
      message: `Grammar check completed. ${suggestionsCreated} suggestions found.`,
      data: { suggestionsCreated }
    }

  } catch (error) {
    console.error("Error checking grammar with LanguageTool:", error)
    return {
      isSuccess: false,
      message: "Failed to check grammar"
    }
  }
} 