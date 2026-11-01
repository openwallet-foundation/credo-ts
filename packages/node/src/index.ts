import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { httpServerHost } from './express'
import { NodeFileSystem } from './NodeFileSystem'
import { DidCommHttpInboundTransport } from './transport/DidCommHttpInboundTransport'
import { DidCommWsInboundTransport } from './transport/DidCommWsInboundTransport'
import { WebSocketHost, type WebSocketHostAcceptor, type WebSocketHostOptions, webSocketHost } from './webSocketHost'

export { NodeInMemoryKeyManagementStorage } from './kms/NodeInMemoryKeyManagementStorage'
export { NodeKeyManagementService } from './kms/NodeKeyManagementService'
export type { NodeKeyManagementStorage } from './kms/NodeKeyManagementStorage'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export {
  agentDependencies,
  DidCommHttpInboundTransport,
  DidCommWsInboundTransport,
  httpServerHost,
  NodeFileSystem,
  WebSocketHost,
  type WebSocketHostAcceptor,
  type WebSocketHostOptions,
  webSocketHost,
}
