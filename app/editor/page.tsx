"use client"

import React, { useRef } from "react"
import EditableComponent, { type EditableHandle } from "./Editable"

export default function EditorPage() {
  const editorRef = useRef<EditableHandle>(null)

  const handleTestAcceptSuggestion = () => {
    editorRef.current?.acceptSuggestion("test-suggestion-id")
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Slate Editor Test</h1>
      <div className="border border-gray-300 p-4 min-h-[300px]">
        <EditableComponent ref={editorRef} />
      </div>
      <button
        onClick={handleTestAcceptSuggestion}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Test Accept Suggestion
      </button>
      <p className="mt-4 text-sm text-gray-600">
        Open browser devtools console to see Slate operations when typing.
      </p>
    </div>
  )
} 