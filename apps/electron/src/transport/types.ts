import type {
  RequestContext,
  HandlerFn,
  RpcServer,
  RpcClient,
  EventSink,
} from '@craft-agent/server-core/transport'

export type {
  RequestContext,
  HandlerFn,
  RpcServer,
  RpcClient,
  EventSink,
}

import type { BroadcastEventMap } from '../shared/types'

/** Type-safe push. Constrains args against BroadcastEventMap at compile time. */
export function pushTyped<K extends keyof BroadcastEventMap & string>(
  server: RpcServer,
  channel: K,
  target: import('@craft-agent/shared/protocol').PushTarget,
  ...args: BroadcastEventMap[K]
): void {
  server.push(channel, target, ...args)
}
