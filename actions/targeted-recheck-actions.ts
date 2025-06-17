/*
<ai_context>
Targeted document rechecking actions for WordWise that only affects overlapping suggestions.
Used after suggestions are accepted to surgically update only the affected text areas.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable, type Suggestion } from "@/db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { checkSpellingWithLanguageToolAction } from "./languagetool-actions"
import { checkGrammarWithOpenAIAction } from "./openai-grammar-actions"
import type { ActionState } from "@/types/server-action-types"

interface TextSegment {
  startOffset: number
  endOffset: number
  text: string
}

export async function findOverlappingSuggestionsAction(
  documentId: string,
  acceptedSuggestionStart: number,
  acceptedSuggestionEnd: number,
  expandRange: number = 50 // Expand range by 50 characters on each side
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🎯🔍 OVERLAP: Finding overlapping suggestions for range:", {
      start: acceptedSuggestionStart,
      end: acceptedSuggestionEnd,
      expandRange
    })
    
    // Expand the range to catch suggestions that might be affected
    const expandedStart = Math.max(0, acceptedSuggestionStart - expandRange)
    const expandedEnd = acceptedSuggestionEnd + expandRange
    
    console.log("🎯🔍 OVERLAP: Expanded search range:", {
      expandedStart,
      expandedEnd
    })
    
    // Find suggestions that overlap with the expanded range
    const overlappingSuggestions = await db
      .select()
      .from(suggestionsTable)
      .where(
        and(
          eq(suggestionsTable.documentId, documentId),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false),
          // Overlap condition: suggestion overlaps with our range
          sql`(
            (${suggestionsTable.startOffset} >= ${expandedStart} AND ${suggestionsTable.startOffset} < ${expandedEnd}) OR
            (${suggestionsTable.endOffset} > ${expandedStart} AND ${suggestionsTable.endOffset} <= ${expandedEnd}) OR
            (${suggestionsTable.startOffset} <= ${expandedStart} AND ${suggestionsTable.endOffset} >= ${expandedEnd})
          )`
        )
      )
    
    console.log("🎯🔍 OVERLAP: Found", overlappingSuggestions.length, "overlapping suggestions:", 
      overlappingSuggestions.map(s => ({ 
        id: s.id, 
        range: `${s.startOffset}-${s.endOffset}`,
        text: s.originalText || s.suggestedText?.substring(0, 20) + "..."
      }))
    )
    
    return {
      isSuccess: true,
      message: `Found ${overlappingSuggestions.length} overlapping suggestions`,
      data: overlappingSuggestions
    }
    
  } catch (error) {
    console.error("🎯🔍 OVERLAP: Error finding overlapping suggestions:", error)
    return {
      isSuccess: false,
      message: "Failed to find overlapping suggestions"
    }
  }
}

export async function dismissSpecificSuggestionsAction(
  suggestionIds: string[]
): Promise<ActionState<{ dismissedCount: number }>> {
  try {
    console.log("🎯🧹 DISMISS: Dismissing specific suggestions:", suggestionIds)
    
    if (suggestionIds.length === 0) {
      return {
        isSuccess: true,
        message: "No suggestions to dismiss",
        data: { dismissedCount: 0 }
      }
    }
    
    // Update specific suggestions to dismissed
    const result = await db
      .update(suggestionsTable)
      .set({ dismissed: true })
      .where(
        and(
          inArray(suggestionsTable.id, suggestionIds),
          eq(suggestionsTable.accepted, false),
          eq(suggestionsTable.dismissed, false)
        )
      )
      .returning({ id: suggestionsTable.id })

    const dismissedCount = result.length
    console.log("🎯🧹 DISMISS: Dismissed", dismissedCount, "specific suggestions")

    return {
      isSuccess: true,
      message: `Dismissed ${dismissedCount} specific suggestions`,
      data: { dismissedCount }
    }
  } catch (error) {
    console.error("🎯🧹 DISMISS: Error dismissing specific suggestions:", error)
    return {
      isSuccess: false,
      message: "Failed to dismiss specific suggestions"
    }
  }
}

function extractTextSegments(text: string, changedStart: number, changedEnd: number): TextSegment[] {
  const segments: TextSegment[] = []
  
  // Define segment size (e.g., 200 characters on each side of the change)
  const segmentPadding = 200
  
  // Calculate segment boundaries
  const segmentStart = Math.max(0, changedStart - segmentPadding)
  const segmentEnd = Math.min(text.length, changedEnd + segmentPadding)
  
  // Find sentence boundaries within the segment to create natural breaks
  const segmentText = text.substring(segmentStart, segmentEnd)
  
  // For now, just return one segment around the change
  // In the future, we could split this into sentence-based segments
  segments.push({
    startOffset: segmentStart,
    endOffset: segmentEnd,
    text: segmentText
  })
  
  console.log("🎯📝 SEGMENTS: Extracted text segment:", {
    startOffset: segmentStart,
    endOffset: segmentEnd,
    textLength: segmentText.length,
    textPreview: segmentText.substring(0, 50) + "..."
  })
  
  return segments
}

export async function targetedRecheckAction(
  fullText: string,
  documentId: string,
  changedStart: number,
  changedEnd: number
): Promise<ActionState<{ spellingSuggestions: Suggestion[]; grammarSuggestions: Suggestion[] }>> {
  try {
    console.log("🎯🔄 TARGETED: Starting targeted recheck for change:", {
      documentId,
      changedStart,
      changedEnd,
      changedText: fullText.substring(changedStart, changedEnd)
    })
    
    // STEP 1: Find overlapping suggestions and dismiss them
    const overlapResult = await findOverlappingSuggestionsAction(documentId, changedStart, changedEnd)
    
    if (!overlapResult.isSuccess) {
      console.error("🎯🔄 TARGETED: Failed to find overlapping suggestions:", overlapResult.message)
      return {
        isSuccess: false,
        message: "Failed to find overlapping suggestions"
      }
    }
    
    const overlappingSuggestions = overlapResult.data
    const suggestionIds = overlappingSuggestions.map(s => s.id)
    
    if (suggestionIds.length > 0) {
      const dismissResult = await dismissSpecificSuggestionsAction(suggestionIds)
      if (!dismissResult.isSuccess) {
        console.error("🎯🔄 TARGETED: Failed to dismiss overlapping suggestions:", dismissResult.message)
      } else {
        console.log("🎯🔄 TARGETED: Dismissed", dismissResult.data.dismissedCount, "overlapping suggestions")
      }
    }
    
    // STEP 2: Extract text segments around the change
    const segments = extractTextSegments(fullText, changedStart, changedEnd)
    
    // STEP 3: Run spell and grammar checks on each segment
    const allSpellingSuggestions: Suggestion[] = []
    const allGrammarSuggestions: Suggestion[] = []
    
    for (const segment of segments) {
      console.log("🎯🔄 TARGETED: Checking segment:", {
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        length: segment.text.length
      })
      
             try {
         // For both checks: use full text, but we'll filter results to the segment range later
         const [spellResult, grammarResult] = await Promise.all([
           checkSpellingWithLanguageToolAction(fullText, documentId, segment.startOffset, segment.endOffset),
           checkGrammarWithOpenAIAction(fullText, documentId)
         ])
         
         if (spellResult.isSuccess && spellResult.data) {
           // Spelling suggestions should already have correct absolute offsets from full text
           allSpellingSuggestions.push(...spellResult.data)
           console.log("🎯🔄 TARGETED: Added", spellResult.data.length, "spelling suggestions from segment")
         }
         
         if (grammarResult.isSuccess && grammarResult.data) {
           // Filter grammar suggestions to only include those within the segment range
           const segmentGrammarSuggestions = grammarResult.data.filter((suggestion: Suggestion) => {
             const suggStart = suggestion.startOffset || 0
             const suggEnd = suggestion.endOffset || 0
             
             // Check if suggestion overlaps with our segment
             return (suggStart < segment.endOffset && suggEnd > segment.startOffset)
           })
           
           allGrammarSuggestions.push(...segmentGrammarSuggestions)
           console.log("🎯🔄 TARGETED: Added", segmentGrammarSuggestions.length, "grammar suggestions from segment (filtered from", grammarResult.data.length, "total)")
         }
        
      } catch (error) {
        console.error("🎯🔄 TARGETED: Error checking segment:", error)
        // Continue with other segments
      }
    }
    
    const totalSuggestions = allSpellingSuggestions.length + allGrammarSuggestions.length
    
    console.log("🎯🔄 TARGETED: Complete! Generated", totalSuggestions, "new suggestions:", {
      spelling: allSpellingSuggestions.length,
      grammar: allGrammarSuggestions.length,
      affectedRange: `${changedStart}-${changedEnd}`
    })
    
    return {
      isSuccess: true,
      message: `Targeted recheck complete. Generated ${totalSuggestions} suggestions for affected area.`,
      data: {
        spellingSuggestions: allSpellingSuggestions,
        grammarSuggestions: allGrammarSuggestions
      }
    }
    
  } catch (error) {
    console.error("🎯🔄 TARGETED: Error during targeted recheck:", error)
    return {
      isSuccess: false,
      message: "Failed to perform targeted recheck"
    }
  }
} 