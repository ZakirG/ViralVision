/*
<ai_context>
Database actions for suggestions in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, type Suggestion, type NewSuggestion } from "@/db/schema"
import { eq, and, desc, inArray } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"

export async function createSuggestionAction(
  suggestion: NewSuggestion
): Promise<ActionState<Suggestion>> {
  try {
    const [newSuggestion] = await db
      .insert(suggestionsTable)
      .values(suggestion)
      .returning()

    return {
      isSuccess: true,
      message: "Suggestion created successfully",
      data: newSuggestion
    }
  } catch (error) {
    console.error("Error creating suggestion:", error)
    return {
      isSuccess: false,
      message: "Failed to create suggestion"
    }
  }
}

export async function getSuggestionsByDocumentIdAction(
  documentId: string,
  versionNumber?: number
): Promise<ActionState<Suggestion[]>> {
  try {
    
    
    const whereConditions = versionNumber 
      ? and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, versionNumber),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.accepted, false)
        )
      : and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.dismissed, false),
          eq(suggestionsTable.accepted, false)
        )

    

    const suggestions = await db
      .select()
      .from(suggestionsTable)
      .where(whereConditions)
      .orderBy(desc(suggestionsTable.createdAt))

    

    return {
      isSuccess: true,
      message: "Suggestions retrieved successfully",
      data: suggestions
    }
  } catch (error) {
    console.error("Error getting suggestions:", error)
    return {
      isSuccess: false,
      message: "Failed to get suggestions"
    }
  }
}

export async function acceptSuggestionAction(
  suggestionId: string
): Promise<ActionState<Suggestion>> {
  try {
    // First check if the suggestion exists and its current state
    const existingSuggestion = await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.id, suggestionId))
      .limit(1)

    if (existingSuggestion.length === 0) {
      console.error("Suggestion not found in database:", suggestionId)
      return {
        isSuccess: false,
        message: "Suggestion not found. It may have been updated by a recent grammar check. Please refresh and try again."
      }
    }

    const suggestion = existingSuggestion[0]
    
    if (suggestion.accepted) {
      return {
        isSuccess: false,
        message: "Suggestion has already been accepted"
      }
    }

    if (suggestion.dismissed) {
      return {
        isSuccess: false,
        message: "Suggestion has already been dismissed"
      }
    }

    // Now update the suggestion
    const [updatedSuggestion] = await db
      .update(suggestionsTable)
      .set({ accepted: true })
      .where(eq(suggestionsTable.id, suggestionId))
      .returning()

    if (!updatedSuggestion) {
      return {
        isSuccess: false,
        message: "Failed to update suggestion"
      }
    }

    return {
      isSuccess: true,
      message: "Suggestion accepted successfully",
      data: updatedSuggestion
    }
  } catch (error) {
    console.error("Error accepting suggestion:", error)
    return {
      isSuccess: false,
      message: "Failed to accept suggestion"
    }
  }
}

export async function dismissSuggestionAction(
  suggestionId: string,
  documentContent?: string
): Promise<ActionState<Suggestion>> {
  try {
    // // // // console.log("🔍 DISMISSAL DEBUG: dismissSuggestionAction called for suggestionId:", suggestionId)
    
    // First get the suggestion to extract originalText if it's missing
    const [existingSuggestion] = await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.id, suggestionId))
      .limit(1)
    
    if (!existingSuggestion) {
      // // // // console.log("🔍 DISMISSAL DEBUG: Suggestion not found in database for id:", suggestionId)
      return {
        isSuccess: false,
        message: "Suggestion not found"
      }
    }
    
    // If originalText is missing and we have document content and offsets, populate it
    let originalText = existingSuggestion.originalText
    
    
    if (!originalText && documentContent && existingSuggestion.startOffset !== null && existingSuggestion.endOffset !== null) {
      originalText = documentContent.substring(existingSuggestion.startOffset, existingSuggestion.endOffset)
      // // // // console.log("🔍 DISMISSAL DEBUG: Populated missing originalText from document content:", originalText)
    } else if (originalText) {
      // // // // console.log("🔍 DISMISSAL DEBUG: Using existing originalText:", originalText)
    } else {
      // // // console.log("🔍 DISMISSAL DEBUG: No originalText available - missing document content or offsets")
    }
    
    const [updatedSuggestion] = await db
      .update(suggestionsTable)
      .set({ 
        dismissed: true,
        originalText: originalText || existingSuggestion.originalText
      })
      .where(eq(suggestionsTable.id, suggestionId))
      .returning()

    if (!updatedSuggestion) {
      // // // console.log("🔍 DISMISSAL DEBUG: Suggestion not found in database for id:", suggestionId)
      return {
        isSuccess: false,
        message: "Suggestion not found"
      }
    }

    

    return {
      isSuccess: true,
      message: "Suggestion dismissed successfully",
      data: updatedSuggestion
    }
  } catch (error) {
    console.error("Error dismissing suggestion:", error)
    return {
      isSuccess: false,
      message: "Failed to dismiss suggestion"
    }
  }
}

export async function dismissAllActiveSuggestionsAction(
  documentId: string
): Promise<ActionState<{ dismissedCount: number }>> {
  try {
    console.log("🧹 DISMISS ALL: Dismissing all active suggestions for document:", documentId)
    
    // Update all non-accepted, non-dismissed suggestions to dismissed
    const result = await db
      .update(suggestionsTable)
      .set({ dismissed: true })
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false)
        )
      )
      .returning({ id: suggestionsTable.id })

    const dismissedCount = result.length
    console.log("🧹 DISMISS ALL: Dismissed", dismissedCount, "suggestions")

    return {
      isSuccess: true,
      message: `Dismissed ${dismissedCount} active suggestions`,
      data: { dismissedCount }
    }
  } catch (error) {
    console.error("Error dismissing all suggestions:", error)
    return {
      isSuccess: false,
      message: "Failed to dismiss all suggestions"
    }
  }
}

export async function getSuggestionByIdAction(
  suggestionId: string
): Promise<ActionState<Suggestion>> {
  try {
    const [suggestion] = await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.id, suggestionId))

    if (!suggestion) {
      return {
        isSuccess: false,
        message: "Suggestion not found"
      }
    }

    return {
      isSuccess: true,
      message: "Suggestion retrieved successfully",
      data: suggestion
    }
  } catch (error) {
    console.error("Error getting suggestion:", error)
    return {
      isSuccess: false,
      message: "Failed to get suggestion"
    }
  }
}

export async function deleteSuggestionsByIdsAction(
  suggestionIds: string[]
): Promise<ActionState<{ deletedCount: number }>> {
  try {
    if (suggestionIds.length === 0) {
      return {
        isSuccess: true,
        message: "No suggestions to delete",
        data: { deletedCount: 0 }
      }
    }

    console.log("🧹 DELETE: Attempting to delete", suggestionIds.length, "stale suggestions by IDs:", suggestionIds.map(id => id.substring(0, 8)))
    
    // First check what suggestions actually exist with these IDs
    const existingBeforeDelete = await db
      .select()
      .from(suggestionsTable)
      .where(inArray(suggestionsTable.id, suggestionIds))
    
    console.log("🧹 DELETE: Found", existingBeforeDelete.length, "existing suggestions in database before delete:")
    existingBeforeDelete.forEach(s => {
      console.log(`  - ${s.id.substring(0, 8)}: "${s.originalText}" -> "${s.suggestedText}" (${s.startOffset}-${s.endOffset}) [${s.suggestionType}] dismissed=${s.dismissed} accepted=${s.accepted}`)
    })
    
    // Delete all suggestions with the provided IDs
    const result = await db
      .delete(suggestionsTable)
      .where(inArray(suggestionsTable.id, suggestionIds))
      .returning({ id: suggestionsTable.id })

    const deletedCount = result.length
    console.log("🧹 DELETE: Actually deleted", deletedCount, "suggestions:", result.map(r => r.id.substring(0, 8)))
    
    // Verify they're gone
    const existingAfterDelete = await db
      .select()
      .from(suggestionsTable)
      .where(inArray(suggestionsTable.id, suggestionIds))
    
    console.log("🧹 DELETE: Remaining suggestions after delete:", existingAfterDelete.length)

    return {
      isSuccess: true,
      message: `Deleted ${deletedCount} stale suggestions`,
      data: { deletedCount }
    }
  } catch (error) {
    console.error("🧹 DELETE: Error deleting suggestions by IDs:", error)
    return {
      isSuccess: false,
      message: "Failed to delete stale suggestions"
    }
  }
} 