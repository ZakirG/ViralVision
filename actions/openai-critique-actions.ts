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

// Make this more flexible - it can contain any string keys
interface ViralCritique {
  [key: string]: string
}

const VIRAL_CRITIQUE_PROMPT = `You are a friendly brainstorm agent with a specialty in social media and viral marketing. Critique the following text as a script for a short-form video. Provide feedback on its potential to go viral as a short-form video. Our users are very talented: offer your critique in a gentle, humble, and respectful manner. Give them the benefit of the doubt -- they have a lot of experience in what they do.

Analyze the user's video script and provide specific, actionable feedback in JSON format. For each category in the JSON, you may provide a suggestion, idea, or example of a rewrite that follows your own advice. If the user's text matches the criteria provided below, there is no need to critique their video script, and you may exclude that category in their JSON response. Later, the user will be able to accept any suggestions you provide to automatically revise their content. The relevant categories for improvement:

Hook: Critique of the opening/hook - how well does it grab attention in the first 3 seconds? The general topic of the video should be immediately clear in the first 2 sentences. If the audience is niche, the hook should include a specific audience call-out so that audiences know whether the video is for them and they stop scrolling. The hook should contain a moment of emotional tension, expectation, suspense, or confusion that makes the user stop scrolling to resolve the tension. An example of a good hook: 'This company 3D printed an entire neighborhood. All those houses were printed with those giant machines. But get this... Because they're printed, people can design wild looking homes!'

Structure: Critique the structure of the content. Does it have a beginning, middle, and end? Is there extraneous detailing that could be cut? Is the content too repetitive? Could more interesting segments of the script be frontloaded to make the video more engaging? Could the conclusion of the video be stronger, with a memorable takeaway or question that has the audience thinking about the video after it's over?

Clarity: Critique of clarity and message - is the main point clear and easy to follow? Will the content sound natural and conversational when delivered aloud?"

Emotional Impact: How well does it evoke emotions or create connection with viewers? Critique of engagement potential - what elements would make viewers comment, share, or interact?

Your JSON structure:
{
  "hook": <string containing critique of this category and a suggestion, or simply 'Looks great.' if the user text is good>,
  "structure": <string containing critique of this category and a suggestion, or simply 'Looks great.' if the user text is good>,
  "clarity": <string containing critique of this category and a suggestion, or simply 'Looks great.' if the user text is good>,
  "emotional_impact": <string containing critique of this category and a suggestion, or simply 'Looks great.' if the user text is good>
}

Each critique should be concise but specific and actionable and include a specific suggestion for how the content would be altered if the user accepted your suggestion. Return ONLY valid JSON, no preamble or markdown.`

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
        model: "gpt-4.1-mini-2025-04-14",
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
      // Clean the content before parsing
      let cleanedContent = content.trim()
      
      // Remove any markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      // Remove any trailing commas before closing braces/brackets
      cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1')
      
      // Fix the specific issue with escaped quotes in JSON values
      // The problem is that OpenAI sometimes returns \" inside JSON values
      // We need to handle this by temporarily replacing and then restoring
      
      // First, let's try to parse as-is
      try {
        const critique = JSON.parse(cleanedContent) as ViralCritique
        
        // Validate that we have at least one critique field
        const keys = Object.keys(critique)
        if (keys.length === 0) {
          console.error("🚀 OpenAI: Empty critique object:", critique)
          return null
        }
        
        // Filter out any non-string values and ensure all values are strings
        const validCritique: ViralCritique = {}
        for (const [key, value] of Object.entries(critique)) {
          if (typeof value === 'string' && value.trim().length > 0) {
            validCritique[key] = value.trim()
          }
        }
        
        if (Object.keys(validCritique).length === 0) {
          console.error("🚀 OpenAI: No valid critique fields found")
          return null
        }
        
        return validCritique
      } catch (parseError) {
        // If that fails, try to fix the escaped quotes issue
        console.error("🚀 OpenAI: Initial JSON parse failed, attempting to fix escaped quotes")
        
        // Replace \" with a temporary marker
        cleanedContent = cleanedContent.replace(/\\"/g, '___QUOTE___')
        
        // Now escape any remaining quotes that are inside JSON values
        // This is a simpler approach: find all quotes and escape them if they're not at the start/end of values
        let inString = false
        let result = ''
        let i = 0
        
        while (i < cleanedContent.length) {
          const char = cleanedContent[i]
          
          if (char === '"' && (i === 0 || cleanedContent[i-1] !== '\\')) {
            inString = !inString
            result += char
          } else if (char === '"' && inString) {
            // This is a quote inside a string value, escape it
            result += '\\"'
          } else {
            result += char
          }
          
          i++
        }
        
        // Restore the temporary markers
        result = result.replace(/___QUOTE___/g, '"')
        
        // Try parsing again
        const critique = JSON.parse(result) as ViralCritique
        
        // Validate that we have at least one critique field
        const keys = Object.keys(critique)
        if (keys.length === 0) {
          console.error("🚀 OpenAI: Empty critique object after fixing quotes:", critique)
          return null
        }
        
        // Filter out any non-string values and ensure all values are strings
        const validCritique: ViralCritique = {}
        for (const [key, value] of Object.entries(critique)) {
          if (typeof value === 'string' && value.trim().length > 0) {
            validCritique[key] = value.trim()
          }
        }
        
        if (Object.keys(validCritique).length === 0) {
          console.error("🚀 OpenAI: No valid critique fields found after fixing quotes")
          return null
        }
        
        return validCritique
      }
    } catch (parseError) {
      console.error("🚀 OpenAI: Failed to parse JSON critique:", parseError)
      console.error("🚀 OpenAI: Raw content:", content)
      console.error("🚀 OpenAI: Content length:", content.length)
      
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