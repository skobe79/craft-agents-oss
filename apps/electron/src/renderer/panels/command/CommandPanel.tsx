import React, { useState, useRef, useEffect } from 'react'
import { Send, Square, Terminal, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type CommandPanelProps = {
  onRunCommand?: (command: string) => void
}

export function CommandPanel({ onRunCommand }: CommandPanelProps) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<
    { id: string; command: string; status: 'running' | 'success' | 'error'; output?: string }[]
  >([])
  const [isRunning, setIsRunning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleRun = () => {
    const trimmed = command.trim()
    if (!trimmed || isRunning) return

    const id = `cmd-${Date.now()}`
    setHistory((prev) => [...prev, { id, command: trimmed, status: 'running' }])
    setIsRunning(true)
    onRunCommand?.(trimmed)

    setTimeout(() => {
      setHistory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'success',
                output: `Executed: ${trimmed}\n✓ Completed successfully`,
              }
            : item,
        ),
      )
      setIsRunning(false)
      setCommand('')
      inputRef.current?.focus()
    }, 1500)
  }

  const handleStop = () => {
    setIsRunning(false)
    setHistory((prev) =>
      prev.map((item) =>
        item.status === 'running' ? { ...item, status: 'error', output: '✗ Stopped by user' } : item,
      ),
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div className="command-panel">
      <div className="command-panel__header">
        <div className="command-panel__title">
          <Terminal size={20} />
          <h2>Command</h2>
        </div>
        <div className="command-panel__actions">
          {isRunning && (
            <button type="button" className="command-panel__stop" onClick={handleStop}>
              <Square size={14} />
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="command-panel__output">
        {history.length === 0 && (
          <div className="command-panel__empty">
            <Terminal size={48} />
            <p>No commands run yet</p>
            <span>Type a command and press Enter to execute</span>
          </div>
        )}
        {history.map((item) => (
          <div key={item.id} className="command-panel__entry">
            <div className="command-panel__entry-header">
              <div className="command-panel__entry-status">
                {item.status === 'running' && <Loader2 size={14} className="command-panel__spinner" />}
                {item.status === 'success' && <CheckCircle2 size={14} className="command-panel__success" />}
                {item.status === 'error' && <XCircle size={14} className="command-panel__error" />}
                <span className="command-panel__entry-command">{item.command}</span>
              </div>
            </div>
            {item.output && (
              <div className="command-panel__entry-output">
                <pre>{item.output}</pre>
              </div>
            )}
            <div ref={outputRef} />
          </div>
        ))}
      </div>

      <div className="command-panel__input">
        <ChevronRight size={16} className="command-panel__input-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
        />
        <button
          type="button"
          className="command-panel__send"
          onClick={handleRun}
          disabled={isRunning || !command.trim()}
          title="Run command"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
