"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Menu,
  Target,
  BarChart3,
  ChevronRight,
  Sparkles,
  Info,
  MoreHorizontal,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  Type,
  ChevronDown,
} from "lucide-react"
import { EditableContent, type EditableContentRef } from "./components/editable-content"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ContentGoalsModal } from "./components/content-goals-modal"
import { PerformanceModal } from "./components/performance-modal"
import { FloatingSidebar } from "./components/floating-sidebar"
import { useRouter } from "next/navigation"

interface FormatState {
  isBold: boolean
  isItalic: boolean
  isUnderlined: boolean
  isBulletList: boolean
  isNumberedList: boolean
}

export default function GrammarlyEditor() {
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [activeMainTab, setActiveMainTab] = useState("review")
  const [documentContent, setDocumentContent] = useState("hi i'm over here chillin bro bro\n\nyou know how we dooooo")
  const [cursorPosition, setCursorPosition] = useState(0)
  const editorRef = useRef<EditableContentRef>(null)
  const [aiChatInput, setAiChatInput] = useState("")
  const [documentTitle, setDocumentTitle] = useState("Untitled document")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formatState, setFormatState] = useState<FormatState>({
    isBold: false,
    isItalic: false,
    isUnderlined: false,
    isBulletList: false,
    isNumberedList: false,
  })
  const router = useRouter()
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const suggestions = [
    {
      id: 1,
      type: "correctness",
      title: "Capitalize the word",
      word: "hi",
      description: "Correctness • Change the capitalization",
      preview: "hi I'm I'm over here chillin...",
      isPro: false,
    },
    {
      id: 2,
      type: "correctness",
      title: "Correct your spelling",
      word: "chillin",
      description: "Spelling error",
      preview: "chilling",
      isPro: false,
    },
    {
      id: 3,
      type: "correctness",
      title: "Capitalize the word",
      word: "you",
      description: "Capitalization",
      preview: "You",
      isPro: false,
    },
    {
      id: 4,
      type: "correctness",
      title: "Correct your spelling",
      word: "dooooo",
      description: "Spelling error",
      preview: "do",
      isPro: false,
    },
  ]

  const tabs = [
    { id: "correctness", label: "Correctness", color: "bg-red-500", score: 85 },
    { id: "clarity", label: "Clarity", color: "bg-blue-500", score: 72 },
    { id: "engagement", label: "Engagement", color: "bg-green-500", score: 90 },
    { id: "structure", label: "Structure", color: "bg-purple-500", score: 68 },
  ]

  // Formatting functions
  const handleBold = () => {
    editorRef.current?.formatText("bold")
  }

  const handleItalic = () => {
    editorRef.current?.formatText("italic")
  }

  const handleUnderline = () => {
    editorRef.current?.formatText("underline")
  }

  const handleBulletList = () => {
    editorRef.current?.toggleBulletList()
  }

  const handleNumberedList = () => {
    editorRef.current?.toggleNumberedList()
  }

  // Add this function to handle text changes
  const handleContentChange = (newContent: string) => {
    setDocumentContent(newContent)
  }

  // Add this function to handle format state changes
  const handleFormatStateChange = (newFormatState: FormatState) => {
    setFormatState(newFormatState)
  }

  // Add this function to handle cursor position
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      setCursorPosition(range.startOffset)
    }
  }

  // Add this style tag before the return statement
  const editorStyles = `
  .prose [contenteditable]:focus {
    caret-color: #374151;
  }
  
  .prose [contenteditable] {
    caret-color: #374151;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .blinking-cursor::after {
    content: '|';
    animation: blink 1s infinite;
    color: #374151;
  }
`

  return (
    <div className="flex h-screen bg-white overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />

      {/* Floating Sidebar */}
      <FloatingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Top header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/")}
                className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center hover:bg-teal-700 transition-colors cursor-pointer"
              >
                <span className="text-white font-bold text-xs">W</span>
              </button>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-4 h-4" />
              </Button>
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingTitle(false)
                  }
                }}
                className="text-gray-900 bg-transparent border-none outline-none focus:outline-none font-medium max-w-xs"
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <span
                className="text-gray-600 cursor-pointer hover:text-gray-900 transition-colors truncate max-w-xs"
                onClick={() => setIsEditingTitle(true)}
              >
                {documentTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setGoalsModalOpen(true)}>
              <Target className="w-4 h-4" />
              Content Goals
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPerformanceModalOpen(true)}>
              <BarChart3 className="w-4 h-4" />
              Overall score
            </Button>
          </div>

          <div></div>
        </div>

        {/* Editor content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Text editor */}
          <div className="flex-1 p-8 overflow-auto">
            <div className="prose max-w-none w-full">
              <EditableContent
                ref={editorRef}
                initialContent={documentContent}
                onContentChange={handleContentChange}
                onFormatStateChange={handleFormatStateChange}
              />
            </div>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div
          className={`fixed bottom-0 left-0 right-0 ${rightPanelCollapsed ? "lg:right-16" : "lg:right-80"} bg-white border-t border-gray-200 p-4`}
        >
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBold}
                className={formatState.isBold ? "bg-gray-200" : ""}
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleItalic}
                className={formatState.isItalic ? "bg-gray-200" : ""}
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUnderline}
                className={formatState.isUnderlined ? "bg-gray-200" : ""}
              >
                <Underline className="w-4 h-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="sm" className="gap-1">
                H1 <ChevronDown className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="gap-1">
                H2 <ChevronDown className="w-3 h-3" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="icon">
                <Link className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBulletList}
                className={formatState.isBulletList ? "bg-gray-200" : ""}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNumberedList}
                className={formatState.isNumberedList ? "bg-gray-200" : ""}
              >
                <ListOrdered className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Type className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-sm text-gray-500 hover:text-gray-700">
                    <span>{documentContent.split(/\s+/).filter((word) => word.length > 0).length} words</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-3">
                    <div className="bg-gray-100 px-3 py-2 rounded-md">
                      <span className="font-medium text-gray-900">
                        {documentContent.split(/\s+/).filter((word) => word.length > 0).length} words
                      </span>
                    </div>

                    <div className="text-sm text-gray-700">{documentContent.length} characters</div>

                    <div className="text-sm text-gray-700">
                      {Math.max(
                        1,
                        Math.ceil(documentContent.split(/\s+/).filter((word) => word.length > 0).length / 200),
                      )}{" "}
                      sec reading time
                    </div>

                    <div className="text-sm text-gray-700">
                      {Math.max(
                        1,
                        Math.ceil(documentContent.split(/\s+/).filter((word) => word.length > 0).length / 150),
                      )}{" "}
                      sec speaking time
                    </div>

                    <div className="text-sm text-gray-700">
                      Readability score —{" "}
                      {documentContent.split(/\s+/).filter((word) => word.length > 0).length < 10
                        ? "not enough text"
                        : "good"}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Collapsible */}
      <div
        className={`${rightPanelCollapsed ? "w-16" : "w-80"} min-w-${rightPanelCollapsed ? "16" : "80"} border-l border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out`}
      >
        {/* Collapse/Expand Button */}
        <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 z-30">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className="w-12 h-12 bg-white border-2 border-gray-400 shadow-xl hover:bg-gray-50 hover:shadow-2xl transition-all duration-200 rounded-full"
          >
            {rightPanelCollapsed ? (
              <ChevronRight className="w-8 h-8 text-gray-700" />
            ) : (
              <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </Button>
        </div>

        {rightPanelCollapsed ? (
          /* Collapsed Panel */
          <div className="flex flex-col items-center py-4 space-y-4">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-2 py-1 h-auto whitespace-nowrap transform -rotate-90 origin-center w-32 mt-8">
              CORRECT WITH ASSISTANT
            </Button>

            <div className="flex flex-col items-center space-y-3 mt-8">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center mb-1">
                  <span className="text-white text-xs font-medium">11</span>
                </div>
                <span className="text-xs text-gray-600 text-center leading-tight transform -rotate-90 origin-center w-16">
                  SUGGESTIONS
                </span>
              </div>

              <div className="flex flex-col items-center mt-6">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mb-1">
                  <span className="text-white text-xs font-medium">13</span>
                </div>
                <span className="text-xs text-gray-600 text-center leading-tight transform -rotate-90 origin-center w-16">
                  PRO
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded Panel */
          <>
            {/* Main tabs */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveMainTab("review")}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 ${
                    activeMainTab === "review"
                      ? "border-teal-500 text-teal-600 bg-teal-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                    <span className="text-center leading-tight">Review</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("smart-revise")}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 ${
                    activeMainTab === "smart-revise"
                      ? "border-teal-500 text-teal-600 bg-teal-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-center leading-tight">Smart Revise</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab("ai-write")}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 ${
                    activeMainTab === "ai-write"
                      ? "border-teal-500 text-teal-600 bg-teal-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-center leading-tight">AI Write</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Tab content - keep all existing tab content exactly the same */}
            {activeMainTab === "review" && (
              <div className="flex-1 flex flex-col">
                {/* Review suggestions header */}
                <div className="p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Review suggestions</h2>
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">6</span>
                    </div>
                  </div>

                  {/* Category tabs */}
                  <div className="grid grid-cols-4 gap-2">
                    {tabs.map((tab) => (
                      <div key={tab.id} className="text-center">
                        <div className="h-2 bg-gray-200 rounded-full mb-2">
                          <div className={`h-full ${tab.color} rounded-full`} style={{ width: `${tab.score}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-600 break-words">{tab.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggestions list */}
                <div className="flex-1 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm mb-1 break-words">{suggestion.title}</div>
                            <div className="text-sm font-medium text-gray-700 mb-1 break-words">{suggestion.word}</div>
                            {suggestion.id === 1 && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                  <span className="break-words">{suggestion.description}</span>
                                  <Info className="w-3 h-3 flex-shrink-0" />
                                </div>
                                <div className="text-sm text-gray-700 mb-3 break-words">{suggestion.preview}</div>
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                                    Accept
                                  </Button>
                                  <Button size="sm" variant="outline">
                                    Dismiss
                                  </Button>
                                  <Button size="sm" variant="ghost" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeMainTab === "smart-revise" && (
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="font-medium text-gray-900 mb-2">Smart Revise</h3>
                    <p className="text-sm text-gray-500 break-words">
                      Revise your script with our smart actions to maximize views, comments, shares, and virality.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => console.log("Shorten script")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Shorten script to under 30 seconds</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => console.log("Write viral hook")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Write a viral hook</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => console.log("Rewrite conversational")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Rewrite to be more conversational</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => console.log("Add onscreen text")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Add suggestions for onscreen text</span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={() => console.log("Add delivery tips")}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Add tips for verbal delivery</span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeMainTab === "ai-write" && (
              <div className="flex-1 flex flex-col">
                {/* Chat messages area */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center max-w-full px-4">
                      <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">What do you want to do?</h3>
                      <p className="text-sm text-gray-500 break-words">
                        Start a conversation to get AI assistance with your writing
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chat input area */}
                <div className="border-t border-gray-200 p-4 flex-shrink-0">
                  <div className="flex gap-2">
                    <textarea
                      value={aiChatInput}
                      onChange={(e) => setAiChatInput(e.target.value)}
                      placeholder="Ask for any revision"
                      className="flex-1 min-w-0 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          if (aiChatInput.trim()) {
                            // Handle send message here
                            console.log("Send message:", aiChatInput)
                            setAiChatInput("")
                          }
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!aiChatInput.trim()}
                      className="self-end bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 flex-shrink-0"
                      onClick={() => {
                        if (aiChatInput.trim()) {
                          // Handle send message here
                          console.log("Send message:", aiChatInput)
                          setAiChatInput("")
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Modals */}
      <ContentGoalsModal open={goalsModalOpen} onOpenChange={setGoalsModalOpen} />
      <PerformanceModal
        open={performanceModalOpen}
        onOpenChange={setPerformanceModalOpen}
        documentContent={documentContent}
      />
    </div>
  )
}
