/*
<ai_context>
OpenAI-based critique for WordWise.
Uses GPT-4o-mini to critique text for viral potential.
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

interface ViralCritique {
  hook: string
  pacing: string
  clarity: string
  engagement: string
  overall: string
}

const VIRAL_CRITIQUE_PROMPT = `You are an expert in social media and viral marketing. Critique the following text as a script for a short-form video. Provide feedback on its potential to go viral as a short-form video.

Analyze the text and provide specific, actionable feedback in the following JSON format:

{
  "hook": "Critique of the opening/hook - how well does it grab attention in the first 3 seconds?",
  "pacing": "Critique of the pacing and flow - does it maintain energy and momentum?",
  "clarity": "Critique of clarity and message - is the main point clear and easy to follow?",
  "engagement": "Critique of engagement potential - what elements would make viewers comment, share, or interact?",
  "overall": "Overall assessment and key recommendations for improving viral potential"
}

Be concise but specific in each critique. Focus on actionable improvements. Return ONLY valid JSON, no preamble or markdown.`

function createCritiquePrompt(text: string): string {
  return `${VIRAL_CRITIQUE_PROMPT}\n\nText to critique:\n\n"${text}"`
}

async function callOpenAICritique(text: string): Promise<ViralCritique | null> {
  try {
    console.log("🚀 OpenAI: Calling API for viral critique...")

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("🚀 OpenAI: OPENAI_API_KEY not found")
      throw new Error("OPENAI_API_KEY not found")
    }

    const prompt = createCritiquePrompt(text)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
      }),
      signal: AbortSignal.timeout(15000) // 15-second timeout for longer critique
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("🚀 OpenAI: API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data: OpenAIResponse = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      console.warn("🚀 OpenAI: No content in response for critique.")
      return null
    }

    try {
      // Parse the JSON response
      const critique = JSON.parse(content.trim()) as ViralCritique
      
      // Validate that all required fields are present
      if (!critique.hook || !critique.pacing || !critique.clarity || !critique.engagement || !critique.overall) {
        console.error("🚀 OpenAI: Invalid critique structure:", critique)
        return null
      }
      
      return critique
    } catch (parseError) {
      console.error("🚀 OpenAI: Failed to parse JSON critique:", parseError)
      console.error("🚀 OpenAI: Raw content:", content)
      return null
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("🚀 OpenAI: Critique request timed out.")
    } else {
      console.error("🚀 OpenAI: API call for critique failed:", error)
    }
    return null
  }
}

export async function critiqueViralAbilityAction(
  text: string
): Promise<ActionState<ViralCritique>> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return {
        isSuccess: false,
        message: "User not authenticated"
      }
    }

    if (!text.trim()) {
      return {
        isSuccess: false,
        message: "No text to critique."
      }
    }

    const critique = await callOpenAICritique(text)

    if (critique) {
      return {
        isSuccess: true,
        message: "Critique generated successfully.",
        data: critique
      }
    } else {
      return {
        isSuccess: false,
        message: "Failed to generate critique from AI."
      }
    }
  } catch (error) {
    console.error("🚀 OpenAI critique action error:", error)
    return {
      isSuccess: false,
      message: "Failed to get viral critique."
    }
  }
}

export type { ViralCritique } 