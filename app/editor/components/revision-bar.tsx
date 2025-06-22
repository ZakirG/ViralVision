"use client"

import React from "react"

interface RevisionBarProps {
  onAccept: () => void
  onReject: () => void
}

const RevisionBar: React.FC<RevisionBarProps> = ({ onAccept, onReject }) => {
  return (
    <div className="fixed bottom-4 inset-x-0 flex justify-center z-50">
      <div className="bg-white shadow-lg rounded-lg flex gap-4 px-6 py-3 border">
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          onClick={onReject}
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export default RevisionBar 