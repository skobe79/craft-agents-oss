/**
 * WS-mode preload — replaces the full IPC preload (index.ts).
 *
 * 1. Gets port + token from main via ipcRenderer.sendSync
 * 2. Creates WsRpcClient → connects to local WS server
 * 3. Builds the full ElectronAPI proxy via buildClientApi + CHANNEL_MAP
 * 4. Attaches performOAuth (multi-step orchestration, runs client-side)
 * 5. Exposes as window.electronAPI via contextBridge
 *
 * On localhost the WS handshake completes in <1ms. The React app takes >100ms
 * to initialise, so by the time any component calls an API method, the
 * connection is established.
 */

import '@sentry/electron/preload'
import { contextBridge, ipcRenderer } from 'electron'
import { WsRpcClient } from '../transport/client'
import { buildClientApi } from '../transport/build-api'
import { CHANNEL_MAP } from '../transport/channel-map'
import { createCallbackServer } from '@craft-agent/shared/auth/callback-server'

// Get connection details from main process (synchronous — runs during preload eval)
const wsPort: number = ipcRenderer.sendSync('__get-ws-port')
const wsToken: string = ipcRenderer.sendSync('__get-ws-token')
const webContentsId: number = ipcRenderer.sendSync('__get-web-contents-id')
const workspaceId: string = ipcRenderer.sendSync('__get-workspace-id')

// Create WS client and connect immediately
const client = new WsRpcClient(`ws://127.0.0.1:${wsPort}`, {
  token: wsToken,
  workspaceId,
  webContentsId,
  autoReconnect: true,
})
client.connect()

// Build the full ElectronAPI proxy — identical shape to the IPC preload.
// Methods return promises (via client.invoke), listeners return unsubscribe fns.
const api = buildClientApi(client, CHANNEL_MAP)

// ── performOAuth ─────────────────────────────────────────────────────────
// Multi-step orchestration: callback server (local) → oauth:start (server) →
// open browser → wait for callback → oauth:complete (server).
// Runs client-side because the callback server must receive the redirect.
;(api as any).performOAuth = async (args: {
  sourceSlug: string
  sessionId?: string
  authRequestId?: string
}): Promise<{ success: boolean; error?: string; email?: string }> => {
  let callbackServer: Awaited<ReturnType<typeof createCallbackServer>> | null = null
  let flowId: string | undefined
  let state: string | undefined

  try {
    // 1. Start local callback server to receive OAuth redirect
    callbackServer = await createCallbackServer({ appType: 'electron' })
    const port = parseInt(new URL(callbackServer.url).port, 10)

    // 2. Ask server to prepare the flow (PKCE, auth URL, store in flow store)
    const startResult = await client.invoke('oauth:start', {
      sourceSlug: args.sourceSlug,
      callbackPort: port,
      sessionId: args.sessionId,
      authRequestId: args.authRequestId,
    })
    flowId = startResult.flowId
    state = startResult.state

    // 3. Open browser for user consent
    await client.invoke('shell:openUrl', startResult.authUrl)

    // 4. Wait for OAuth provider to redirect to our callback server
    const callback = await callbackServer.promise

    // 5. Check for errors from the provider
    if (callback.query.error) {
      const error = callback.query.error_description || callback.query.error
      await client.invoke('oauth:cancel', { flowId, state })
      return { success: false, error }
    }

    const code = callback.query.code
    if (!code) {
      await client.invoke('oauth:cancel', { flowId, state })
      return { success: false, error: 'No authorization code received' }
    }

    // 6. Send code to server for token exchange + credential storage
    const result = await client.invoke('oauth:complete', { flowId, code, state })
    return { success: result.success, error: result.error, email: result.email }
  } catch (err) {
    // Clean up server-side flow on error
    if (flowId && state) {
      client.invoke('oauth:cancel', { flowId, state }).catch(() => {})
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'OAuth flow failed',
    }
  } finally {
    callbackServer?.close()
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
