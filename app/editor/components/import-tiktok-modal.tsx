"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Video, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ImportTikTokModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContentImport?: (content: string) => void
}

export function ImportTikTokModal({
  open,
  onOpenChange,
  onContentImport
}: ImportTikTokModalProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleGrabScript = async () => {
    if (!url.trim()) {
      return
    }

    // Validate TikTok URL format
    try {
      const urlObj = new URL(url.trim())
      if (!urlObj.hostname.includes('tiktok.com')) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid TikTok URL",
          variant: "destructive"
        })
        return
      }
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid TikTok URL",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      console.log("Grabbing script from:", url)
      
      // Make POST request to our TikTok API proxy instead of external API directly
      const response = await fetch("/api/tiktok", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrls: [url]
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const apiResponse = await response.json()
      console.log("Full API Response:", apiResponse)

      // Extract metadata using the provided function
      function getTikTokMetadata(apiResponse: any) {
        if (!apiResponse?.data?.length) {
          throw new Error("Invalid or empty response");
        }

        const tiktok = apiResponse.data[0];

        // Extract relevant fields
        const transcriptWebVTT = tiktok.subtitles || "";
        const videoDescription = tiktok.data.desc || "";
        const videoCoverUrl = tiktok.data.video.zoomCover?.["720"] || tiktok.data.video.cover || "";
        const username = tiktok.data.author.uniqueId || "";
        const displayName = tiktok.data.author.nickname || "";
        const numberOfLikes = parseInt(tiktok.data.stats?.diggCount || "0", 10);

        return {
          transcriptWebVTT,
          videoDescription,
          videoCoverUrl,
          username,
          displayName,
          numberOfLikes,
        };
      }

      const metadata = getTikTokMetadata(apiResponse);

      // Function to clean WebVTT transcript and format for editor insertion
      async function formatTikTokContent(metadata: any): Promise<string> {
        if (!metadata.transcriptWebVTT) {
          return '';
        }
        
        // Clean the WebVTT transcript using regex
        function cleanWebVTTTranscript(webvttText: string): string {
          // Remove timestamp lines (format: "00:00:10 --> 00:00:13")
          const timestampRegex = /\d{2}:\d{2}:\d{2}\s*-->\s*\d{2}:\d{2}:\d{2}/g;
          
          // First remove all timestamp patterns
          let cleanedText = webvttText.replace(timestampRegex, '');
          
          // Split into lines, trim each line, and filter out empty lines
          const lines = cleanedText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');
          
          // Remove the first line (prefix string)
          if (lines.length > 0) {
            lines.shift();
          }
          
          // Join the cleaned lines
          return lines.join('\n');
        }
        
        const cleanedTranscript = cleanWebVTTTranscript(metadata.transcriptWebVTT);
        
        if (!cleanedTranscript.trim()) {
          return '';
        }
        
        // Send to OpenAI for punctuation and capitalization cleanup
        try {
          const openAIResponse = await fetch('/api/cleanTranscript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: cleanedTranscript
            })
          });
          
          if (!openAIResponse.ok) {
            console.error('Clean transcript API request failed:', openAIResponse.status);
            // Normalize multiple consecutive newlines to single newlines
            return cleanedTranscript.replace(/\n{2,}/g, '\n');
          }
          
          const result = await openAIResponse.json();
          console.log('Clean transcript API response:', result);
          
          const cleanedText = result.cleanedText;
          console.log('OpenAI cleaned transcript:', cleanedText);
          
          // Normalize multiple consecutive newlines to single newlines
          const normalizedText = (cleanedText || cleanedTranscript).replace(/\n{2,}/g, '\n');
          return normalizedText;
        } catch (error) {
          console.error('Error calling clean transcript API:', error);
          // Normalize multiple consecutive newlines to single newlines
          return cleanedTranscript.replace(/\n{2,}/g, '\n');
        }
      }

      console.log("Transcript WebVTT:", metadata.transcriptWebVTT);
      console.log("Video Description:", metadata.videoDescription);
      console.log("Video Cover URL:", metadata.videoCoverUrl);
      console.log("Username:", metadata.username);
      console.log("Display Name:", metadata.displayName);
      console.log("Number of Likes:", metadata.numberOfLikes);
      
      // Format the content for insertion into the editor
      const formattedContent = await formatTikTokContent(metadata);
      
      // Call the callback to insert content into editor
      if (onContentImport) {
        onContentImport(formattedContent);
      }
      
      // Show success message
      toast({
        title: "Script Imported!",
        description: "TikTok script has been successfully imported into your editor",
        duration: 3000
      })
      
      // Close modal after successful import
      onOpenChange(false)
      setUrl("")
    } catch (error) {
      console.error("Error grabbing script:", error)
      
      // Show user-friendly error message
      let errorMessage = "Failed to import script from TikTok"
      
      if (error instanceof Error) {
        if (error.message.includes('API request failed: 400')) {
          errorMessage = "Invalid TikTok URL. Please check the URL and try again."
        } else if (error.message.includes('API request failed: 404')) {
          errorMessage = "TikTok video not found. The video may be private or deleted."
        } else if (error.message.includes('API request failed: 408')) {
          errorMessage = "Request timed out. Please try again."
        } else if (error.message.includes('API request failed: 500')) {
          errorMessage = "TikTok service is temporarily unavailable. Please try again later."
        } else if (error.message.includes('Invalid or empty response')) {
          errorMessage = "No transcript found for this video. The video may not have captions."
        }
      }
      
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setUrl("")
    onOpenChange(false)
  }

  const isValidUrl = url.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-teal-600">
              <Video className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold text-gray-900">
                Import script from TikTok
              </DialogTitle>
              <p className="mt-1 text-gray-600">
                Enter a TikTok URL to automatically extract and import the script.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* URL Input */}
          <div className="space-y-3">
            <label htmlFor="tiktok-url" className="text-sm font-medium text-gray-700">
              TikTok URL
            </label>
            <Input
              id="tiktok-url"
              type="url"
              placeholder="https://www.tiktok.com/@username/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Paste the URL of the TikTok video you want to extract the script from.
            </p>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Copy the TikTok video URL from your browser or app</li>
              <li>• Paste it in the field above and click "Grab script"</li>
              <li>• The script will be imported into our editor</li>
              <li>• Revise the script for maximum impact with our AI tools</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGrabScript}
            disabled={!isValidUrl || isLoading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Grabbing script...
              </>
            ) : (
              "Grab script"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 