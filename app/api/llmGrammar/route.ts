/*
<ai_context>
Efficient LLM grammar checking API route for WordWise.
Minimizes API calls through idle detection and request cancellation.
Includes 5s timeout and filters dismissed suggestions.
</ai_context>
*/

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import writeGood from 'write-good'

interface GrammarRequest {
  text: string
  dismissedIds: string[]
  revision: number
}

interface GrammarSuggestion {
  id: string
  originalText: string
  suggestedText: string
  explanation: string
  startOffset: number
  endOffset: number
  confidence: number
  suggestionType: 'grammar'
}

interface OpenAIResponse {
  id: string
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// Split text into manageable chunks for processing
function splitIntoSentences(text: string): Array<{ sentence: string; startOffset: number; endOffset: number }> {
  const sentences: Array<{ sentence: string; startOffset: number; endOffset: number }> = []
  
  // Enhanced sentence splitting with better handling
  const sentenceRegex = /[.!?]+\s*/g
  let lastIndex = 0
  let match
  
  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length).trim()
    if (sentence.length > 10) { // Only process meaningful sentences
      sentences.push({
        sentence,
        startOffset: lastIndex,
        endOffset: match.index + match[0].length
      })
    }
    lastIndex = match.index + match[0].length
  }
  
  // Handle remaining text
  if (lastIndex < text.length) {
    const sentence = text.slice(lastIndex).trim()
    if (sentence.length > 10) {
      sentences.push({
        sentence,
        startOffset: lastIndex,
        endOffset: text.length
      })
    }
  }
  
  return sentences
}

// Process text with write-good and convert to our suggestion format
function processWithWriteGood(text: string, dismissedIds: string[]): GrammarSuggestion[] {
  console.log(`📝 Write-good: Processing ${text.length} chars`)
  
  try {
    const suggestions = writeGood(text)
    console.log(`📝 Write-good: Found ${suggestions.length} raw suggestions`)
    
    const grammarSuggestions: GrammarSuggestion[] = []
    
    for (const suggestion of suggestions) {
      const id = `write_good_${suggestion.index}_${suggestion.index + suggestion.offset}_${Date.now()}`
      
      // Skip dismissed suggestions
      if (dismissedIds.includes(id)) {
        continue
      }
      
      const grammarSuggestion: GrammarSuggestion = {
        id,
        originalText: text.substring(suggestion.index, suggestion.index + suggestion.offset),
        suggestedText: '', // write-good doesn't provide replacements, just identifies issues
        explanation: suggestion.reason,
        startOffset: suggestion.index,
        endOffset: suggestion.index + suggestion.offset,
        confidence: 0.8, // Default confidence for write-good suggestions
        suggestionType: 'grammar'
      }
      
      grammarSuggestions.push(grammarSuggestion)
    }
    
    console.log(`📝 Write-good: Converted to ${grammarSuggestions.length} grammar suggestions`)
    return grammarSuggestions
    
  } catch (error) {
    console.error("📝 Write-good error:", error)
    return []
  }
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
  When parsing the user input, pretend all the words are spelled correctly. Do not give suggestions
  for a phase if all you're changing is the spelling. We have a separate spell check for that.
  You are only looking for grammar errors. If there are no grammar errors in what the user intended
  to say, return an empty array [].
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

// Fast OpenAI API call with 5s timeout
async function callOpenAIWithTimeout(sentence: string, timeoutMs: number = 5000): Promise<GrammarSuggestion[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured")
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: createGrammarPrompt(sentence) }],
        temperature: 0.1,
        max_tokens: 200, // Reduced for speed
        top_p: 0.9,
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data: OpenAIResponse = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) return []

    // Extract JSON from markdown code blocks if present
    let jsonText = content.trim()
    
    // Remove markdown code block formatting
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }
    
    // Remove any leading/trailing backticks or other markdown artifacts
    jsonText = jsonText.replace(/^`+|`+$/g, '').trim()
    
    console.log("🔍 Extracted JSON text:", jsonText.substring(0, 200) + "...")

    const suggestions = JSON.parse(jsonText)
    if (!Array.isArray(suggestions)) return []

    return suggestions.filter((s: any) => 
      s.originalText && s.suggestedText && s.explanation && typeof s.confidence === 'number'
    )

  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("⏰ OpenAI request timed out")
    } else {
      console.error("🚨 OpenAI API error:", error)
    }
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GrammarRequest = await request.json()
    const { text, dismissedIds, revision } = body

    if (!text?.trim()) {
      return NextResponse.json({ suggestions: [], revision })
    }

    console.log(`🚀 LLM Grammar API: Processing ${text.length} chars, revision ${revision}`)

    // Use write-good for grammar checking instead of OpenAI
    const writeGoodSuggestions = processWithWriteGood(text, dismissedIds)
    
    console.log(`✅ Write-good Grammar API: Found ${writeGoodSuggestions.length} suggestions`)

    return NextResponse.json({
      suggestions: writeGoodSuggestions,
      revision
    })

    // The following OpenAI code is now disabled - we return early above
    // Split into sentences for parallel processing
    const sentences = splitIntoSentences(text)
    console.log(`📝 Split into ${sentences.length} sentences`)

    // Process sentences in parallel with 5s timeout each
    const sentencePromises = sentences.map(async (sentenceInfo) => {
      const suggestions = await callOpenAIWithTimeout(sentenceInfo.sentence, 5000)
      return { sentenceInfo, suggestions }
    })

    const results = await Promise.all(sentencePromises)

    // Combine results and calculate absolute positions
    const allSuggestions: GrammarSuggestion[] = []
    
    for (const { sentenceInfo, suggestions } of results) {
      for (const suggestion of suggestions) {
        const indexInSentence = sentenceInfo.sentence.indexOf(suggestion.originalText)
        if (indexInSentence === -1) continue

        const startOffset = sentenceInfo.startOffset + indexInSentence
        const endOffset = startOffset + suggestion.originalText.length

        const enhancedSuggestion: GrammarSuggestion = {
          id: `grammar_${startOffset}_${endOffset}_${Date.now()}`,
          originalText: suggestion.originalText,
          suggestedText: suggestion.suggestedText,
          explanation: suggestion.explanation,
          startOffset,
          endOffset,
          confidence: suggestion.confidence,
          suggestionType: 'grammar'
        }

        // Filter out dismissed suggestions
        if (!dismissedIds.includes(enhancedSuggestion.id)) {
          allSuggestions.push(enhancedSuggestion)
        }
      }
    }

    console.log(`✅ LLM Grammar API: Found ${allSuggestions.length} suggestions`)

    return NextResponse.json({
      suggestions: allSuggestions,
      revision
    })

  } catch (error) {
    console.error("🚨 LLM Grammar API error:", error)
    return NextResponse.json(
      { error: 'Grammar check failed' },
      { status: 500 }
    )
  }
} 