import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'
import { WebSocket } from 'ws'

import { NodeFileSystem } from './NodeFileSystem'
import { HttpInboundDidCommTransport } from './transport/HttpInboundDidCommTransport'
import { WsInboundDidCommTransport } from './transport/WsInboundDidCommTransport'

export { NodeInMemoryKeyManagementStorage } from './kms/NodeInMemoryKeyManagementStorage'
export { NodeKeyManagementService } from './kms/NodeKeyManagementService'
export { NodeKeyManagementStorage } from './kms/NodeKeyManagementStorage'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export { agentDependencies, HttpInboundDidCommTransport, WsInboundDidCommTransport }
