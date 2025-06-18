"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "@/hooks/use-toast"
import { logDocumentCreatedAction } from "@/actions/analytics-actions"

interface NewDocumentModalProps {
  onDocumentCreated: (documentId: string) => void
}

const contentTypes = [
  { value: "education", label: "Education", description: "Informative content that teaches something" },
  { value: "edutainment", label: "Edutainment", description: "Educational content that's also entertaining" },
  { value: "storytime", label: "Storytime", description: "Narrative content that tells a story" },
  { value: "ad", label: "Advertisement", description: "Promotional content for products/services" }
] as const

const audienceLevels = [
  { value: "general", label: "General", description: "Broad audience with no specialized knowledge" },
  { value: "knowledgeable", label: "Knowledgeable", description: "Audience with some background knowledge" },
  { value: "expert", label: "Expert", description: "Specialized audience with deep expertise" }
] as const

export function NewDocumentModal({ onDocumentCreated }: NewDocumentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [contentType, setContentType] = useState<string>("education")
  const [audienceLevel, setAudienceLevel] = useState<string>("general")
  const [retryCount, setRetryCount] = useState(0)

  // Retry logic for document creation
  const createDocumentWithRetry = useCallback(async (documentData: any, maxRetries = 2): Promise<any> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📝 Creating document (attempt ${attempt + 1}/${maxRetries + 1}):`, documentData)
        const result = await createDocumentAction(documentData)
        
        if (result.isSuccess) {
          console.log("✅ Document created successfully on attempt", attempt + 1)
          return result
        } else {
          console.log(`❌ Document creation failed on attempt ${attempt + 1}:`, result.message)
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            return result
          }
          
          // For retry-able errors, wait briefly before retrying
          if (result.message?.includes("timeout") || result.message?.includes("connection")) {
            console.log(`⏳ Retrying document creation in 1 second...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            // For non-retryable errors, don't retry
            return result
          }
        }
      } catch (error) {
        console.error(`❌ Document creation error on attempt ${attempt + 1}:`, error)
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error
        }
        
        // Wait briefly before retrying
        console.log(`⏳ Retrying document creation in 1 second...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (loading) {
      console.log("🚫 Document creation already in progress, ignoring duplicate submission")
      return
    }
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a document title",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      setRetryCount(0)
      
      const documentData = {
        title: title.trim(),
        rawText: "",
        contentType: contentType as "education" | "edutainment" | "storytime" | "ad",
        audienceLevel: audienceLevel as "general" | "knowledgeable" | "expert"
      }
      
      const result = await createDocumentWithRetry(documentData)

      if (result.isSuccess && result.data) {
        console.log("✅ Document created successfully:", result.data.id)
        
        // Reset form state immediately after successful creation
        setTitle("")
        setContentType("education")
        setAudienceLevel("general")
        setRetryCount(0)
        
        // Show success message
        toast({
          title: "Success",
          description: "Document created successfully"
        })
        
        // Close modal before navigation to improve UX
        setOpen(false)
        
        // Call the document created handler (which includes navigation)
        onDocumentCreated(result.data.id)
        
        // Log analytics event asynchronously without blocking the UI
        // This happens after the user experience is complete
        logDocumentCreatedAction(
          result.data.id,
          contentType,
          audienceLevel
        ).catch((error) => {
          console.error("📊 Failed to log document created event (non-blocking):", error)
        })
        
      } else {
        console.error("❌ Document creation failed after retries:", result.message)
        toast({
          title: "Error",
          description: result.message || "Failed to create document. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("❌ Document creation error after retries:", error)
      toast({
        title: "Error",
        description: "Failed to create document. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
          <Plus className="size-4" />
          New document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Set up your document with content type and target audience.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              placeholder="Enter document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-gray-500">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audienceLevel">Target Audience</Label>
            <Select value={audienceLevel} onValueChange={setAudienceLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select target audience" />
              </SelectTrigger>
              <SelectContent>
                {audienceLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{level.label}</span>
                      <span className="text-xs text-gray-500">{level.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Creating..." : "Create Document"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 