/**
 * ContentFrame - Shared terminal-style card frame for all preview overlays
 *
 * Provides the "app window" look: rounded card with fake traffic lights title bar,
 * centered on a bg-foreground-3 background. Supports optional left and right sidebars
 * rendered outside the card (e.g., file navigation in MultiDiffPreviewOverlay).
 *
 * The card is always centered in the viewport. Sidebars are positioned absolutely
 * so they hang off the card edges without shifting its center position.
 *
 * Layout:
 *   absolute inset-0, flex centered, p-6
 *     └── relative wrapper (max-w constrained, height: min(100%, 80vh), centered)
 *          ├── leftSidebar?  (absolute, right-full — hangs left of card)
 *          ├── Card (h-full, rounded-2xl, bg-background, shadow-strong)
 *          │    ├── Title bar (traffic lights + title label)
 *          │    └── children (flex-1, min-h-0)
 *          └── rightSidebar? (absolute, left-full — hangs right of card)
 *
 * Used by: TerminalPreviewOverlay, CodePreviewOverlay, GenericOverlay,
 *          JSONPreviewOverlay, MultiDiffPreviewOverlay
 */

import type { ReactNode } from 'react'

export interface ContentFrameProps {
  /** Title bar label displayed between the traffic lights and the right spacer */
  title: string
  /** Max width of the card (default: 850). Sidebars are outside this constraint. */
  maxWidth?: number
  /** Optional content rendered to the left of the card (e.g., sidebar navigation) */
  leftSidebar?: ReactNode
  /** Optional content rendered to the right of the card */
  rightSidebar?: ReactNode
  /** Content rendered inside the card, below the title bar */
  children: ReactNode
}

export function ContentFrame({
  title,
  maxWidth = 850,
  leftSidebar,
  rightSidebar,
  children,
}: ContentFrameProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 overflow-auto">
      {/* Relative wrapper — centered by the parent flex container.
          Sidebars are absolutely positioned off the card edges so they don't
          affect centering. maxWidth applies to the card only. */}
      <div
        className="relative w-full"
        style={{ maxWidth, height: 'min(100%, 80vh)' }}
      >
        {/* Left sidebar — absolutely positioned to the left of the card */}
        {leftSidebar && (
          <div className="absolute right-full top-0 h-full mr-4 overflow-y-auto">
            {leftSidebar}
          </div>
        )}

        {/* Main card — the "app window" with title bar and content */}
        <div className="h-full flex flex-col rounded-2xl overflow-hidden backdrop-blur-sm shadow-strong bg-background">
          {/* Title bar with decorative traffic lights */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-foreground/12 select-none shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full border border-foreground/15" />
              <div className="w-3 h-3 rounded-full border border-foreground/15" />
              <div className="w-3 h-3 rounded-full border border-foreground/15" />
            </div>
            <div className="text-xs font-semibold tracking-wider text-foreground/30">
              {title}
            </div>
            <div className="w-12" />
          </div>

          {/* Content area — children handle their own scrolling/layout */}
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </div>

        {/* Right sidebar — absolutely positioned to the right of the card */}
        {rightSidebar && (
          <div className="absolute left-full top-0 h-full ml-4 overflow-y-auto">
            {rightSidebar}
          </div>
        )}
      </div>
    </div>
  )
}
