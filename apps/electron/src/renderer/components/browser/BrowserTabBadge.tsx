/**
 * BrowserTabBadge
 *
 * A compact badge showing a browser instance's favicon/hostname in the TopBar.
 * Clicking focuses the browser panel, and X ends the browser instance.
 */

import * as Icons from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@craft-agent/ui'
import type { BrowserInstanceInfo } from '../../../shared/types'
import { getHostname } from './utils'

interface BrowserTabBadgeProps {
  instance: BrowserInstanceInfo
  isActive: boolean
  onClick: () => void
  onClose: () => void
}

export function BrowserTabBadge({ instance, isActive, onClick, onClose }: BrowserTabBadgeProps) {
  const hostname = getHostname(instance.url)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            group flex items-center gap-1 h-[26px] pl-2 pr-1.5 rounded-md cursor-pointer select-none
            text-[11px] leading-tight transition-colors max-w-[160px]
            ${isActive
              ? 'bg-background text-foreground shadow-minimal'
              : 'bg-background text-foreground/60 hover:bg-foreground/[0.03] hover:text-foreground/85 shadow-minimal'
            }
            ${instance.isVisible ? '' : 'opacity-70'}
          `}
          onClick={onClick}
        >
          {/* Favicon or loading spinner */}
          <span className="shrink-0">
            {instance.isLoading ? (
              <Icons.Loader2 className="h-3 w-3 animate-spin text-accent" />
            ) : instance.favicon ? (
              <img src={instance.favicon} alt="" className="h-3 w-3 rounded-sm" />
            ) : (
              <Icons.Globe className="h-3 w-3" />
            )}
          </span>

          {/* Hostname */}
          <span className="truncate ml-0.5">{hostname}</span>

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-foreground/10 transition-opacity"
            aria-label="End browser session"
          >
            <Icons.X className="h-2.5 w-2.5" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {instance.title || hostname}
        {!instance.isVisible ? ' • Hidden (running)' : ''}
      </TooltipContent>
    </Tooltip>
  )
}
