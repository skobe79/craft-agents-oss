/**
 * NavigatorPanel - Middle panel component for list-based navigation
 *
 * Displays a header with title/subtitle, optional action buttons, and
 * renders children (SessionList or SourcesListPanel) in a scrollable area.
 *
 * Layout:
 * ┌────────────────────────────┐
 * │ Header (title, subtitle)   │
 * │ + action buttons           │
 * ├────────────────────────────┤
 * │                            │
 * │   children (list content)  │
 * │                            │
 * └────────────────────────────┘
 */

import * as React from 'react'
import { motion } from 'motion/react'
import { Separator } from '@/components/ui/separator'

// Spring transition for smooth animations (matches sidebar)
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export interface NavigatorPanelProps {
  /** Panel title (e.g., "Conversations", "Sources") */
  title: string
  /** Panel subtitle (e.g., "12 conversations", "5 sources") */
  subtitle: string
  /** Whether the sidebar is visible (affects header margin animation) */
  isSidebarVisible: boolean
  /** Panel width in pixels */
  width: number
  /** Action buttons rendered in the header (filter, add, etc.) */
  headerActions?: React.ReactNode
  /** Main content (SessionList, SourcesListPanel, etc.) */
  children: React.ReactNode
  /** Optional className for the container */
  className?: string
}

export function NavigatorPanel({
  title,
  subtitle,
  isSidebarVisible,
  width,
  headerActions,
  children,
  className,
}: NavigatorPanelProps) {
  return (
    <div
      className={`h-full flex flex-col min-w-0 bg-background shrink-0 shadow-middle rounded-[14px] overflow-hidden ${className || ''}`}
      style={{ width }}
    >
      {/* Header: Title + subtitle + action buttons */}
      <motion.div
        initial={false}
        animate={{ marginLeft: isSidebarVisible ? 0 : 102 }}
        transition={springTransition}
        className="flex h-[50px] shrink-0 items-center pl-5 pr-2 min-w-0 relative z-50"
      >
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h1 className="text-sm font-semibold truncate font-sans leading-tight">{title}</h1>
          <p className="text-[11px] opacity-50 font-sans leading-tight">{subtitle}</p>
        </div>
        {headerActions}
      </motion.div>
      <Separator />
      {/* Content area */}
      {children}
    </div>
  )
}
