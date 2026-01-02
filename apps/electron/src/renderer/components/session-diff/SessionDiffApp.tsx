import * as React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import loader from '@monaco-editor/loader'
import * as monaco from 'monaco-editor'
import { File, PencilLine, FilePlus, ChevronRight, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { WindowHeader, WindowHeaderBadge, BADGE_CONFIGS } from '@/components/ui/window-header-badge'
import type { SessionDiffData, FileChange } from '../../../shared/types'

// Configure loader to use local monaco-editor package (not CDN)
loader.config({ monaco })

interface SessionDiffAppProps {
  sessionId: string
  turnId: string
}

/**
 * Get language for Monaco from file extension
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile',
    toml: 'toml',
  }
  return languageMap[ext || ''] || 'plaintext'
}

/**
 * Format file path for display (shorter, relative-like paths)
 */
function formatFilePath(filePath: string): string {
  const homeMatch = filePath.match(/^\/Users\/[^/]+\/(.+)$/)
  if (homeMatch) {
    return `~/${homeMatch[1]}`
  }
  return filePath
}

/**
 * Get just the filename from a path
 */
function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

/**
 * Group files by directory for tree view
 */
function groupFilesByDirectory(changes: FileChange[]): Map<string, FileChange[]> {
  const groups = new Map<string, FileChange[]>()

  for (const change of changes) {
    const parts = change.filePath.split('/')
    const dir = parts.slice(0, -1).join('/') || '/'
    const existing = groups.get(dir) || []
    existing.push(change)
    groups.set(dir, existing)
  }

  return groups
}

interface FileTreeItemProps {
  change: FileChange
  isSelected: boolean
  onClick: () => void
}

function FileTreeItem({ change, isSelected, onClick }: FileTreeItemProps) {
  const fileName = getFileName(change.filePath)
  const isWrite = change.toolType === 'Write'
  const hasError = !!change.error

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm rounded-md transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        hasError && "text-destructive"
      )}
    >
      {isWrite ? (
        <FilePlus className="w-4 h-4 shrink-0 text-green-500" />
      ) : (
        <PencilLine className="w-4 h-4 shrink-0 text-blue-500" />
      )}
      <span className="truncate flex-1">{fileName}</span>
      {hasError && <XCircle className="w-3 h-3 shrink-0 text-destructive" />}
    </button>
  )
}

interface FileTreeProps {
  changes: FileChange[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function FileTree({ changes, selectedId, onSelect }: FileTreeProps) {
  const groups = useMemo(() => groupFilesByDirectory(changes), [changes])
  const sortedDirs = useMemo(() =>
    Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)),
    [groups]
  )

  // If all files are in the same directory, show flat list
  if (sortedDirs.length === 1) {
    return (
      <div className="space-y-0.5">
        {changes.map(change => (
          <FileTreeItem
            key={change.id}
            change={change}
            isSelected={selectedId === change.id}
            onClick={() => onSelect(change.id)}
          />
        ))}
      </div>
    )
  }

  // Show grouped by directory
  return (
    <div className="space-y-2">
      {sortedDirs.map(dir => {
        const files = groups.get(dir) || []
        const shortDir = formatFilePath(dir)

        return (
          <div key={dir}>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground/70 truncate" title={dir}>
              {shortDir}
            </div>
            <div className="space-y-0.5">
              {files.map(change => (
                <FileTreeItem
                  key={change.id}
                  change={change}
                  isSelected={selectedId === change.id}
                  onClick={() => onSelect(change.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * SessionDiffApp - Shows all file changes in a turn with VS Code-style file tree + diff viewer
 */
export function SessionDiffApp({ sessionId, turnId }: SessionDiffAppProps) {
  const { resolvedMode } = useTheme()
  const [data, setData] = useState<SessionDiffData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'snippet' | 'full'>('snippet')
  const [fullFileContent, setFullFileContent] = useState<{ original: string; modified: string } | null>(null)
  const [isLoadingFullFile, setIsLoadingFullFile] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      if (!sessionId || !turnId) {
        setError('Missing session or turn ID')
        return
      }

      if (!window.electronAPI?.getSessionDiffData) {
        setError('API not available')
        return
      }

      try {
        const result = await window.electronAPI.getSessionDiffData(sessionId, turnId)
        if (!result) {
          setError('Session diff data not found')
          return
        }
        setData(result)
        // Select first file by default
        if (result.changes.length > 0) {
          setSelectedId(result.changes[0].id)
        }
      } catch (err) {
        setError(String(err))
      }
    }

    fetchData()
  }, [sessionId, turnId])

  // Get currently selected change
  const selectedChange = useMemo(() => {
    if (!data || !selectedId) return null
    return data.changes.find(c => c.id === selectedId) || null
  }, [data, selectedId])

  // Load full file content when switching to full view mode
  useEffect(() => {
    if (viewMode !== 'full' || !selectedChange) {
      setFullFileContent(null)
      return
    }

    async function loadFullFile() {
      if (!selectedChange) return

      setIsLoadingFullFile(true)
      try {
        const currentContent = await window.electronAPI?.readFileForDiff(selectedChange.filePath)

        if (currentContent === null) {
          // File doesn't exist or can't be read - fall back to snippet view
          setViewMode('snippet')
          return
        }

        // For Edit: current file is "after", reconstruct "before" by replacing new_string with old_string
        // For Write: current file is "after", "before" is empty (new file)
        let originalContent: string
        let modifiedContent: string = currentContent

        if (selectedChange.toolType === 'Edit') {
          // Reconstruct the original by replacing new_string with old_string
          originalContent = currentContent.replace(selectedChange.modified, selectedChange.original)
        } else {
          // Write tool - new file
          originalContent = ''
        }

        setFullFileContent({ original: originalContent, modified: modifiedContent })
      } catch (err) {
        console.error('Failed to load full file:', err)
        setViewMode('snippet')
      } finally {
        setIsLoadingFullFile(false)
      }
    }

    loadFullFile()
  }, [viewMode, selectedChange])

  // Monaco mounted callback
  const handleEditorMount = useCallback(() => {
    requestAnimationFrame(() => {
      setIsEditorReady(true)
    })
  }, [])

  // Handle file selection
  const handleSelectFile = useCallback((id: string) => {
    setSelectedId(id)
    setIsEditorReady(false) // Reset for transition
    setFullFileContent(null) // Reset full file content
  }, [])

  // Toggle view mode
  const handleToggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'snippet' ? 'full' : 'snippet')
  }, [])

  // Open file in default app
  const handleOpenFile = useCallback(() => {
    if (selectedChange?.filePath) {
      window.electronAPI?.openFile(selectedChange.filePath)
    }
  }, [selectedChange?.filePath])

  // Theme colors
  const isDark = resolvedMode === 'dark'
  const monacoBackground = isDark ? '#1e1e1e' : '#ffffff'
  const sidebarBackground = isDark ? '#252526' : '#f3f3f3'
  const toolbarBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'

  // Determine what to show in the diff editor
  const diffOriginal = viewMode === 'full' && fullFileContent
    ? fullFileContent.original
    : selectedChange?.original || ''
  const diffModified = viewMode === 'full' && fullFileContent
    ? fullFileContent.modified
    : selectedChange?.modified || ''

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: monacoBackground }}>
        {/* Header */}
        <WindowHeader borderColor={toolbarBorder}>
          {selectedChange && (
            <>
              <WindowHeaderBadge
                Icon={selectedChange.toolType === 'Write' ? FilePlus : PencilLine}
                label={selectedChange.toolType}
                {...(selectedChange.toolType === 'Write' ? BADGE_CONFIGS.write : BADGE_CONFIGS.edit)}
              />
              <WindowHeaderBadge
                label={formatFilePath(selectedChange.filePath)}
                onClick={handleOpenFile}
                {...(isDark ? BADGE_CONFIGS.neutralDark : BADGE_CONFIGS.neutralLight)}
              />

              {/* View mode toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleViewMode}
                    disabled={isLoadingFullFile}
                    className={cn(
                      "ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                      viewMode === 'full'
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50",
                      isLoadingFullFile && "opacity-50 cursor-wait"
                    )}
                  >
                    {viewMode === 'full' ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {viewMode === 'full' ? 'Full File' : 'Snippet'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {viewMode === 'full'
                    ? 'Showing full file context. Click to show snippet only.'
                    : 'Showing snippet only. Click to show full file context.'
                  }
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {!selectedChange && data && (
            <span className="text-sm text-muted-foreground">
              {data.changes.length} file{data.changes.length !== 1 ? 's' : ''} changed
            </span>
          )}
        </WindowHeader>

        {/* Error banner */}
        {selectedChange?.error && (
          <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-destructive/70 mb-0.5">
                {selectedChange.toolType} Failed
              </div>
              <p className="text-sm text-destructive whitespace-pre-wrap break-words">
                {selectedChange.error}
              </p>
            </div>
          </div>
        )}

        {/* Fetch error overlay */}
        {error && (
          <div className="flex-1 flex items-center justify-center text-destructive">
            Error: {error}
          </div>
        )}

        {/* Main content: Sidebar + Editor */}
        {data && !error && (
          <div className="flex-1 flex min-h-0">
            {/* File tree sidebar */}
            <div
              className="w-64 shrink-0 border-r overflow-y-auto"
              style={{
                backgroundColor: sidebarBackground,
                borderColor: toolbarBorder
              }}
            >
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Changed Files ({data.changes.length})
                </div>
                <FileTree
                  changes={data.changes}
                  selectedId={selectedId}
                  onSelect={handleSelectFile}
                />
              </div>
            </div>

            {/* Diff editor */}
            <div className="flex-1 min-w-0">
              {selectedChange ? (
                <div
                  className="h-full transition-opacity duration-200"
                  style={{
                    opacity: isEditorReady && !isLoadingFullFile ? 1 : 0.3,
                    backgroundColor: monacoBackground
                  }}
                >
                  <DiffEditor
                    height="100%"
                    language={getLanguageFromPath(selectedChange.filePath)}
                    theme={isDark ? 'vs-dark' : 'vs'}
                    original={diffOriginal}
                    modified={diffModified}
                    onMount={handleEditorMount}
                    loading={null}
                    options={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 13,
                      lineHeight: 1.6,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 16, bottom: 16 },
                      renderSideBySide: false,
                      enableSplitViewResizing: true,
                      renderOverviewRuler: true,
                      readOnly: true,
                      overviewRulerLanes: 3,
                      overviewRulerBorder: false,
                      hideCursorInOverviewRuler: true,
                      renderLineHighlight: 'none',
                      scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        useShadows: false,
                      },
                      lineNumbers: 'on',
                      lineNumbersMinChars: 4,
                      occurrencesHighlight: 'off',
                      selectionHighlight: false,
                      renderWhitespace: 'selection',
                      matchBrackets: 'never',
                    }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a file to view changes
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
