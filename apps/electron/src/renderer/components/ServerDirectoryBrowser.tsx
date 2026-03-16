import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRegisterModal } from '@/context/ModalContext'
import type { DirectoryListingResult } from '../../shared/types'
import { FolderIcon, FolderSymlinkIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react'

interface ServerDirectoryBrowserProps {
  open: boolean
  mode: 'browse' | 'manual'
  onSelect: (path: string) => void
  onCancel: () => void
  initialPath?: string
}

export function ServerDirectoryBrowser({
  open,
  mode,
  onSelect,
  onCancel,
  initialPath,
}: ServerDirectoryBrowserProps) {
  useRegisterModal(open, onCancel)

  const [listing, setListing] = useState<DirectoryListingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Navigate to a directory (for browse mode)
  const navigateTo = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError(null)
    setSelectedEntry(null)
    try {
      const result = await window.electronAPI.listServerDirectory(dirPath)
      setListing(result)
      setPathInput(result.currentPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list directory'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load initial directory when opened
  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setListing(null)
      setError(null)
      setSelectedEntry(null)
      setPathInput('')
      return
    }

    if (mode === 'browse') {
      const loadInitial = async () => {
        const startPath = initialPath || await window.electronAPI.getHomeDir()
        void navigateTo(startPath)
      }
      void loadInitial()
    }
  }, [open, mode, initialPath, navigateTo])

  // Handle path input submission (Enter key or navigate button)
  const handlePathSubmit = useCallback(() => {
    const trimmed = pathInput.trim()
    if (!trimmed) return

    if (mode === 'browse') {
      void navigateTo(trimmed)
    } else {
      // Manual mode — just select the path
      onSelect(trimmed)
    }
  }, [pathInput, mode, navigateTo, onSelect])

  // Handle selecting the current directory (or highlighted entry)
  const handleSelect = useCallback(() => {
    if (selectedEntry) {
      onSelect(selectedEntry)
    } else if (listing) {
      onSelect(listing.currentPath)
    } else if (pathInput.trim()) {
      onSelect(pathInput.trim())
    }
  }, [selectedEntry, listing, pathInput, onSelect])

  // Handle double-click on an entry to navigate into it
  const handleEntryDoubleClick = useCallback((entryPath: string) => {
    void navigateTo(entryPath)
  }, [navigateTo])

  // Handle single-click to select an entry
  const handleEntryClick = useCallback((entryPath: string) => {
    setSelectedEntry(prev => prev === entryPath ? null : entryPath)
  }, [])

  // Browse mode content
  const renderBrowseMode = () => (
    <>
      {/* Path input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={pathInput}
          onChange={e => setPathInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handlePathSubmit()
          }}
          placeholder="Enter path..."
          className="flex-1 font-mono text-xs"
        />
        <Button variant="outline" size="sm" onClick={handlePathSubmit} disabled={loading}>
          Go
        </Button>
      </div>

      {/* Breadcrumbs */}
      {listing && (
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground overflow-x-auto py-1 min-h-[24px]">
          {listing.breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground/50" />}
              <button
                type="button"
                onClick={() => navigateTo(crumb.path)}
                className="hover:text-foreground hover:underline transition-colors px-0.5"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Directory listing */}
      <div className="border border-foreground/10 rounded-md overflow-hidden flex-1 min-h-0">
        <div className="overflow-y-auto max-h-[300px]">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin mr-2" />
              Loading...
            </div>
          )}

          {error && (
            <div className="px-3 py-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && listing && listing.entries.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No subdirectories. Use the path input above to navigate.
            </div>
          )}

          {!loading && !error && listing && listing.entries.map(entry => (
            <button
              key={entry.path}
              type="button"
              onClick={() => handleEntryClick(entry.path)}
              onDoubleClick={() => handleEntryDoubleClick(entry.path)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-foreground/5 transition-colors ${
                selectedEntry === entry.path ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              {entry.isSymlink
                ? <FolderSymlinkIcon className="size-4 shrink-0 text-muted-foreground" />
                : <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              }
              <span className="truncate">{entry.name}</span>
              {entry.isSymlink && (
                <span className="text-xs text-muted-foreground/60 shrink-0">symlink</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  // Manual mode content
  const renderManualMode = () => (
    <>
      <p className="text-sm text-muted-foreground">
        Enter the full path on the server:
      </p>
      <Input
        ref={inputRef}
        value={pathInput}
        onChange={e => setPathInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSelect()
        }}
        placeholder="/Users/username/projects/my-project"
        className="font-mono text-xs"
        autoFocus
      />
    </>
  )

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onCancel() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Server Directory</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {mode === 'browse' ? renderBrowseMode() : renderManualMode()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={mode === 'manual' ? !pathInput.trim() : (!listing && !pathInput.trim())}
          >
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
