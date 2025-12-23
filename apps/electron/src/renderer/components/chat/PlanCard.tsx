/**
 * PlanCard - Inline plan message component
 *
 * Displays a plan submitted by the agent for user review.
 * Uses the same markdown rendering and max height as TurnCard responses.
 * Includes a simple Approve button that inserts "Go ahead" into the chat input.
 */

import * as React from 'react'
import { useState } from 'react'
import { Check, ListTodo, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/markdown'
import type { Message } from '../../../shared/types'

// ============================================================================
// Size Configuration (matches TurnCard)
// ============================================================================

const SIZE_CONFIG = {
  fontSize: 'text-[13px]',
  iconSize: 'w-3 h-3',
} as const

// ============================================================================
// Types
// ============================================================================

export interface PlanCardProps {
  /** The plan message */
  message: Message
  /** Callback to open file in editor */
  onOpenFile?: (path: string) => void
  /** Callback to open URL */
  onOpenUrl?: (url: string) => void
  /** Whether a user message has been sent after this plan (hides the approve footer) */
  hasUserResponse?: boolean
}

// ============================================================================
// PlanCard Component
// ============================================================================

export function PlanCard({
  message,
  onOpenFile,
  onOpenUrl,
  hasUserResponse = false,
}: PlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Insert "Go ahead" into the chat input using a custom event
  // This is a generic mechanism that can be extended for other deeplink-style actions
  const handleApprove = () => {
    window.dispatchEvent(new CustomEvent('craft:insert-text', {
      detail: { text: 'Go ahead' }
    }))
  }

  const MAX_HEIGHT = 540

  return (
    <div className="bg-white shadow-minimal rounded-[8px] overflow-hidden">
      {/* Header with plan indicator */}
      <div
        className={cn(
          "px-4 py-2 border-b border-border/30 flex items-center gap-2 bg-emerald-500/5 cursor-pointer",
          SIZE_CONFIG.fontSize
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ListTodo className={cn(SIZE_CONFIG.iconSize, "text-emerald-700")} />
        <span className="font-medium text-emerald-700">Plan</span>
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronDown className={cn(SIZE_CONFIG.iconSize, "text-muted-foreground")} />
        ) : (
          <ChevronRight className={cn(SIZE_CONFIG.iconSize, "text-muted-foreground")} />
        )}
      </div>

      {/* Content area */}
      {isExpanded && (
        <>
          <div
            className="pl-[22px] pr-4 py-3 text-sm overflow-y-auto"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            <Markdown
              mode="minimal"
              onUrlClick={onOpenUrl}
              onFileClick={onOpenFile}
            >
              {message.content}
            </Markdown>
          </div>

          {/* Footer with Approve button - only shown until user responds */}
          {!hasUserResponse && (
            <div className={cn(
              "pl-4 pr-2.5 py-2 border-t border-border/30 flex items-center justify-end gap-3 bg-muted/20",
              SIZE_CONFIG.fontSize
            )}>
              <span className="text-xs text-muted-foreground">
                Type your feedback in chat or
              </span>
              <button
                type="button"
                onClick={handleApprove}
                className="h-[28px] pl-2.5 pr-2.5 text-xs font-medium rounded-[6px] flex items-center gap-1.5 transition-all bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 shadow-tinted"
                style={{ '--shadow-color': '6, 95, 70' } as React.CSSProperties}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Approve</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
