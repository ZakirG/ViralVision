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

// Create grammar checking prompt for GPT-4o-mini
function createGrammarPrompt(sentence: string): string {
  return `You are a professional grammar checker. Analyze the following sentence for grammar errors, style improvements, and clarity issues. 

SENTENCE: "${sentence}"

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
    console.log("🤖 OpenAI: Starting API call for sentence:", sentence.substring(0, 50) + "...")
    
    const apiKey = process.env.OPENAI_API_KEY
    console.log("🤖 OpenAI: API key present:", !!apiKey)
    console.log("🤖 OpenAI: API key length:", apiKey ? apiKey.length : 0)
    
    if (!apiKey) {
      console.error("🤖 OpenAI: OPENAI_API_KEY not found in environment variables")
      throw new Error("OPENAI_API_KEY not found in environment variables")
    }

    console.log("🤖 OpenAI: Making fetch request to OpenAI API...")
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: createGrammarPrompt(sentence)
          }
        ],
        temperature: 0.1, // Low temperature for consistent grammar checking
        max_tokens: 1000
      })
    })

    console.log("🤖 OpenAI: Response status:", response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("🤖 OpenAI: API error response:", errorText)
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data: OpenAIResponse = await response.json()
    console.log("🤖 OpenAI: Received response data:", JSON.stringify(data, null, 2))
    
    const content = data.choices[0]?.message?.content
    console.log("🤖 OpenAI: Extracted content:", content)

    if (!content) {
      console.warn("🤖 OpenAI: No content in response")
      return []
    }

    try {
      // Parse the JSON response from GPT-4o-mini
      console.log("🤖 OpenAI: Attempting to parse JSON...")
      const suggestions = JSON.parse(content.trim())
      console.log("🤖 OpenAI: Parsed suggestions:", suggestions)
      
      if (!Array.isArray(suggestions)) {
        console.warn("🤖 OpenAI: Response is not an array:", suggestions)
        return []
      }

      const validSuggestions = suggestions.filter((s: any) => 
        s.originalText && s.suggestedText && s.explanation && typeof s.confidence === 'number'
      )
      
      console.log("🤖 OpenAI: Filtered valid suggestions:", validSuggestions)
      return validSuggestions
      
    } catch (parseError) {
      console.error("🤖 OpenAI: Failed to parse JSON response:", parseError)
      console.log("🤖 OpenAI: Raw response content:", content)
      return []
    }
  } catch (error) {
    console.error("OpenAI API call failed:", error)
    return []
  }
}

export async function checkGrammarWithOpenAIAction(
  text: string,
  documentId: string
): Promise<ActionState<Suggestion[]>> {
  try {
    console.log("🤖🤖🤖 OPENAI GRAMMAR CHECK CALLED 🤖🤖🤖")
    console.log("🤖 OpenAI grammar check starting - text length:", text.length)
    console.log("🤖 Text content:", text)
    
    // Check environment variables
    const apiKey = process.env.OPENAI_API_KEY
    console.log("🤖 Environment check - OPENAI_API_KEY present:", !!apiKey)
    console.log("🤖 Environment check - NODE_ENV:", process.env.NODE_ENV)
    console.log("🤖 Environment check - All env keys:", Object.keys(process.env).filter(k => k.includes('OPENAI')))
    
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
    console.log("🤖 Split text into", sentences.length, "sentences")

    // Get existing grammar suggestions only
    const existingGrammarSuggestions = await db
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

    console.log("🤖 Found", existingGrammarSuggestions.length, "existing grammar suggestions")

    const validExistingSuggestionIds = new Set<string>()
    let suggestionsCreated = 0
    let suggestionsUpdated = 0

    // Process each sentence through OpenAI
    for (const sentenceInfo of sentences) {
      try {
        console.log("🤖 Checking sentence:", sentenceInfo.sentence.substring(0, 50) + "...")
        console.log("🤖 Full sentence being checked:", sentenceInfo.sentence)
        
        const grammarSuggestions = await callOpenAI(sentenceInfo.sentence)
        console.log("🤖 OpenAI returned", grammarSuggestions.length, "suggestions for sentence")
        console.log("🤖 Raw suggestions from OpenAI:", JSON.stringify(grammarSuggestions, null, 2))

        // Process each suggestion from OpenAI
        for (const suggestion of grammarSuggestions) {
          try {
            // Find the exact position of the original text within the full document
            const originalTextInSentence = suggestion.originalText
            const sentenceStartInDocument = sentenceInfo.startOffset
            
            // Find where this originalText appears in the sentence
            const indexInSentence = sentenceInfo.sentence.indexOf(originalTextInSentence)
            if (indexInSentence === -1) {
              console.warn("🤖 Could not find originalText in sentence:", originalTextInSentence)
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
              console.log("🤖 Preserving existing grammar suggestion:", matchingExisting.id)
            } else {
              // Create new grammar suggestion
              await db
                .insert(suggestionsTable)
                .values({
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
              
              suggestionsCreated++
              console.log("🤖 Created grammar suggestion:", suggestion.originalText, "→", suggestion.suggestedText)
            }
          } catch (error) {
            console.error("🤖 Error processing individual suggestion:", error)
          }
        }
      } catch (error) {
        console.error("🤖 Error processing sentence:", error)
      }
    }

    // Clean up obsolete grammar suggestions
    const obsoleteGrammarSuggestionIds = existingGrammarSuggestions
      .filter(existing => !validExistingSuggestionIds.has(existing.id))
      .map(existing => existing.id)

    let suggestionsDeleted = 0
    for (const obsoleteSuggestionId of obsoleteGrammarSuggestionIds) {
      try {
        await db
          .delete(suggestionsTable)
          .where(eq(suggestionsTable.id, obsoleteSuggestionId))
        suggestionsDeleted++
      } catch (error) {
        console.error("🤖 Failed to delete obsolete grammar suggestion:", error)
      }
    }

    console.log(`🤖 OpenAI grammar check complete: ${suggestionsCreated} created, ${suggestionsUpdated} updated, ${suggestionsDeleted} deleted, ${validExistingSuggestionIds.size} preserved`)

    // Return all grammar suggestions
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
    console.error("🤖 OpenAI grammar check error:", error)
    return {
      isSuccess: false,
      message: "Failed to check grammar with AI"
    }
  }
} 