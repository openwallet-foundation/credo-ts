import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { NodeFileSystem } from './NodeFileSystem'

export { NodeInMemoryKeyManagementStorage } from './kms/NodeInMemoryKeyManagementStorage'
export { NodeKeyManagementService } from './kms/NodeKeyManagementService'
export type { NodeKeyManagementStorage } from './kms/NodeKeyManagementStorage'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export { agentDependencies, NodeFileSystem }
