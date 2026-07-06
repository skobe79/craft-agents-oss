/**
 * AgentRing
 *
 * A circular indicator that pulses + glows when an agent is actively
 * processing, and sits as a subtle dim ring when idle.
 * Inspired by Claude's orange thinking indicator — but blue.
 *
 * Usage:  <AgentRing active={isProcessing} size={18} />
 *
 * - `active`  busy (spin + glow) vs idle (dim static ring)
 * - `size`    diameter in px (default 18)
 * - `color`   CSS color for the ring (default var(--agent-ring-color, #378add))
 * - Respects prefers-reduced-motion: falls back to a plain opacity pulse.
 */
import * as React from "react"

export interface AgentRingProps {
  active?: boolean
  size?: number
  color?: string
  className?: string
  title?: string
}

export function AgentRing({
  active = false,
  size = 18,
  color,
  className,
  title,
}: AgentRingProps) {
  const style = {
    "--agent-ring-size": `${size}px`,
    ...(color ? { "--agent-ring-color": color } : {}),
  } as React.CSSProperties

  return (
    <span
      role="img"
      aria-label={title ?? (active ? "Agent working" : "Agent idle")}
      className={[
        "agent-ring",
        active ? "agent-ring--busy" : "agent-ring--idle",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    />
  )
}

export default AgentRing