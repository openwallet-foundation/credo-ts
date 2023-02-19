import type { FileSystem } from '../storage/FileSystem'
import type { EventEmitter } from 'events'
import type fetch from 'node-fetch'
import type WebSocket from 'ws'

export interface AgentDependencies {
  FileSystem: {
    new (): FileSystem
  }
  EventEmitterClass: typeof EventEmitter
  fetch: typeof fetch
  WebSocketClass: typeof WebSocket
}
