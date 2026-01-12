/**
 * Info_StatusBadge
 *
 * Status badge for permission states using Info_Badge.
 */

import * as React from 'react'
import { Info_Badge, type BadgeColor } from './Info_Badge'

const statusConfig: Record<string, { label: string; color: BadgeColor }> = {
  allowed: { label: 'Allowed', color: 'success' },
  blocked: { label: 'Blocked', color: 'destructive' },
  'requires-permission': { label: 'Ask', color: 'warning' },
}

export interface Info_StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Status type */
  status?: 'allowed' | 'blocked' | 'requires-permission' | null
  /** Override the default label */
  label?: string
}

export function Info_StatusBadge({
  status,
  label,
  ...props
}: Info_StatusBadgeProps) {
  const config = statusConfig[status ?? 'allowed'] ?? statusConfig.allowed
  const displayLabel = label ?? config.label

  return (
    <Info_Badge color={config.color} {...props}>
      {displayLabel}
    </Info_Badge>
  )
}
