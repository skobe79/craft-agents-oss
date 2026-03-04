import type { PlatformServices } from '../runtime/platform'

/**
 * Generic handler dependency bag.
 * Concrete hosts specialize these generics to their runtime implementations.
 */
export interface HandlerDeps<
  TSessionManager = unknown,
  TOAuthFlowStore = unknown,
  TWindowManager = unknown,
  TBrowserPaneManager = unknown,
> {
  sessionManager: TSessionManager
  platform: PlatformServices
  windowManager?: TWindowManager
  browserPaneManager?: TBrowserPaneManager
  oauthFlowStore: TOAuthFlowStore
}
