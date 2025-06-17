"use client"

import { useState } from "react"
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
      const result = await createDocumentAction({
        title: title.trim(),
        rawText: "",
        contentType: contentType as "education" | "edutainment" | "storytime" | "ad",
        audienceLevel: audienceLevel as "general" | "knowledgeable" | "expert"
      })

      if (result.isSuccess && result.data) {
        // Log analytics event
        try {
          await logDocumentCreatedAction(
            result.data.id,
            contentType,
            audienceLevel
          )
        } catch (error) {
          console.error("Failed to log document created event:", error)
        }

        toast({
          title: "Success",
          description: "Document created successfully"
        })
        setOpen(false)
        setTitle("")
        setContentType("education")
        setAudienceLevel("general")
        onDocumentCreated(result.data.id)
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create document",
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