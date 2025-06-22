import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

interface CleanTranscriptRequest {
  text: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CleanTranscriptRequest = await request.json()
    const { text } = body

    if (!text?.trim()) {
      return NextResponse.json({ cleanedText: '' })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured")
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Please rewrite the following transcript with correct punctuation and capitalization. Keep the same words and meaning, but fix grammar, punctuation, and capitalization to make it read naturally. Add line breaks between each sentence so that each sentence is on its own line. Do not add any extra words or change the content - only fix punctuation and capitalization. Return only the corrected text, nothing else:\n\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      })
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.status}`)
    }

    const result = await openAIResponse.json()
    const cleanedText = result.choices?.[0]?.message?.content?.trim()

    return NextResponse.json({
      cleanedText: cleanedText || text
    })

  } catch (error) {
    console.error("Clean transcript API error:", error)
    return NextResponse.json(
      { error: 'Transcript cleaning failed' },
      { status: 500 }
    )
  }
} 