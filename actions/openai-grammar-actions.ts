/*
<ai_context>
OpenAI-based grammar checking for WordWise.
Uses GPT-4o-mini to analyze grammar in individual sentences.
</ai_context>
*/

"use server"

import { db } from "@/db/db"
import { suggestionsTable } from "@/db/schema"
import type { Suggestion } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type { ActionState } from "@/types/server-action-types"
import { auth } from "@clerk/nextjs/server"

interface GrammarSuggestion {
  originalText: string
  suggestedText: string
  explanation: string
  startOffset: number
  endOffset: number
  confidence: number
}

interface OpenAIResponse {
  id: string
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// Split text into sentences based on periods (with some smart handling)
function splitIntoSentences(text: string): Array<{ sentence: string; startOffset: number; endOffset: number }> {
  const sentences: Array<{ sentence: string; startOffset: number; endOffset: number }> = []
  
  // Simple sentence splitting - can be enhanced later
  const sentenceRegex = /[.!?]+\s*/g
  let lastIndex = 0
  let match
  
  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length).trim()
    if (sentence.length > 0) {
      sentences.push({
        sentence,
        startOffset: lastIndex,
        endOffset: match.index + match[0].length
      })
    }
    lastIndex = match.index + match[0].length
  }
  
  // Handle remaining text (if doesn't end with punctuation)
  if (lastIndex < text.length) {
    const sentence = text.slice(lastIndex).trim()
    if (sentence.length > 0) {
      sentences.push({
        sentence,
        startOffset: lastIndex,
        endOffset: text.length
      })
    }
  }
  
  return sentences
}

// Create optimized grammar checking prompt for GPT-4o-mini (more concise for speed)
function createGrammarPrompt(sentence: string): string {
  return `Check grammar errors in: "${sentence}"

Return JSON array of corrections:
[{"originalText":"text to fix","suggestedText":"corrected text","explanation":"brief reason","confidence":0.9}]

Please respond with a JSON array of grammar suggestions. Each suggestion should have:
- originalText: the exact text that needs to be changed
- suggestedText: the corrected text
- explanation: a brief explanation of the issue
- confidence: a number from 0.1 to 1.0 indicating confidence

Only include suggestions for actual grammar errors, not stylistic preferences. If the sentence is grammatically correct, return an empty array [].
Do not include suggestions for spelling errors. Do not include suggestions for capitalization issues.
Your corrections should focus on full phrases or sentences, not individual words.
Response format:
[
  {
    "originalText": "exact text to replace",
    "suggestedText": "corrected text", 
    "explanation": "Brief explanation",
    "confidence": 0.9
  }
]

JSON Response:`
}

async function callOpenAI(sentence: string): Promise<GrammarSuggestion[]> {
  try {
    console.log("🚀 OpenAI: Fast API call for sentence:", sentence.substring(0, 50) + "...")
    
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      console.error("🚀 OpenAI: OPENAI_API_KEY not found")
      throw new Error("OPENAI_API_KEY not found")
    }

    console.log("🚀 OpenAI: Making ultra-optimized fetch request...")
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Connection": "keep-alive", // Reuse connections for speed
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: createGrammarPrompt(sentence)
          }
        ],
        temperature: 0.1,
        max_tokens: 300, // FURTHER REDUCED from 500 to 300 for even faster response
        top_p: 0.9, // Add top_p for more focused responses
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        stream: false // Ensure non-streaming for predictable timing
      }),
      // Add aggressive timeout and signal for faster failures
      signal: AbortSignal.timeout(8000) // 8 second hard timeout
    })

    console.log("🚀 OpenAI: Response status:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("🚀 OpenAI: API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data: OpenAIResponse = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.warn("🚀 OpenAI: No content in response")
      return []
    }

    try {
      const suggestions = JSON.parse(content.trim())
      
      if (!Array.isArray(suggestions)) {
        console.warn("🚀 OpenAI: Response is not an array")
        return []
      }

      const validSuggestions = suggestions.filter((s: any) => 
        s.originalText && s.suggestedText && s.explanation && typeof s.confidence === 'number'
      )
      
      console.log("🚀 OpenAI: Filtered valid suggestions:", validSuggestions.length)
      return validSuggestions
      
    } catch (parseError) {
      console.error("🚀 OpenAI: Failed to parse JSON:", parseError)
      return []
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error("🚀 OpenAI: Request timed out after 8 seconds")
    } else {
      console.error("🚀 OpenAI API call failed:", error)
    }
    return []
  }
}

// Batch process multiple sentences in parallel for speed
async function batchProcessSentences(sentences: Array<{ sentence: string; startOffset: number; endOffset: number }>): Promise<Array<{ sentenceInfo: typeof sentences[0]; suggestions: GrammarSuggestion[] }>> {
  console.log("🚀 OpenAI: Processing", sentences.length, "sentences in parallel...")
  
  // Process all sentences in parallel for maximum speed
  const promises = sentences.map(async (sentenceInfo) => {
    const suggestions = await callOpenAI(sentenceInfo.sentence)
    return { sentenceInfo, suggestions }
  })
  
  // Wait for all to complete
  const results = await Promise.all(promises)
  console.log("🚀 OpenAI: Parallel processing complete")
  
  return results
}

export async function checkGrammarWithOpenAIAction(
  text: string,
  documentId: string
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🚀🚀🚀 OPTIMIZED OPENAI GRAMMAR CHECK STARTING 🚀🚀🚀")
    console.log("🚀 OpenAI: Text length:", text.length, "chars")
    
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

    // Split text into sentences
    const sentences = splitIntoSentences(text)
    console.log("🚀 OpenAI: Split into", sentences.length, "sentences")

    // Get existing grammar suggestions in parallel with sentence processing
    const [existingGrammarSuggestions, batchResults] = await Promise.all([
      db.select()
        .from(suggestionsTable)
        .where(
          and(
            eq(suggestionsTable.documentId, documentId),
            eq(suggestionsTable.versionNumber, 1),
            eq(suggestionsTable.accepted, false),
            eq(suggestionsTable.dismissed, false),
            eq(suggestionsTable.suggestionType, 'grammar')
          )
        ),
      batchProcessSentences(sentences)
    ])

    console.log("🚀 OpenAI: Found", existingGrammarSuggestions.length, "existing suggestions")

    const validExistingSuggestionIds = new Set<string>()
    const newSuggestions: Array<{
      documentId: string
      versionNumber: number
      originalText: string
      suggestedText: string
      explanation: string
      startOffset: number
      endOffset: number
      suggestionType: "grammar"
      confidence: string
      accepted: boolean
    }> = []

    // Process all results from batch processing
    for (const { sentenceInfo, suggestions } of batchResults) {
      for (const suggestion of suggestions) {
        try {
          const originalTextInSentence = suggestion.originalText
          const sentenceStartInDocument = sentenceInfo.startOffset
          
          const indexInSentence = sentenceInfo.sentence.indexOf(originalTextInSentence)
          if (indexInSentence === -1) {
            console.warn("🚀 OpenAI: Could not find originalText in sentence:", originalTextInSentence)
            continue
          }

          const startOffset = sentenceStartInDocument + indexInSentence
          const endOffset = startOffset + originalTextInSentence.length

          // Check if we already have this suggestion
          const matchingExisting = existingGrammarSuggestions.find(existing => 
            existing.startOffset === startOffset &&
            existing.endOffset === endOffset &&
            existing.originalText === originalTextInSentence &&
            existing.suggestedText === suggestion.suggestedText
          )

          if (matchingExisting) {
            validExistingSuggestionIds.add(matchingExisting.id)
            console.log("🚀 OpenAI: Preserving existing suggestion:", matchingExisting.id)
          } else {
            // Prepare for batch insert
            newSuggestions.push({
              documentId,
              versionNumber: 1,
              originalText: originalTextInSentence,
              suggestedText: suggestion.suggestedText,
              explanation: suggestion.explanation,
              startOffset: startOffset,
              endOffset: endOffset,
              suggestionType: 'grammar',
              confidence: suggestion.confidence.toString(),
              accepted: false
            })
          }
        } catch (error) {
          console.error("🚀 OpenAI: Error processing suggestion:", error)
        }
      }
    }

    // Batch operations for maximum performance
    const operations: Promise<any>[] = []

    // Batch insert new suggestions if any
    if (newSuggestions.length > 0) {
      console.log("🚀 OpenAI: Batch inserting", newSuggestions.length, "new suggestions")
      operations.push(
        db.insert(suggestionsTable).values(newSuggestions)
      )
    }

    // Batch delete obsolete suggestions
    const obsoleteSuggestionIds = existingGrammarSuggestions
      .filter(existing => !validExistingSuggestionIds.has(existing.id))
      .map(existing => existing.id)

    if (obsoleteSuggestionIds.length > 0) {
      console.log("🚀 OpenAI: Batch deleting", obsoleteSuggestionIds.length, "obsolete suggestions")
      // Delete in batches for better performance
      const deletePromises = obsoleteSuggestionIds.map(id =>
        db.delete(suggestionsTable).where(eq(suggestionsTable.id, id))
      )
      operations.push(...deletePromises)
    }

    // Execute all database operations in parallel
    if (operations.length > 0) {
      await Promise.all(operations)
    }

    console.log(`🚀 OpenAI: Complete - ${newSuggestions.length} created, ${obsoleteSuggestionIds.length} deleted, ${validExistingSuggestionIds.size} preserved`)

    // Return grammar suggestions
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
      message: `Grammar check completed. ${newSuggestions.length} grammar suggestions found.`,
      data: grammarSuggestions
    }

  } catch (error) {
    console.error("🚀 OpenAI grammar check error:", error)
    return {
      isSuccess: false,
      message: "Failed to check grammar with AI"
    }
  }
} 