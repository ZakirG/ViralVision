"use client"

import { useState } from "react"
import { testOpenRouterConnection } from "@/actions/test-openrouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestOpenRouterPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runTest = async () => {
    setLoading(true)
    try {
      const testResult = await testOpenRouterConnection()
      setResult(testResult)
    } catch (error) {
      setResult({
        success: false,
        message: "Test failed: " + (error as Error).message,
        details: error
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>OpenRouter API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Click the button below to test your OpenRouter API connection. 
            Make sure you have added your OPENROUTER_API_KEY to .env.local file.
          </p>
          
          <Button 
            onClick={runTest} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Testing..." : "Test OpenRouter Connection"}
          </Button>

          {result && (
            <Card className={`mt-4 ${result.success ? 'border-green-500' : 'border-red-500'}`}>
              <CardContent className="pt-4">
                <div className={`font-semibold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.success ? "✅ SUCCESS" : "❌ FAILED"}
                </div>
                <p className="mt-2">{result.message}</p>
                
                {result.details && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      View Details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto rounded">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">Setup Instructions:</h3>
            <ol className="mt-2 text-sm text-blue-800 space-y-1">
              <li>1. Sign up at <a href="https://openrouter.ai" className="underline">openrouter.ai</a></li>
              <li>2. Get your API key from the dashboard</li>
              <li>3. Add to your `.env.local` file: <code className="bg-blue-100 px-1 rounded">OPENROUTER_API_KEY=your_key_here</code></li>
              <li>4. Restart your development server</li>
              <li>5. Run this test</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 