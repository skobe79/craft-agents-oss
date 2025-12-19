import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/loading-indicator"

export type BannerState =
  | 'hidden'
  | 'setup'
  | 'activating'
  | 'mcp_auth'
  | 'api_auth'
  | 'ready'
  | 'error'

interface SetupAuthBannerProps {
  state: BannerState
  agentName?: string
  reason?: string
  onAction: () => void
  /** Variant: 'banner' for chat list, 'inputAreaCover' matches chat input styling */
  variant?: 'banner' | 'inputAreaCover'
}

/**
 * SetupAuthBanner - Shows when an agent needs activation or authentication
 *
 * States:
 * - 'hidden': No banner shown
 * - 'setup': Agent has never been configured (needs initial activation)
 * - 'activating': Agent activation/extraction is in progress
 * - 'mcp_auth': Agent needs MCP server authentication
 * - 'api_auth': Agent needs API credentials
 * - 'ready': Agent is ready to be marked active
 * - 'error': Agent activation failed (allows retry)
 */
export function SetupAuthBanner({
  state,
  agentName,
  reason,
  onAction,
  variant = 'banner'
}: SetupAuthBannerProps) {
  if (state === 'hidden') return null

  // Get title based on state
  const getTitle = () => {
    switch (state) {
      case 'setup':
        return `Activate ${agentName || 'agent'}`
      case 'activating':
        return `Activating ${agentName || 'agent'}...`
      case 'mcp_auth':
        return 'Connection required'
      case 'api_auth':
        return 'API credentials required'
      case 'ready':
        return `${agentName || 'Agent'} is ready`
      case 'error':
        return 'Activation failed'
      default:
        return ''
    }
  }

  // Get default description based on state
  const getDescription = () => {
    if (reason) return reason
    switch (state) {
      case 'setup':
        return 'Activate this agent to start chatting.'
      case 'activating':
        return 'Setting up agent configuration...'
      case 'mcp_auth':
        return 'Connect to required services to use this agent.'
      case 'api_auth':
        return 'Enter API credentials to use this agent.'
      case 'ready':
        return 'Click to start chatting.'
      case 'error':
        return 'Something went wrong. Tap to retry.'
      default:
        return ''
    }
  }

  // Get button text based on state
  const getButtonText = () => {
    switch (state) {
      case 'setup':
        return 'Activate'
      case 'activating':
        return 'View Progress'
      case 'mcp_auth':
        return 'Connect'
      case 'api_auth':
        return 'Add Credentials'
      case 'ready':
        return 'Start Chatting'
      case 'error':
        return 'Retry'
      default:
        return 'Continue'
    }
  }

  const isActivating = state === 'activating'

  // inputAreaCover variant - matches chat input styling
  if (variant === 'inputAreaCover') {
    return (
      <div className="rounded-xl border bg-background overflow-hidden">
        <div className="py-6 px-4 text-center font-sans">
          <h3 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
            {isActivating && <Spinner className="text-sm" />}
            {getTitle()}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {getDescription()}
          </p>
          <Button
            onClick={onAction}
            size="sm"
            className="mt-4"
          >
            {getButtonText()}
          </Button>
        </div>
      </div>
    )
  }

  // banner variant (default) - single line for session list (48px, full width, snapped to top)
  return (
    <div className="h-12 shrink-0 pl-4 pr-2 flex items-center justify-between gap-3 border-b border-border/50 bg-card select-none">
      <h3 className="text-sm font-medium text-foreground font-sans flex items-center gap-2 min-w-0">
        {isActivating && <Spinner className="text-sm shrink-0" />}
        <span className="truncate">{getTitle()}</span>
      </h3>
      <Button
        onClick={onAction}
        size="sm"
        className="shrink-0 text-xs rounded-[8px]"
      >
        {getButtonText()}
      </Button>
    </div>
  )
}
