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
import { Plus } from "lucide-react"
import { createDocumentAction } from "@/actions/db/documents-actions"
import { toast } from "@/hooks/use-toast"
import { logDocumentCreatedAction } from "@/actions/analytics-actions"

interface NewDocumentModalProps {
  onDocumentCreated: (documentId: string) => void
}

export function NewDocumentModal({ onDocumentCreated }: NewDocumentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [retryCount, setRetryCount] = useState(0)

  // Retry logic for document creation
  const createDocumentWithRetry = useCallback(async (documentData: any, maxRetries = 2): Promise<any> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📝 Creating video plan (attempt ${attempt + 1}/${maxRetries + 1}):`, documentData)
        const result = await createDocumentAction(documentData)
        
        if (result.isSuccess) {
          console.log("✅ Video plan created successfully on attempt", attempt + 1)
          return result
        } else {
          console.log(`❌ Video plan creation failed on attempt ${attempt + 1}:`, result.message)
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            return result
          }
          
          // For retry-able errors, wait briefly before retrying
          if (result.message?.includes("timeout") || result.message?.includes("connection")) {
            console.log(`⏳ Retrying video plan creation in 1 second...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            // For non-retryable errors, don't retry
            return result
          }
        }
      } catch (error) {
        console.error(`❌ Video plan creation error on attempt ${attempt + 1}:`, error)
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error
        }
        
        // Wait briefly before retrying
        console.log(`⏳ Retrying video plan creation in 1 second...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent double submission
    if (loading) {
      console.log("🚫 Video plan creation already in progress, ignoring duplicate submission")
      return
    }
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a video plan title",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      setRetryCount(0)
      
      const documentData = {
        title: title.trim(),
        rawText: ""
      }
      
      const result = await createDocumentWithRetry(documentData)

      if (result.isSuccess && result.data) {
        console.log("✅ Video plan created successfully:", result.data.id)
        
        // Reset form state immediately after successful creation
        setTitle("")
        setRetryCount(0)
        
        // Show success message
        toast({
          title: "Success",
          description: "Video plan created successfully"
        })
        
        // Close modal before navigation to improve UX
        setOpen(false)
        
        // Call the document created handler (which includes navigation)
        onDocumentCreated(result.data.id)
        
        // Log analytics event asynchronously without blocking the UI
        // This happens after the user experience is complete
        logDocumentCreatedAction(
          result.data.id,
          "education", // Default value for analytics
          "general" // Default value for analytics
        ).catch((error) => {
          console.error("📊 Failed to log video plan created event (non-blocking):", error)
        })
        
      } else {
        console.error("❌ Video plan creation failed after retries:", result.message)
        toast({
          title: "Error",
          description: result.message || "Failed to create video plan. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("❌ Video plan creation error after retries:", error)
      toast({
        title: "Error",
        description: "Failed to create video plan. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary-brand hover:bg-primary-brand-hover">
          <Plus className="size-4" />
          New video plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Video Plan</DialogTitle>
          <DialogDescription>
            Enter a title for your new video plan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Video Plan Title</Label>
            <Input
              id="title"
              placeholder="Enter video plan title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
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
              className="bg-primary-brand hover:bg-primary-brand-hover"
            >
              {loading ? "Creating..." : "Create Video Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 