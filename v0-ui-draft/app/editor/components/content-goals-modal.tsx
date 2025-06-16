"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Target } from "lucide-react"

interface ContentGoalsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContentGoalsModal({ open, onOpenChange }: ContentGoalsModalProps) {
  const [contentType, setContentType] = useState("Education")
  const [audience, setAudience] = useState("General")
  const [showOnNewDocument, setShowOnNewDocument] = useState(false)

  const handleReset = () => {
    setContentType("Education")
    setAudience("General")
    setShowOnNewDocument(false)
  }

  const handleDone = () => {
    // Here you would save the goals
    console.log("Goals saved:", { contentType, audience, showOnNewDocument })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold text-gray-900">Set goals</DialogTitle>
              <p className="text-gray-600 mt-1">Get tailored writing suggestions based on your goals and audience.</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Content Type */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Content type</h3>
            <div className="flex flex-wrap gap-2">
              {["Education", "Edutainment", "Storytime", "Ad"].map((type) => (
                <button
                  key={type}
                  onClick={() => setContentType(type)}
                  className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                    contentType === type
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {contentType === "Education" && "Educational content focused on teaching and learning."}
              {contentType === "Edutainment" && "Educational content that entertains while teaching."}
              {contentType === "Storytime" && "Narrative content that tells engaging stories."}
              {contentType === "Ad" && "Promotional content designed to advertise products or services."}
            </p>
          </div>

          {/* Expected Viewer Audience */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Expected viewer audience</h3>
            <div className="flex flex-wrap gap-2">
              {["General", "Knowledgeable", "Expert"].map((level) => (
                <button
                  key={level}
                  onClick={() => setAudience(level)}
                  className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                    audience === level
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              {audience === "General" && "General audience with basic understanding of the topic."}
              {audience === "Knowledgeable" && "Knowledgeable audience with good understanding of the topic."}
              {audience === "Expert" && "Expert audience with deep understanding and specialized knowledge."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showOnNew"
              checked={showOnNewDocument}
              onChange={(e) => setShowOnNewDocument(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="showOnNew" className="text-sm text-gray-700">
              Show Set Goals when I start a new document
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="text-teal-600 hover:text-teal-700">
              Reset to defaults
            </Button>
            <Button onClick={handleDone} className="bg-teal-600 hover:bg-teal-700">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
