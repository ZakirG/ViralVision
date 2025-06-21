import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { videoUrls } = await request.json()

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'videoUrls array is required' },
        { status: 400 }
      )
    }

    // Validate TikTok URLs
    const validUrls = videoUrls.filter(url => {
      try {
        const urlObj = new URL(url)
        return urlObj.hostname.includes('tiktok.com')
      } catch {
        return false
      }
    })

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid TikTok URLs provided' },
        { status: 400 }
      )
    }

    // Get client IP from headers (for the TikTok API)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwarded?.split(',')[0] || realIp || '127.0.0.1'

    console.log('TikTok API request:', {
      urls: validUrls,
      clientIp,
      timestamp: new Date().toISOString()
    })

    // Make request to TikTok API
    const response = await fetch(
      `https://scriptadmin.tokbackup.com/v1/tiktok/fetchMultipleTikTokData?get_transcript=true&ip=${clientIp}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrls: validUrls
        }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      }
    )

    if (!response.ok) {
      console.error('TikTok API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `TikTok API request failed: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Validate the response structure
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.error('Invalid TikTok API response structure:', data)
      return NextResponse.json(
        { error: 'Invalid response from TikTok API' },
        { status: 500 }
      )
    }

    console.log('TikTok API success:', {
      dataCount: data.data.length,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in TikTok API proxy:', error)
    
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request to TikTok API timed out' },
        { status: 408 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch from TikTok API' },
      { status: 500 }
    )
  }
} 