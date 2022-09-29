import type { AgentDependencies } from '@aries-framework/core'

import { randomBytes } from 'crypto'
import * as didcomm from 'didcomm-node'
import { EventEmitter } from 'events'
import * as indy from 'indy-sdk'
import fetch from 'node-fetch'
import WebSocket from 'ws'

import { NodeFileSystem } from './NodeFileSystem'
import { HttpInboundTransport } from './transport/HttpInboundTransport'
import { WsInboundTransport } from './transport/WsInboundTransport'

const agentDependencies: AgentDependencies = {
  FileSystem: NodeFileSystem,
  fetch,
  EventEmitterClass: EventEmitter,
  WebSocketClass: WebSocket,
  indy,
  didcomm,
  randomBytes,
}

export { agentDependencies, HttpInboundTransport, WsInboundTransport }
