"use client"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  X,
  Home,
  Plus,
  Upload,
  Download,
  Printer,
  History,
  Undo,
  Redo,
  Scissors,
  Copy,
  Clipboard,
  MousePointer,
  Settings,
  Diamond,
  Flag,
  ChevronRight
} from "lucide-react"
import { useRouter } from "next/navigation"

interface FloatingSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function FloatingSidebar({ isOpen, onClose }: FloatingSidebarProps) {
  const router = useRouter()

  const handleMyViralVision = () => {
    router.push("/dashboard")
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="animate-in fade-in fixed inset-0 z-40 bg-black bg-opacity-50 duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="animate-in slide-in-from-left fixed left-0 top-0 z-50 h-full w-80 overflow-y-auto bg-white shadow-xl duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 gap-2 text-gray-600 hover:text-gray-900"
          >
            <X className="size-4" />
            Close
          </Button>
        </div>

        {/* My ViralVision */}
        <div className="px-4 py-3">
          <Button
            variant="ghost"
            className="h-8 w-full justify-start gap-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            onClick={handleMyViralVision}
          >
            <Home className="size-4" />
            My ViralVision
          </Button>
        </div>

        {/* Document Section */}
        <div className="px-4 pb-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Document
          </div>
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="size-4" />
              New document
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Upload className="size-4" />
                Upload file
              </div>
              <span className="text-xs text-gray-500">
                .docx, .odt, .rtf, .txt
              </span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Download className="size-4" />
                Download
              </div>
              <span className="text-xs text-gray-500">as .docx</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Printer className="size-4" />
                Print
              </div>
              <span className="text-xs text-gray-500">⌘+P</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <History className="size-4" />
              Version history
            </Button>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Edit Section */}
        <div className="px-4 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Edit
          </div>
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Undo className="size-4" />
                Undo
              </div>
              <span className="text-xs text-gray-500">⌘+Z</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Redo className="size-4" />
                Redo
              </div>
              <span className="text-xs text-gray-500">⌘+Y</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Scissors className="size-4" />
                Cut
              </div>
              <span className="text-xs text-gray-500">⌘+X</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Copy className="size-4" />
                Copy
              </div>
              <span className="text-xs text-gray-500">⌘+C</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <Clipboard className="size-4" />
                Paste
              </div>
              <span className="text-xs text-gray-500">⌘+V</span>
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-between text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <div className="flex items-center gap-3">
                <MousePointer className="size-4" />
                Select all
              </div>
              <span className="text-xs text-gray-500">⌘+A</span>
            </Button>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Tools Section */}
        <div className="px-4 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Tools
          </div>
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <Settings className="size-4" />
              Settings
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <Diamond className="size-4" />
              Premium features
            </Button>

            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <Flag className="size-4" />
              Report issue
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-gray-200 p-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>ViralVision v1.0</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
            >
              Help
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
