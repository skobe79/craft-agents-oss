/**
 * MainContentPanel - Right panel component for tab-based content display
 *
 * Wraps the TabContainer to provide a consistent interface for the main content area.
 * This is the primary workspace where chat conversations, source info, settings, etc. are displayed.
 *
 * Layout:
 * ┌────────────────────────────┐
 * │ TabHeader (title, actions) │
 * ├────────────────────────────┤
 * │                            │
 * │   TabContent               │
 * │   (lazy-loaded panels)     │
 * │                            │
 * └────────────────────────────┘
 */

import * as React from 'react'
import { TabContainer } from '@/tabs'

export interface MainContentPanelProps {
  /** Whether the app is in focused mode (single chat, no sidebar) */
  isFocusedMode?: boolean
  /** Optional className for the container */
  className?: string
}

export function MainContentPanel({
  isFocusedMode = false,
  className,
}: MainContentPanelProps) {
  return (
    <div className={`flex-1 overflow-hidden min-w-0 bg-background shadow-middle rounded-[14px] ${className || ''}`}>
      <TabContainer isFocusedMode={isFocusedMode} />
    </div>
  )
}
