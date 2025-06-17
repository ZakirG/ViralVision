/*
<ai_context>
Database actions for suggestions in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, type Suggestion, type NewSuggestion } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
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
    console.log("🔍 DISMISSAL DEBUG: getSuggestionsByDocumentIdAction called for docId:", documentId, "version:", versionNumber)
    
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

    console.log("🔍 DISMISSAL DEBUG: Filtering with dismissed=false and accepted=false")

    const suggestions = await db
      .select()
      .from(suggestionsTable)
      .where(whereConditions)
      .orderBy(desc(suggestionsTable.createdAt))

    console.log("🔍 DISMISSAL DEBUG: Query returned", suggestions.length, "suggestions")
    suggestions.forEach((s, i) => {
      console.log(`🔍 DISMISSAL DEBUG: DB Result ${i}:`, {
        id: s.id,
        text: s.suggestedText,
        dismissed: s.dismissed,
        accepted: s.accepted
      })
    })

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
    const [updatedSuggestion] = await db
      .update(suggestionsTable)
      .set({ accepted: true })
      .where(eq(suggestionsTable.id, suggestionId))
      .returning()

    if (!updatedSuggestion) {
      return {
        isSuccess: false,
        message: "Suggestion not found"
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
    console.log("🔍 DISMISSAL DEBUG: dismissSuggestionAction called for suggestionId:", suggestionId)
    
    // First get the suggestion to extract originalText if it's missing
    const [existingSuggestion] = await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.id, suggestionId))
      .limit(1)
    
    if (!existingSuggestion) {
      console.log("🔍 DISMISSAL DEBUG: Suggestion not found in database for id:", suggestionId)
      return {
        isSuccess: false,
        message: "Suggestion not found"
      }
    }
    
    // If originalText is missing and we have document content and offsets, populate it
    let originalText = existingSuggestion.originalText
    if (!originalText && documentContent && existingSuggestion.startOffset !== null && existingSuggestion.endOffset !== null) {
      originalText = documentContent.substring(existingSuggestion.startOffset, existingSuggestion.endOffset)
      console.log("🔍 DISMISSAL DEBUG: Populated missing originalText:", originalText)
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
      console.log("🔍 DISMISSAL DEBUG: Suggestion not found in database for id:", suggestionId)
      return {
        isSuccess: false,
        message: "Suggestion not found"
      }
    }

    console.log("🔍 DISMISSAL DEBUG: Suggestion successfully dismissed:", {
      id: updatedSuggestion.id,
      text: updatedSuggestion.suggestedText,
      originalText: updatedSuggestion.originalText,
      dismissed: updatedSuggestion.dismissed
    })

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