/**
 * SettingsTextarea
 *
 * Multiline text input with label and optional character count.
 */

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface SettingsTextareaProps {
  /** Textarea label */
  label?: string
  /** Optional description below label */
  description?: string
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Maximum character length */
  maxLength?: number
  /** Number of visible rows */
  rows?: number
  /** Disabled state */
  disabled?: boolean
  /** Error message */
  error?: string
  /** Additional className */
  className?: string
  /** Whether inside a card */
  inCard?: boolean
}

/**
 * SettingsTextarea - Multiline text input with character count
 *
 * @example
 * <SettingsTextarea
 *   label="Notes"
 *   description="Additional context for the AI assistant"
 *   value={notes}
 *   onChange={setNotes}
 *   maxLength={2000}
 *   rows={4}
 * />
 */
export function SettingsTextarea({
  label,
  description,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
  disabled,
  error,
  className,
  inCard = false,
}: SettingsTextareaProps) {
  const id = React.useId()
  const charCount = value.length
  const isOverLimit = maxLength !== undefined && charCount > maxLength

  return (
    <div
      className={cn(
        'space-y-2',
        inCard && 'px-4 py-3.5',
        className
      )}
    >
      {label && (
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="relative">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            'bg-muted/50 resize-none',
            maxLength && 'pb-6',
            error && 'border-destructive focus:ring-destructive',
            isOverLimit && 'border-destructive'
          )}
        />
        {maxLength !== undefined && (
          <div
            className={cn(
              'absolute bottom-2 right-3 text-xs',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
