/**
 * ChatTabPanel
 *
 * Wraps the ChatDisplay component for use in the tab system.
 * Gets session data from ChatContext and agent status from main process.
 */

import * as React from 'react'
import { AlertCircle, Bot } from 'lucide-react'
import { ChatDisplay } from '@/components/chat/ChatDisplay'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loading-indicator'
import { useChatContext, usePendingPermission } from '@/context/ChatContext'
import { useAgentState } from '../../hooks/useAgentState'
import type { Tab, ChatTab } from '../types'
import { useTabs } from '../useTabs'

interface ChatTabPanelProps {
  tab: Tab
}

export default function ChatTabPanel({ tab }: ChatTabPanelProps) {
  const chatTab = tab as ChatTab
  const {
    sessions,
    currentModel,
    onSendMessage,
    onOpenFile,
    onOpenUrl,
    onModelChange,
    onRespondToPermission,
    textareaRef,
  } = useChatContext()

  const { closeTab, openAgentSetupTab } = useTabs()

  // Find the session for this tab - check early to avoid unnecessary hook calls
  const session = sessions.find((s) => s.id === chatTab.sessionId) || null

  // Get agent status from main process (source of truth)
  // Agent-scoped: keyed by (workspaceId, agentId), not sessionId
  // Pass null for agentId if session doesn't exist to avoid unnecessary IPC calls
  const agentState = useAgentState(
    session ? chatTab.workspaceId : null,
    session ? (chatTab.agentId || null) : null
  )

  // Get pending permission for this session
  const pendingPermission = usePendingPermission(chatTab.sessionId)

  // Handle file opens - optionally open in tab instead of external app
  const handleOpenFile = React.useCallback(
    (path: string) => {
      // For now, open in external app (can be changed to openFileTab later)
      onOpenFile(path)
    },
    [onOpenFile]
  )

  // Handle URL opens - optionally open in tab instead of external browser
  const handleOpenUrl = React.useCallback(
    (url: string) => {
      // For now, open in external browser (can be changed to openBrowserTab later)
      onOpenUrl(url)
    },
    [onOpenUrl]
  )

  // Handler to activate agent directly (shows progress in this panel)
  const handleActivateAgent = React.useCallback(() => {
    if (session?.agentId) {
      agentState.activate()
    }
  }, [session?.agentId, agentState])

  // Handler to open agent setup wizard (for review/auth states)
  const handleOpenSetupWizard = React.useCallback(() => {
    if (session?.agentId) {
      openAgentSetupTab(
        session.agentId,
        chatTab.workspaceId,
        session?.agentName || 'Agent'
      )
    }
  }, [session?.agentId, session?.agentName, chatTab.workspaceId, openAgentSetupTab])

  // Auto-mark agent as active when ready (no extra click needed)
  const { isReady, markActive } = agentState
  React.useEffect(() => {
    if (isReady && session?.agentId) {
      markActive()
    }
  }, [isReady, session?.agentId, markActive])

  // Determine agent setup state for input area indicator
  // Maps agent state to SetupAuthBanner state
  // Note: Main process handles auto-activation for already-configured idle agents
  const agentSetupState = React.useMemo(() => {
    if (!session?.agentId) return undefined

    // Agent needs initial activation (main process returns 'idle' only if setup is truly needed)
    if (agentState.isIdle) {
      return {
        state: 'setup' as const,
        agentName: agentState.agentName || session.agentName,
        onAction: handleActivateAgent,
      }
    }
    // Agent is being extracted/activated
    if (agentState.isExtracting) {
      return {
        state: 'activating' as const,
        agentName: agentState.agentName || session.agentName,
        reason: agentState.extractionMessage || undefined,
        onAction: handleOpenSetupWizard,
      }
    }
    // Agent needs review (questions to answer)
    if (agentState.isNeedsReview) {
      return {
        state: 'review' as const,
        agentName: agentState.agentName || session.agentName,
        onAction: handleOpenSetupWizard,
      }
    }
    // Agent needs MCP server authentication
    if (agentState.isNeedsMcpAuth) {
      return {
        state: 'mcp_auth' as const,
        agentName: agentState.agentName || session.agentName,
        onAction: handleOpenSetupWizard,
      }
    }
    // Agent needs API credentials
    if (agentState.isNeedsApiAuth) {
      return {
        state: 'api_auth' as const,
        agentName: agentState.agentName || session.agentName,
        onAction: handleOpenSetupWizard,
      }
    }
    // Agent activation failed
    if (agentState.isError) {
      return {
        state: 'error' as const,
        agentName: agentState.agentName || session.agentName,
        reason: agentState.errorMessage || undefined,
        onAction: () => agentState.reload(),
      }
    }
    // Agent is ready or active - no banner needed
    // (ready state auto-transitions to active via useEffect above)
    return undefined
  }, [session?.agentId, session?.agentName, agentState, handleActivateAgent, handleOpenSetupWizard])

  // Handle missing session (deleted while tab was open)
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10" />
        <p className="text-sm">This session no longer exists</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => closeTab(chatTab.id)}
        >
          Close Tab
        </Button>
      </div>
    )
  }

  return (
    <ChatDisplay
      session={session}
      onSendMessage={(message, attachments) => {
        if (session) {
          onSendMessage(session.id, message, attachments)
        }
      }}
      onOpenFile={handleOpenFile}
      onOpenUrl={handleOpenUrl}
      currentModel={currentModel}
      onModelChange={onModelChange}
      textareaRef={textareaRef}
      pendingPermission={pendingPermission}
      onRespondToPermission={onRespondToPermission}
      agentSetupState={agentSetupState}
    />
  )
}
