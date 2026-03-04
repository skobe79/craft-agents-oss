import { OAuthFlowStore } from '@craft-agent/shared/auth'
import { ensureConfigDir, loadStoredConfig, saveConfig } from '@craft-agent/shared/config'
import { setBundledAssetsRoot } from '@craft-agent/shared/utils'
import { WsRpcServer } from '../transport/server'
import type { EventSink, RpcServer } from '../transport/types'
import { createHeadlessPlatform } from '../runtime/platform-headless'
import type { PlatformServices } from '../runtime/platform'

interface ModelRefreshServiceLike {
  startAll(): void
}

export interface HeadlessServerBootstrapOptions<TSessionManager, THandlerDeps> {
  bundledAssetsRoot?: string
  platformFactory?: () => PlatformServices
  applyPlatformToSubsystems?: (platform: PlatformServices) => void
  createSessionManager: () => TSessionManager
  createHandlerDeps: (ctx: {
    sessionManager: TSessionManager
    platform: PlatformServices
    oauthFlowStore: OAuthFlowStore
  }) => THandlerDeps
  registerAllRpcHandlers: (server: RpcServer, deps: THandlerDeps) => void
  initializeSessionManager: (sessionManager: TSessionManager) => Promise<void>
  setSessionEventSink: (sessionManager: TSessionManager, sink: EventSink) => void
  initModelRefreshService: () => ModelRefreshServiceLike
  cleanupClientResources?: (clientId: string) => void
  serverId?: string
}

export interface HeadlessServerInstance<TSessionManager> {
  platform: PlatformServices
  sessionManager: TSessionManager
  wsServer: WsRpcServer
  oauthFlowStore: OAuthFlowStore
  host: string
  port: number
  token: string
  stop: () => Promise<void>
}

function bootstrapConfigArtifacts(platform: PlatformServices): void {
  ensureConfigDir()
  platform.logger.info('[headless] Config artifacts initialized')
}

function ensureGlobalConfigExists(platform: PlatformServices): void {
  const config = loadStoredConfig()
  if (config) {
    platform.logger.info('[headless] Global config found')
    return
  }

  saveConfig({
    workspaces: [],
    activeWorkspaceId: null,
    activeSessionId: null,
  })
  platform.logger.info('[headless] Initialized missing global config')
}

export async function startHeadlessServer<TSessionManager, THandlerDeps>(
  options: HeadlessServerBootstrapOptions<TSessionManager, THandlerDeps>,
): Promise<HeadlessServerInstance<TSessionManager>> {
  const serverToken = process.env.CRAFT_SERVER_TOKEN
  if (!serverToken) {
    throw new Error('CRAFT_SERVER_TOKEN is required. Generate one with: uuidgen or openssl rand -hex 32')
  }

  const platform = options.platformFactory?.() ?? createHeadlessPlatform()

  const bundledAssetsRoot = options.bundledAssetsRoot
    ?? process.env.CRAFT_BUNDLED_ASSETS_ROOT
    ?? process.cwd()
  setBundledAssetsRoot(bundledAssetsRoot)

  options.applyPlatformToSubsystems?.(platform)

  bootstrapConfigArtifacts(platform)
  ensureGlobalConfigExists(platform)

  const modelRefreshService = options.initModelRefreshService()
  const sessionManager = options.createSessionManager()

  const rpcHost = process.env.CRAFT_RPC_HOST ?? '0.0.0.0'
  const rpcPort = parseInt(process.env.CRAFT_RPC_PORT ?? '9100', 10)

  const wsServer = new WsRpcServer({
    host: rpcHost,
    port: rpcPort,
    requireAuth: true,
    validateToken: async (t) => t === serverToken,
    serverId: options.serverId ?? 'headless',
    onClientDisconnected: (clientId) => {
      options.cleanupClientResources?.(clientId)
    },
  })

  await wsServer.listen()

  const oauthFlowStore = new OAuthFlowStore()

  const deps = options.createHandlerDeps({
    sessionManager,
    platform,
    oauthFlowStore,
  })

  options.registerAllRpcHandlers(wsServer, deps)

  options.setSessionEventSink(sessionManager, wsServer.push.bind(wsServer))

  await options.initializeSessionManager(sessionManager)

  modelRefreshService.startAll()

  platform.logger.info(`Craft Agent headless server listening on ${rpcHost}:${wsServer.port}`)

  const stop = async (): Promise<void> => {
    platform.logger.info('Shutting down...')
    wsServer.close()
    oauthFlowStore.dispose()
  }

  return {
    platform,
    sessionManager,
    wsServer,
    oauthFlowStore,
    host: rpcHost,
    port: wsServer.port,
    token: serverToken,
    stop,
  }
}
