/*
<ai_context>
Tests for OpenAI rewrite actions
</ai_context>
*/

import { rewriteContentWithCritiqueAction } from '../openai-rewrite-actions'

// Mock the auth function
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({ userId: 'test-user-id' })
}))

// Mock the OpenAI API call
global.fetch = jest.fn()

describe('rewriteContentWithCritiqueAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return error for empty content', async () => {
    const result = await rewriteContentWithCritiqueAction('', 'Make it more engaging')
    
    expect(result.isSuccess).toBe(false)
    expect(result.message).toBe('No content to rewrite.')
  })

  it('should return error for empty critique guideline', async () => {
    const result = await rewriteContentWithCritiqueAction('Some content', '')
    
    expect(result.isSuccess).toBe(false)
    expect(result.message).toBe('No critique guideline provided.')
  })

  it('should return error when OpenAI API key is missing', async () => {
    // Mock missing API key
    const originalEnv = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    const result = await rewriteContentWithCritiqueAction('Test content', 'Make it viral')

    expect(result.isSuccess).toBe(false)
    expect(result.message).toBe('Failed to rewrite content with AI.')

    // Restore environment
    if (originalEnv) {
      process.env.OPENAI_API_KEY = originalEnv
    }
  })

  it('should handle successful OpenAI response', async () => {
    // Mock successful OpenAI response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Rewritten content that is more engaging and viral!'
          }
        }]
      })
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    // Mock API key
    process.env.OPENAI_API_KEY = 'test-api-key'

    const result = await rewriteContentWithCritiqueAction(
      'Original content',
      'Make it more engaging'
    )

    expect(result.isSuccess).toBe(true)
    expect(result.data).toBe('Rewritten content that is more engaging and viral!')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('Original content')
      })
    )
  })

  it('should handle OpenAI API errors', async () => {
    // Mock failed OpenAI response
    const mockResponse = {
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized')
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    // Mock API key
    process.env.OPENAI_API_KEY = 'test-api-key'

    const result = await rewriteContentWithCritiqueAction(
      'Original content',
      'Make it more engaging'
    )

    expect(result.isSuccess).toBe(false)
    expect(result.message).toBe('Failed to rewrite content with AI.')
  })
}) 