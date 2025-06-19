"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Check, AlertTriangle, BookOpen } from "lucide-react"
import type { Suggestion } from "@/db/schema"
import { acceptSuggestionAction } from "@/actions/db/suggestions-actions"
import { toast } from "@/hooks/use-toast"

interface SuggestionPanelProps {
  suggestion: Suggestion | null
  isOpen: boolean
  onClose: () => void
  onAccept: (suggestion: Suggestion) => void
  onReject: (suggestion: Suggestion) => void
}

export function SuggestionPanel({ 
  suggestion, 
  isOpen, 
  onClose, 
  onAccept, 
  onReject 
}: SuggestionPanelProps) {
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  if (!isOpen || !suggestion) {
    return null
  }

  const handleAccept = async () => {
    try {
      setAccepting(true)
      const result = await acceptSuggestionAction(suggestion.id)
      
      if (result.isSuccess) {
        toast({
          title: "Suggestion Applied",
          description: "The suggestion has been applied to your text."
        })
        onAccept(suggestion)
        onClose()
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
        description: "Failed to accept suggestion",
        variant: "destructive"
      })
    } finally {
      setAccepting(false)
    }
  }

  const handleReject = async () => {
    try {
      setRejecting(true)
      onReject(suggestion)
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss suggestion",
        variant: "destructive"
      })
    } finally {
      setRejecting(false)
    }
  }

  const getSuggestionIcon = () => {
    switch (suggestion.suggestionType) {
      case 'spelling':
        return <AlertTriangle className="size-4 text-red-500" />
      case 'grammar':
        return <BookOpen className="size-4 text-yellow-500" />
      default:
        return <AlertTriangle className="size-4 text-gray-500" />
    }
  }

  const getSuggestionTypeLabel = () => {
    switch (suggestion.suggestionType) {
      case 'spelling':
        return 'Spelling'
      case 'grammar':
        return 'Grammar'
      case 'style':
        return 'Style'
      default:
        return 'Suggestion'
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-xl border-l border-gray-200">
      <Card className="h-full rounded-none border-0">
        <CardHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getSuggestionIcon()}
              <CardTitle className="text-lg">
                {getSuggestionTypeLabel()} Suggestion
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8"
            >
              <X className="size-4" />
            </Button>
          </div>
          <Badge 
            variant={suggestion.suggestionType === 'spelling' ? 'destructive' : 'secondary'}
            className="w-fit"
          >
            {getSuggestionTypeLabel()}
          </Badge>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4">
          {/* Explanation */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Issue</h3>
            <p className="text-sm text-gray-600">
              {suggestion.explanation || "No explanation provided."}
            </p>
          </div>

          {/* Suggested replacement */}
          {suggestion.suggestedText && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Suggested Change</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800">
                  "{suggestion.suggestedText}"
                </p>
              </div>
            </div>
          )}

          {/* Confidence score */}
          {suggestion.confidence && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Confidence</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${parseFloat(suggestion.confidence) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {Math.round(parseFloat(suggestion.confidence) * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleAccept}
              disabled={accepting || rejecting}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
            >
              {accepting ? (
                "Applying..."
              ) : (
                <>
                  <Check className="size-4 mr-2" />
                  Apply
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={accepting || rejecting}
              className="flex-1"
            >
              {rejecting ? "Dismissing..." : "Dismiss"}
            </Button>
          </div>

          {/* Additional info */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-xs text-gray-500">
              This suggestion was generated by LanguageTool and may not always be perfect. 
              Use your judgment when deciding whether to apply it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 