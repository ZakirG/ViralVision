/*
<ai_context>
Simple test file to verify OpenRouter API setup for WordWise.
</ai_context>
*/

"use server"

export async function testOpenRouterConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    console.log("🧪 Testing OpenRouter connection...")
    
    const apiKey = process.env.OPENROUTER_API_KEY
    console.log("🧪 API Key present:", !!apiKey)
    console.log("🧪 API Key length:", apiKey ? apiKey.length : 0)
    console.log("🧪 API Key prefix:", apiKey ? apiKey.substring(0, 10) + "..." : "none")
    
    if (!apiKey) {
      return {
        success: false,
        message: "OPENROUTER_API_KEY not found in environment variables. Please add it to your .env.local file."
      }
    }

    // Test with a simple sentence
    const testSentence = "This sentence have a grammar error."
    console.log("🧪 Testing with sentence:", testSentence)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "WordWise Grammar Checker Test"
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1-mini", 
        messages: [
          {
            role: "user",
            content: `Please analyze this sentence for grammar errors and respond with JSON: "${testSentence}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    })

    console.log("🧪 Response status:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log("🧪 Error response:", errorText)
      return {
        success: false,
        message: `OpenRouter API error: ${response.status} ${response.statusText}`,
        details: errorText
      }
    }

    const data = await response.json()
    console.log("🧪 Success! Response data:", JSON.stringify(data, null, 2))

    return {
      success: true,
      message: "OpenRouter connection successful!",
      details: data
    }

  } catch (error) {
    console.error("🧪 Test failed:", error)
    return {
      success: false,
      message: "Connection test failed: " + (error as Error).message,
      details: error
    }
  }
} 