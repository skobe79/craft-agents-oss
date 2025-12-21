import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import loader from '@monaco-editor/loader'
import * as monaco from 'monaco-editor'
import { BookOpen, PenLine } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { CodePreviewData } from '../../../shared/types'

// Configure loader to use local monaco-editor package (not CDN)
// This is required because CSP blocks external scripts from cdn.jsdelivr.net
loader.config({ monaco })

interface CodePreviewAppProps {
  sessionId: string
  previewId: string
}

/**
 * CodePreviewApp - Monaco editor for viewing file content (Read/Write tools)
 */
export function CodePreviewApp({ sessionId, previewId }: CodePreviewAppProps) {
  const { resolvedMode } = useTheme()
  const [data, setData] = useState<CodePreviewData | null>(null)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch code data on mount
  useEffect(() => {
    async function fetchData() {
      if (!sessionId || !previewId) {
        setError('Missing session or preview ID')
        return
      }

      if (!window.electronAPI?.getCodePreviewData) {
        setError('API not available')
        return
      }

      try {
        const result = await window.electronAPI.getCodePreviewData(sessionId, previewId)
        if (!result) {
          setError('Code data not found')
          return
        }
        setData(result)
      } catch (err) {
        setError(String(err))
      }
    }

    fetchData()
  }, [sessionId, previewId])

  // Monaco mounted callback
  const handleEditorMount = useCallback(() => {
    requestAnimationFrame(() => {
      setIsEditorReady(true)
    })
  }, [])

  // Detect language from file extension
  const getLanguage = useCallback((filePath: string, explicit?: string): string => {
    if (explicit) return explicit

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
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
    }
    return languageMap[ext || ''] || 'plaintext'
  }, [])

  // Format file path for display (show relative path if possible)
  const formatFilePath = useCallback((filePath: string): string => {
    const homeMatch = filePath.match(/^\/Users\/[^/]+\/(.+)$/)
    if (homeMatch) {
      return `~/${homeMatch[1]}`
    }
    return filePath
  }, [])

  // Monaco theme backgrounds
  const monacoBackground = resolvedMode === 'dark' ? '#1e1e1e' : '#ffffff'
  const toolbarBorder = resolvedMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'

  // Mode indicator styling
  const modeConfig = data?.mode === 'write'
    ? { Icon: PenLine, label: 'Write', bgColor: 'rgba(34, 197, 94, 0.15)', textColor: 'rgb(34, 197, 94)' }
    : { Icon: BookOpen, label: 'Read', bgColor: 'rgba(59, 130, 246, 0.15)', textColor: 'rgb(59, 130, 246)' }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: monacoBackground }}>
        {/* Toolbar / Title bar */}
        <div
          className="titlebar-drag-region h-[52px] shrink-0 flex items-center justify-between px-4"
          style={{ borderBottom: `1px solid ${toolbarBorder}` }}
        >
          {/* Left side - space for traffic lights on macOS */}
          <div className="w-[70px]" />

          {/* Center - file path + mode badge + line info */}
          <div className="flex items-center gap-3">
            {data && (
              <>
                {/* Mode badge */}
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                  style={{ backgroundColor: modeConfig.bgColor, color: modeConfig.textColor }}
                >
                  <modeConfig.Icon className="w-3.5 h-3.5" />
                  {modeConfig.label}
                </div>
                {/* File path */}
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: resolvedMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    color: resolvedMode === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  }}
                >
                  {formatFilePath(data.filePath)}
                </span>
                {/* Line info badge (for partial reads) */}
                {data.startLine !== undefined && data.totalLines !== undefined && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: resolvedMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: resolvedMode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    Lines {data.startLine}–{data.startLine + (data.numLines || 0) - 1} of {data.totalLines}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Right side - placeholder for future actions */}
          <div className="w-[70px]" />
        </div>

        {/* Error overlay */}
        {error && (
          <div className="flex-1 flex items-center justify-center text-destructive">
            Error: {error}
          </div>
        )}

        {/* Code Editor with fade-in */}
        {data && !error && (
          <div
            className="flex-1 min-h-0 transition-opacity duration-200"
            style={{ opacity: isEditorReady ? 1 : 0, backgroundColor: monacoBackground }}
          >
            <Editor
              height="100%"
              language={getLanguage(data.filePath, data.language)}
              theme={resolvedMode === 'dark' ? 'vs-dark' : 'vs'}
              value={data.content}
              onMount={handleEditorMount}
              loading={null}
              options={{
                // Typography
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 13,
                lineHeight: 1.6,
                wordWrap: 'on',

                // Read-only mode
                readOnly: true,

                // Layout
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },

                // Show line numbers
                lineNumbers: 'on',
                lineNumbersMinChars: 4,

                // Hide right-side indicators
                overviewRulerLanes: 0,
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                renderLineHighlight: 'none',

                // Clean scrollbar
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                  useShadows: false,
                },

                // Disable code-editor features
                occurrencesHighlight: 'off',
                selectionHighlight: false,
                renderWhitespace: 'selection',
                matchBrackets: 'never',

                // Disable gutter decorations
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 0,
              }}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
