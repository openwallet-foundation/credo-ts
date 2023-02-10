import type { AgentDependencies } from '@aries-framework/core'

import { EventEmitter } from 'events'
import fetch from 'node-fetch'
import WebSocket from 'ws'

import { NodeFileSystem } from './NodeFileSystem'
import { IndyPostgresStorageConfig, loadPostgresPlugin, WalletScheme } from './PostgresPlugin'
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
  loadPostgresPlugin,
  IndyPostgresStorageConfig,
  WalletScheme,
}
