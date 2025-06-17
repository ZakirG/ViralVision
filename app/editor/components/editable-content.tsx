"use client"

import type React from "react"
import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef
} from "react"

interface EditableContentProps {
  initialContent: string
  onContentChange: (content: string) => void
  onFormatStateChange?: (formatState: FormatState) => void
}

interface FormatState {
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  isBulletList: boolean
  isNumberedList: boolean
}

export interface EditableContentRef {
  formatText: (command: string) => void
  toggleBulletList: () => void
  toggleNumberedList: () => void
  focus: () => void
}

export const EditableContent = forwardRef<
  EditableContentRef,
  EditableContentProps
>(({ initialContent, onContentChange, onFormatStateChange }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useImperativeHandle(ref, () => ({
    formatText: (command: string) => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand(command, false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    toggleBulletList: () => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand("insertUnorderedList", false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    toggleNumberedList: () => {
      if (editorRef.current) {
        editorRef.current.focus()
        document.execCommand("insertOrderedList", false, undefined)
        updateContent()
        updateFormatState()
      }
    },
    focus: () => {
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }
  }))

  const updateContent = () => {
    if (editorRef.current) {
      const newTextContent = editorRef.current.textContent || ""
      onContentChange(newTextContent)
    }
  }

  const updateFormatState = () => {
    if (!onFormatStateChange) return

    const formatState: FormatState = {
      isBold: document.queryCommandState("bold"),
      isItalic: document.queryCommandState("italic"),
      isUnderlined: document.queryCommandState("underline"),
      isBulletList: document.queryCommandState("insertUnorderedList"),
      isNumberedList: document.queryCommandState("insertOrderedList")
    }

    onFormatStateChange(formatState)
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    updateContent()
  }

  const handleSelectionChange = () => {
    updateFormatState()
  }

  const highlightErrors = (text: string) => {
    // Words that should be highlighted as errors
    const errorWords = ["hi", "i'm", "chillin", "you", "dooooo"]

    let highlightedText = text
    errorWords.forEach(word => {
      const regex = new RegExp(`\\b(${word})\\b`, "gi")
      highlightedText = highlightedText.replace(
        regex,
        '<span class="underline decoration-red-500 decoration-2 decoration-wavy">$1</span>'
      )
    })

    return highlightedText.replace(/\n/g, "<br>")
  }

  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      // Only set initial content once
      editorRef.current.innerHTML = highlightErrors(initialContent)

      // Focus the editor on mount
      editorRef.current.focus()

      // Set cursor to end of content
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)

      setIsInitialized(true)
    }
  }, [initialContent, isInitialized])

  useEffect(() => {
    const handleSelectionChangeGlobal = () => {
      if (document.activeElement === editorRef.current) {
        updateFormatState()
      }
    }

    document.addEventListener("selectionchange", handleSelectionChangeGlobal)
    return () => {
      document.removeEventListener(
        "selectionchange",
        handleSelectionChangeGlobal
      )
    }
  }, [])

  return (
    <>
      <style jsx>{`
        .editor-content {
          caret-color: #374151;
        }

        .editor-content:focus {
          outline: none;
        }

        .editor-content::selection {
          background-color: #dbeafe;
        }

        .editor-content::-moz-selection {
          background-color: #dbeafe;
        }

        .editor-content b,
        .editor-content strong {
          font-weight: bold;
        }

        .editor-content i,
        .editor-content em {
          font-style: italic;
        }

        .editor-content u {
          text-decoration: underline;
        }

        .editor-content .error-highlight {
          text-decoration: underline;
          text-decoration-color: #ef4444;
          text-decoration-style: wavy;
          text-decoration-thickness: 2px;
        }

        .editor-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .editor-content ul {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .editor-content ol li {
          margin: 0.5rem 0;
          list-style-type: decimal;
        }

        .editor-content ul li {
          margin: 0.5rem 0;
          list-style-type: disc;
        }

        .editor-content li {
          padding-left: 0.5rem;
        }

        .editor-content:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning={true}
        className="editor-content min-h-[400px] text-lg leading-relaxed outline-none focus:outline-none"
        style={{
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          lineHeight: "1.6"
        }}
        onInput={handleInput}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        data-placeholder="Start writing..."
      />
    </>
  )
})

EditableContent.displayName = "EditableContent"
