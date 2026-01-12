/**
 * Info_Table
 *
 * Two-column key-value table with consistent styling.
 * Use for Connection info, metadata display, etc.
 * Built on shadcn Table primitives.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export interface Info_TableProps {
  children: React.ReactNode
  /** Optional footer content (e.g., error alert) */
  footer?: React.ReactNode
  /** Label column width in pixels (default: 128) */
  labelWidth?: number
  className?: string
}

export interface Info_TableRowProps {
  /** Left column label */
  label: string
  /** Right column value (shorthand) */
  value?: React.ReactNode
  /** Right column content (for complex content, use instead of value) */
  children?: React.ReactNode
  className?: string
}

function Info_TableRoot({
  children,
  footer,
  labelWidth = 128,
  className,
}: Info_TableProps) {
  return (
    <div className={cn('py-2', className)}>
      <Table className="table-fixed">
        <colgroup>
          <col style={{ width: labelWidth }} />
          <col />
        </colgroup>
        <TableBody>{children}</TableBody>
      </Table>
      {footer}
    </div>
  )
}

function Info_TableRow({ label, value, children, className }: Info_TableRowProps) {
  const content = children ?? value

  return (
    <TableRow className={cn('border-b border-border/30 last:border-0 hover:bg-transparent', className)}>
      <TableCell className="pl-[22px] pr-4 py-1.5 text-muted-foreground align-top">
        {label}
      </TableCell>
      <TableCell className="pr-4 py-1.5 align-top">{content}</TableCell>
    </TableRow>
  )
}

export const Info_Table = Object.assign(Info_TableRoot, {
  Row: Info_TableRow,
})
