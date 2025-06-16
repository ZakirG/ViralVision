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
  ChevronRight,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface FloatingSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function FloatingSidebar({ isOpen, onClose }: FloatingSidebarProps) {
  const router = useRouter()

  const handleMyWordWise = () => {
    router.push("/")
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-300" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 overflow-y-auto animate-in slide-in-from-left duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-2 text-gray-600 hover:text-gray-900 h-7">
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>

        {/* My WordWise */}
        <div className="px-4 py-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8"
            onClick={handleMyWordWise}
          >
            <Home className="w-4 h-4" />
            My WordWise
          </Button>
        </div>

        {/* Document Section */}
        <div className="px-4 pb-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Document</div>
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <Plus className="w-4 h-4" />
              New document
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4" />
                Upload file
              </div>
              <span className="text-xs text-gray-500">.docx, .odt, .rtf, .txt</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4" />
                Download
              </div>
              <span className="text-xs text-gray-500">as .docx</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Printer className="w-4 h-4" />
                Print
              </div>
              <span className="text-xs text-gray-500">⌘+P</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <History className="w-4 h-4" />
              Version history
            </Button>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Edit Section */}
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Edit</div>
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Undo className="w-4 h-4" />
                Undo
              </div>
              <span className="text-xs text-gray-500">⌘+Z</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Redo className="w-4 h-4" />
                Redo
              </div>
              <span className="text-xs text-gray-500">⌘+Y</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Scissors className="w-4 h-4" />
                Cut
              </div>
              <span className="text-xs text-gray-500">⌘+X</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Copy className="w-4 h-4" />
                Copy
              </div>
              <span className="text-xs text-gray-500">⌘+C</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Clipboard className="w-4 h-4" />
                Paste
              </div>
              <span className="text-xs text-gray-500">⌘+V</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <MousePointer className="w-4 h-4" />
                Select all
              </div>
              <span className="text-xs text-gray-500">⌘+A</span>
            </Button>
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Editor Settings */}
        <div className="px-4 py-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
          >
            <Settings className="w-4 h-4" />
            Editor settings
          </Button>
        </div>

        <Separator className="mx-4" />

        {/* Account Section */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account</div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Free</span>
          </div>

          <div className="mb-3">
            <div className="font-medium text-gray-900 text-sm">Zakir Gowani</div>
            <div className="text-xs text-gray-500">zakirgowani@gmail.com</div>
          </div>

          <div className="space-y-0.5">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <Diamond className="w-4 h-4" />
              Get Pro
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <div className="flex items-center gap-3">
                <Flag className="w-4 h-4" />
                Language preference
              </div>
              <ChevronRight className="w-3 h-3" />
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-700 hover:text-gray-900 hover:bg-gray-50 h-8 text-sm"
            >
              <span className="w-4 h-4 flex items-center justify-center text-sm">💳</span>
              Subscription
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
