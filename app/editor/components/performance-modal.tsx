"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Info, X } from "lucide-react"

interface PerformanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentContent: string
}

export function PerformanceModal({
  open,
  onOpenChange,
  documentContent
}: PerformanceModalProps) {
  // Calculate statistics from document content
  const words = documentContent.split(/\s+/).filter(word => word.length > 0)
  const wordCount = words.length
  const characterCount = documentContent.length
  const sentences = documentContent
    .split(/[.!?]+/)
    .filter(sentence => sentence.trim().length > 0).length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))
  const speakingTime = Math.max(1, Math.ceil(wordCount / 150))

  // Calculate readability metrics
  const avgWordLength =
    words.length > 0 ? (words.join("").length / words.length).toFixed(1) : "0.0"
  const avgSentenceLength =
    sentences > 0 ? (wordCount / sentences).toFixed(1) : "0.0"
  const readabilityScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        206.835 -
          1.015 * Number.parseFloat(avgSentenceLength) -
          84.6 * Number.parseFloat(avgWordLength)
      )
    )
  )

  // Overall text score (simplified calculation)
  const textScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        readabilityScore * 0.4 +
          (wordCount > 50 ? 30 : wordCount * 0.6) +
          (sentences > 3 ? 30 : sentences * 10)
      )
    )
  )

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const formatSpeakingTime = (minutes: number) => {
    const totalSeconds = minutes * 60
    const mins = Math.floor(totalSeconds / 60)
    const secs = Math.round(totalSeconds % 60)
    return `${mins} min ${secs} sec`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="relative">
          <DialogTitle className="text-2xl font-semibold text-gray-900">
            Performance
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="ring-offset-background focus:ring-ring absolute right-0 top-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Text Score Section */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="leading-relaxed text-gray-700">
                Text score:{" "}
                <span className="font-semibold">{textScore} out of 100</span>.
                This score represents the quality of writing in this document.
                <p className="text-sm text-gray-600">
                  You can increase it by addressing ViralVision's suggestions.
                </p>
              </p>
            </div>
            <div className="ml-6 shrink-0">
              <div className="relative size-20">
                <svg className="size-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-teal-600"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${textScore}, 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-teal-600">
                    {textScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Word Count Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Word count</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-700">Characters</span>
                  <span className="font-semibold text-teal-600">
                    {characterCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Words</span>
                  <span className="font-semibold text-teal-600">
                    {wordCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Sentences</span>
                  <span className="font-semibold text-teal-600">
                    {sentences}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-700">Reading time</span>
                  <span className="font-semibold text-teal-600">
                    {formatTime(readingTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Speaking time</span>
                  <span className="font-semibold text-teal-600">
                    {formatSpeakingTime(speakingTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Readability Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Readability
              </h3>
              <span className="text-sm text-gray-500">
                Metrics compared to other ViralVision users
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Word length</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-gray-200">
                      <div className="h-2 w-3/4 rounded-full bg-teal-600"></div>
                    </div>
                    <span className="text-sm text-gray-600">Above average</span>
                  </div>
                  <span className="font-semibold text-teal-600">
                    {avgWordLength}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Sentence length</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-gray-200">
                      <div className="h-2 w-2/3 rounded-full bg-teal-600"></div>
                    </div>
                    <span className="text-sm text-gray-600">Above average</span>
                  </div>
                  <span className="font-semibold text-teal-600">
                    {avgSentenceLength}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">Readability score</span>
                  <Info className="size-4 text-gray-400" />
                </div>
                <span className="font-semibold text-teal-600">
                  {readabilityScore}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-gray-600">
              Your text compares in readability to The New York Times. It is
              likely to be understood by a reader who has at least a 10th-grade
              education (age 16).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center border-t border-gray-200 pt-6">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
