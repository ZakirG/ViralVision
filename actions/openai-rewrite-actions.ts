/*
<ai_context>
OpenAI-based content rewriting for WordWise.
Uses GPT-4o-mini to rewrite content following viral critique guidelines.
</ai_context>
*/

"use server"

import type { ActionState } from "@/types/server-action-types"
import { auth } from "@clerk/nextjs/server"

interface OpenAIResponse {
  id: string
  choices: Array<{
    message: {
      content: string
    }
  }>
}

function createRewritePrompt(originalContent: string, critiqueGuideline: string): string {
  return `You are an expert content writer specializing in creating viral, engaging content for social media platforms.

Below is the potential script for the video that you will be rewriting:
"""
${originalContent}
"""

Our Virality assistant has already critiqued this content. Below is their suggestion for the rewrite: "${critiqueGuideline}"

Please rewrite the content to follow the guideline while:
1. Maintaining the core message and intent
2. Only making the most minimal changes necessary
3. Preserving the paragraph breaks and newlines in the original content
4. Following the suggestion from the Virality assistant as CLOSELY as possible.
5. Keeping all other parts of the user's video script intact.

Return only the rewritten content without any explanations or markdown formatting.`
}

async function callOpenAIRewrite(originalContent: string, critiqueGuideline: string): Promise<string | null> {
  try {
    console.log("🚀 OpenAI: Calling API for content rewrite...")

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("🚀 OpenAI: OPENAI_API_KEY not found")
      throw new Error("OPENAI_API_KEY not found")
    }

    const prompt = createRewritePrompt(originalContent, critiqueGuideline)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
      }),
      signal: AbortSignal.timeout(30000) // 30-second timeout for content rewriting
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("🚀 OpenAI: API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data: OpenAIResponse = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.warn("🚀 OpenAI: No content in response for rewrite.")
      return null
    }

    // Clean the content - remove any markdown formatting or extra whitespace
    const cleanedContent = content.trim()
      .replace(/^```\s*/, '') // Remove leading code blocks
      .replace(/\s*```$/, '') // Remove trailing code blocks
      .replace(/^`+|`+$/g, '') // Remove any remaining backticks
      .trim()

    return cleanedContent
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("🚀 OpenAI: Rewrite request timed out.")
    } else {
      console.error("🚀 OpenAI: API call for rewrite failed:", error)
    }
    return null
  }
}

export async function rewriteContentWithCritiqueAction(
  originalContent: string,
  critiqueGuideline: string
): Promise<ActionState<string>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    if (!originalContent.trim()) {
      return {
        isSuccess: false,
        message: "No content to rewrite."
      }
    }

    if (!critiqueGuideline.trim()) {
      return {
        isSuccess: false,
        message: "No critique guideline provided."
      }
    }

    const rewrittenContent = await callOpenAIRewrite(originalContent, critiqueGuideline)

    if (rewrittenContent) {
      return {
        isSuccess: true,
        message: "Content rewritten successfully.",
        data: rewrittenContent
      }
    } else {
      return {
        isSuccess: false,
        message: "Failed to rewrite content with AI."
      }
    }
  } catch (error) {
    console.error("🚀 OpenAI rewrite action error:", error)
    return {
      isSuccess: false,
      message: "Failed to rewrite content."
    }
  }
} 