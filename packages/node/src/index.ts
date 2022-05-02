import type { AgentDependencies } from '@aries-framework/core'

import { EventEmitter } from 'events'
import * as indy from 'indy-sdk'
import fetch from 'node-fetch'
import WebSocket from 'ws'

import { NodeFileSystem } from './NodeFileSystem'
import { IndyPostgresStorageConfig, loadPostgresPlugin } from './PostgresPlugin'
import { HttpInboundTransport } from './transport/HttpInboundTransport'
import { WsInboundTransport } from './transport/WsInboundTransport'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
  indy,
}

export { agentDependencies, HttpInboundTransport, WsInboundTransport, loadPostgresPlugin, IndyPostgresStorageConfig }
