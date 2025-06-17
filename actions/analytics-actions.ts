/*
<ai_context>
Analytics actions for tracking user events in WordWise.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { analyticsEventsTable } from "@/db/schema"
import type { ActionState } from "@/types/server-action-types"
import { auth } from "@clerk/nextjs/server"
import { clerkUserIdToUuid } from "@/lib/clerk-to-uuid"

interface AnalyticsEventData {
  eventType: string
  eventData?: Record<string, any>
  sessionId?: string
  userAgent?: string
}

export async function logAnalyticsEventAction(
  eventData: AnalyticsEventData
): Promise<ActionState<{ success: boolean }>> {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      // Skip logging for anonymous users since userId is required
      console.log("Skipping analytics event for anonymous user:", eventData)
      return {
        isSuccess: true,
        message: "Analytics event skipped (anonymous user)",
        data: { success: true }
      }
    }

    const userUuid = clerkUserIdToUuid(userId)

    await db
      .insert(analyticsEventsTable)
      .values({
        userId: userUuid,
        eventType: eventData.eventType as "suggestion_accepted" | "suggestion_rejected" | "document_created" | "hook_generated",
        metadata: {
          ...eventData.eventData,
          sessionId: eventData.sessionId,
          userAgent: eventData.userAgent
        }
      })

    return {
      isSuccess: true,
      message: "Analytics event logged successfully",
      data: { success: true }
    }
  } catch (error) {
    console.error("Error logging analytics event:", error)
    return {
      isSuccess: false,
      message: "Failed to log analytics event"
    }
  }
}

// Convenience functions for common events
export async function logSuggestionAcceptedAction(
  suggestionId: string,
  suggestionType: string,
  documentId: string
): Promise<ActionState<{ success: boolean }>> {
  return logAnalyticsEventAction({
    eventType: 'suggestion_accepted',
    eventData: {
      suggestionId,
      suggestionType,
      documentId,
      timestamp: new Date().toISOString()
    }
  })
}

export async function logSuggestionRejectedAction(
  suggestionId: string,
  suggestionType: string,
  documentId: string
): Promise<ActionState<{ success: boolean }>> {
  return logAnalyticsEventAction({
    eventType: 'suggestion_rejected',
    eventData: {
      suggestionId,
      suggestionType,
      documentId,
      timestamp: new Date().toISOString()
    }
  })
}

export async function logFeatureUsageAction(
  featureName: string,
  documentId?: string,
  additionalData?: Record<string, any>
): Promise<ActionState<{ success: boolean }>> {
  return logAnalyticsEventAction({
    eventType: 'hook_generated', // Using existing enum value for feature usage
    eventData: {
      featureName,
      documentId,
      timestamp: new Date().toISOString(),
      ...additionalData
    }
  })
}

export async function logDocumentCreatedAction(
  documentId: string,
  contentType: string,
  audienceLevel: string
): Promise<ActionState<{ success: boolean }>> {
  return logAnalyticsEventAction({
    eventType: 'document_created',
    eventData: {
      documentId,
      contentType,
      audienceLevel,
      timestamp: new Date().toISOString()
    }
  })
}

export async function logGrammarCheckAction(
  documentId: string,
  textLength: number,
  suggestionsFound: number
): Promise<ActionState<{ success: boolean }>> {
  return logAnalyticsEventAction({
    eventType: 'hook_generated', // Using existing enum value for feature events
    eventData: {
      featureName: 'grammar_check',
      documentId,
      textLength,
      suggestionsFound,
      timestamp: new Date().toISOString()
    }
  })
} 