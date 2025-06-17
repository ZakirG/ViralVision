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
    const whereConditions = versionNumber 
      ? and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.versionNumber, versionNumber)
        )
      : eq(suggestionsTable.documentId, documentId)

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