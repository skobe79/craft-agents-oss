import { useEffect, useState } from 'react'
import type { TransportConnectionState } from '../../shared/types'

export interface RemoteConnectionInfo {
  workspaceId: string
  connectionState: TransportConnectionState
}

/**
 * Tracks the bridge connection state for the active remote workspace.
 * Returns null when no remote bridge exists (local workspace or not yet connected).
 *
 * Provides full TransportConnectionState (status, url, attempt, errors, etc.)
 * so consumers get the same data quality as the thin client transport hook.
 */
export function useRemoteConnectionStatus(): RemoteConnectionInfo | null {
  const [state, setState] = useState<RemoteConnectionInfo | null>(null)

  useEffect(() => {
    let mounted = true

    // Query initial state
    window.electronAPI.getRemoteConnectionStatus?.()
      .then((initial) => { if (mounted) setState(initial) })
      .catch(() => {})

    // Listen for changes
    const unsub = window.electronAPI.onRemoteConnectionStatusChanged?.((data) => {
      if (mounted) setState(data)
    })

    return () => {
      mounted = false
      unsub?.()
    }
  }, [])

  return state
}
