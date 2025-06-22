"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"

interface RevisionBarProps {
  onAccept: () => void
  onReject: () => void
}

const RevisionBar: React.FC<RevisionBarProps> = ({ onAccept, onReject }) => {
  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-50">
      <div className="bg-white shadow-lg rounded-lg flex gap-4 px-6 py-3 border">
        <Button
          variant="outline"
          onClick={onAccept}
          className="flex items-center gap-2"
        >
          Accept
          <Check className="size-4 text-green-600" />
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          className="flex items-center gap-2"
        >
          Reject
          <X className="size-4 text-red-600" />
        </Button>
      </div>
    </div>
  )
}

export default RevisionBar 