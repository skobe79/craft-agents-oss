import type { TransportConnectionState } from '../../shared/types'
import { useTransportConnectionState } from './useTransportConnectionState'
import { useRemoteConnectionStatus } from './useRemoteConnectionStatus'

export interface WorkspaceConnectionState {
  /** True when the active workspace is remote (always true in thin client, conditional in hybrid). */
  isRemote: boolean
  /** Full connection state — same shape regardless of thin client vs bridge path. Null only before first state arrives. */
  connectionState: TransportConnectionState | null
}

/**
 * Unified workspace connection state — single source of truth for
 * "is the workspace remote?" and "what's the connection like?"
 *
 * Composes two existing hooks:
 * - useTransportConnectionState() — the preload WS client state (thin client path)
 * - useRemoteConnectionStatus() — the bridge state forwarded via push (hybrid path)
 *
 * Consumers (directory picker, connection banner, workspace switcher) use this
 * instead of checking transport.mode directly, making them mode-agnostic.
 */
export function useWorkspaceConnectionState(): WorkspaceConnectionState {
  const transport = useTransportConnectionState()
  const bridge = useRemoteConnectionStatus()

  // Thin client: transport itself IS the remote connection
  if (transport?.mode === 'remote') {
    return { isRemote: true, connectionState: transport }
  }

  // Hybrid + remote workspace: bridge carries the remote connection state
  if (bridge) {
    return { isRemote: true, connectionState: bridge.connectionState }
  }

  // Local workspace
  return { isRemote: false, connectionState: transport }
}
