import type { AgentDependencies } from '@credo-ts/core'

import { EventEmitter } from 'events'
import WebSocket from 'ws'

import { NodeFileSystem } from './NodeFileSystem'
import { IndySdkPostgresStorageConfig, loadIndySdkPostgresPlugin, IndySdkPostgresWalletScheme } from './PostgresPlugin'
import { HttpInboundTransport } from './transport/HttpInboundTransport'
import { WsInboundTransport } from './transport/WsInboundTransport'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
}

export {
  agentDependencies,
  HttpInboundTransport,
  WsInboundTransport,
  loadIndySdkPostgresPlugin,
  IndySdkPostgresStorageConfig,
  IndySdkPostgresWalletScheme,
}
